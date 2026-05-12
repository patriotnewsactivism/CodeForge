import { httpRouter, HttpRouter } from "convex/server";
import { auth } from "./auth";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();
auth.addHttpRoutes(http);

// ── Public project preview endpoint ─────────────────────────────
// GET /preview/:token → serves the project index.html
http.route({
  path: "/preview",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const token = url.searchParams.get("t") || url.pathname.split("/").pop() || "";

    if (!token) {
      return new Response("Not found", { status: 404 });
    }

    try {
      // Look up share record
      const share = await ctx.runQuery(api.previews.getShareByToken, { token });
      if (!share || !share.isActive) {
        return new Response(notFoundHtml("Preview link not found or expired"), {
          status: 404,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Check expiry
      if (share.expiresAt && Date.now() > share.expiresAt) {
        return new Response(notFoundHtml("This preview link has expired"), {
          status: 410,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Increment view count
      await ctx.runMutation(api.previews.incrementViewCount, { shareId: share._id });

      // Get project files
      const files = await ctx.runQuery(api.files.listWithContent, {
        projectId: share.projectId,
      });

      const html = buildPreviewHtml(files || [], share.projectId);

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Frame-Options": "SAMEORIGIN",
          "Cache-Control": "no-store",
        },
      });
    } catch (err: any) {
      return new Response(notFoundHtml("Error loading preview: " + err.message), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }
  }),
});

// Also handle /preview/:token path format
http.route({
  pathPrefix: "/preview/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const token = url.pathname.replace("/preview/", "").split("/")[0];

    if (!token) return new Response("Not found", { status: 404 });

    try {
      const share = await ctx.runQuery(api.previews.getShareByToken, { token });
      if (!share || !share.isActive) {
        return new Response(notFoundHtml("Preview link not found or expired"), {
          status: 404,
          headers: { "Content-Type": "text/html" },
        });
      }
      if (share.expiresAt && Date.now() > share.expiresAt) {
        return new Response(notFoundHtml("This preview link has expired"), {
          status: 410,
          headers: { "Content-Type": "text/html" },
        });
      }
      await ctx.runMutation(api.previews.incrementViewCount, { shareId: share._id });
      const files = await ctx.runQuery(api.files.listWithContent, { projectId: share.projectId });
      const html = buildPreviewHtml(files || [], share.projectId);
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    } catch (err: any) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  }),
});


// ── Stripe Webhook Route ─────────────────────────────────────────
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    try {
      const result = await ctx.runAction(api.subscriptions.handleStripeWebhook, {
        payload: body,
        signature,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;

// ── Helpers ──────────────────────────────────────────────────────

function notFoundHtml(message: string): string {
  return `<!DOCTYPE html><html><head><title>CodeForge Preview</title>
<style>body{background:#0a0a0f;color:#e8e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{text-align:center;padding:2rem;border:1px solid rgba(255,255,255,0.1);border-radius:1rem;max-width:400px}
h2{color:#e63946;margin-bottom:0.5rem}p{color:rgba(255,255,255,0.4);font-size:0.875rem}</style>
</head><body><div class="box"><h2>Preview Unavailable</h2><p>${message}</p></div></body></html>`;
}

function buildPreviewHtml(files: any[], projectId: string): string {
  // Find the HTML entry point
  const htmlFile = files.find((f) =>
    f.path === "index.html" || f.path === "public/index.html" || f.name === "index.html"
  );

  // Find main JS/TS files
  const jsFiles = files.filter(
    (f) => f.content && (f.path?.endsWith(".jsx") || f.path?.endsWith(".tsx") ||
      f.path?.endsWith(".js") || f.path?.endsWith(".ts")) &&
    !f.path?.includes("node_modules") && !f.path?.includes(".test.")
  );

  const cssFiles = files.filter(
    (f) => f.content && (f.path?.endsWith(".css") || f.path?.endsWith(".scss"))
  );

  if (htmlFile?.content) {
    // Inject a base tag so relative paths work from preview domain
    let html = htmlFile.content;
    // Inline any referenced CSS files
    cssFiles.forEach((css) => {
      html = html.replace(
        new RegExp(`<link[^>]+href=["\']${css.name}["\'][^>]*>`),
        `<style>${css.content}</style>`
      );
    });
    return html;
  }

  // No HTML file — build a minimal preview shell
  const mainFile = jsFiles.find(
    (f) => f.path === "src/main.tsx" || f.path === "src/main.ts" ||
      f.path === "src/index.tsx" || f.path === "main.tsx" || f.path === "src/App.tsx"
  );

  const inlineCss = cssFiles.map((f) => f.content || "").join("\n");
  const fileList = files
    .filter((f) => f.type === "file")
    .map((f) => `<li style="color:rgba(255,255,255,0.5);font-size:12px">${f.path}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CodeForge Preview</title>
  <style>
    * { box-sizing: border-box; }
    body { background: #0a0a0f; color: #e8e8f0; font-family: Inter, sans-serif; margin: 0; padding: 0; }
    ${inlineCss}
  </style>
  <script type="module" crossorigin>
    // Project: ${projectId}
    // This preview requires a build step for JSX/TSX projects.
    // Agents can run: npm run build to generate a dist/ folder for full preview.
  </script>
</head>
<body>
  <div id="root"></div>
  <div style="position:fixed;bottom:0;left:0;right:0;padding:12px 16px;background:rgba(0,0,0,0.8);border-top:1px solid rgba(255,255,255,0.1);font-size:11px;color:rgba(255,255,255,0.4)">
    <strong style="color:#e63946">CodeForge Preview</strong> — ${files.filter(f => f.type === "file").length} files · Ask agents to run <code style="background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:3px">npm run build</code> for full preview
  </div>
</body>
</html>`;
}
