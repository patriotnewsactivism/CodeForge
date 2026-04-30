import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Play,
  RefreshCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  Smartphone,
  Monitor,
  Tablet,
} from "lucide-react";

interface FileItem {
  _id: Id<"files">;
  path: string;
  name: string;
  type: "file" | "folder";
  content?: string | null;
  language?: string | null;
}

type ViewportMode = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES: Record<ViewportMode, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablet" },
  mobile: { width: "375px", label: "Mobile" },
};

export function PreviewPanel({ files }: { files: FileItem[] }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [autoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Build the preview HTML from project files
  const previewHtml = useMemo(() => {
    const htmlFile = files.find(
      (f) =>
        f.type === "file" &&
        (f.name === "index.html" || f.path.endsWith("/index.html"))
    );
    const cssFiles = files.filter(
      (f) =>
        f.type === "file" &&
        (f.name.endsWith(".css") || f.path.endsWith(".css"))
    );
    const jsFiles = files.filter(
      (f) =>
        f.type === "file" &&
        (f.name.endsWith(".js") || f.path.endsWith(".js")) &&
        !f.name.endsWith(".config.js") &&
        !f.name.endsWith(".test.js")
    );

    if (htmlFile?.content) {
      // If there's an index.html, inject CSS and JS into it
      let html = htmlFile.content;

      // Inject CSS
      const cssContent = cssFiles
        .map((f) => f.content || "")
        .filter(Boolean)
        .join("\n");
      if (cssContent && !html.includes("<style")) {
        html = html.replace(
          "</head>",
          `<style>\n${cssContent}\n</style>\n</head>`
        );
      }

      // Inject JS
      const jsContent = jsFiles
        .filter((f) => f._id !== htmlFile._id)
        .map((f) => f.content || "")
        .filter(Boolean)
        .join("\n\n");
      if (jsContent && !html.includes("<script")) {
        html = html.replace(
          "</body>",
          `<script>\n${jsContent}\n</script>\n</body>`
        );
      }

      // Add error overlay
      html = html.replace(
        "</body>",
        `<script>
window.onerror = function(msg, url, line, col, error) {
  var overlay = document.getElementById('__cf_error');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = '__cf_error';
    overlay.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;color:#ff6b6b;font-family:monospace;font-size:12px;padding:8px 12px;border-top:2px solid #ff6b6b;z-index:99999;max-height:30vh;overflow:auto;';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML += '<div>⚠ ' + msg + ' (line ' + line + ')</div>';
  return true;
};
</script>
</body>`
      );

      return html;
    }

    // No index.html — generate a preview from CSS + JS
    const cssContent = cssFiles
      .map((f) => f.content || "")
      .filter(Boolean)
      .join("\n");
    const jsContent = jsFiles
      .map((f) => f.content || "")
      .filter(Boolean)
      .join("\n\n");

    if (!cssContent && !jsContent) {
      return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0a0a0f;color:#666;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;">
    <div style="font-size:3rem;margin-bottom:1rem;">🖥️</div>
    <h2 style="color:#888;margin:0 0 0.5rem;">No Preview Available</h2>
    <p style="font-size:0.875rem;">Create an <code style="background:#1a1a2e;padding:2px 6px;border-radius:4px;color:#00d4aa;">index.html</code> file to see a live preview here.</p>
    <p style="font-size:0.75rem;margin-top:1rem;opacity:0.5;">Or ask the AI to build something!</p>
  </div>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>${cssContent}</style>
</head>
<body>
  <script>${jsContent}</script>
</body>
</html>`;
  }, [files, lastRefresh]);

  // Auto-refresh when files change
  useEffect(() => {
    if (autoRefresh) {
      setLastRefresh(Date.now());
    }
  }, [files, autoRefresh]);

  const handleRefresh = () => {
    setLastRefresh(Date.now());
  };

  const handleOpenExternal = () => {
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const viewportWidth = VIEWPORT_SIZES[viewportMode].width;

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-card/30",
        isFullscreen && "fixed inset-0 z-50 bg-background"
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/50">
        <div className="flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5 text-chart-3" />
          <span className="text-xs font-semibold">Preview</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Viewport switcher */}
          <div className="hidden sm:flex items-center gap-0.5 mr-1">
            <Button
              variant={viewportMode === "desktop" ? "secondary" : "ghost"}
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setViewportMode("desktop")}
            >
              <Monitor className="h-3 w-3" />
            </Button>
            <Button
              variant={viewportMode === "tablet" ? "secondary" : "ghost"}
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setViewportMode("tablet")}
            >
              <Tablet className="h-3 w-3" />
            </Button>
            <Button
              variant={viewportMode === "mobile" ? "secondary" : "ghost"}
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setViewportMode("mobile")}
            >
              <Smartphone className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={handleOpenExternal}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-auto bg-[#0a0a0f] flex items-start justify-center">
        <div
          className={cn(
            "h-full transition-all",
            viewportMode !== "desktop" && "border-x border-border shadow-lg"
          )}
          style={{ width: viewportWidth, maxWidth: "100%" }}
        >
          <iframe
            ref={iframeRef}
            key={lastRefresh}
            srcDoc={previewHtml}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            title="Live Preview"
          />
        </div>
      </div>
    </div>
  );
}
