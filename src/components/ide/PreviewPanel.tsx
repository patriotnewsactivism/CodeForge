/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — LIVE PREVIEW PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * Renders project files in a sandboxed iframe with hot reload.
 * Captures console errors and reports them back for auto-fix.
 * Viewport switching for responsive testing.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
  XCircle,
  X,
  Trash2,
} from "lucide-react";

interface FileItem {
  _id: Id<"files">;
  path: string;
  name: string;
  type: "file" | "folder";
  content?: string | null;
  language?: string | null;
}

export interface ConsoleError {
  message: string;
  source?: string;
  line?: number;
  col?: number;
  timestamp: number;
}

type ViewportMode = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES: Record<ViewportMode, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablet" },
  mobile: { width: "375px", label: "Mobile" },
};

interface PreviewPanelProps {
  files: FileItem[];
  /** Callback when preview catches errors — used for auto-fix loop */
  onErrors?: (errors: ConsoleError[]) => void;
}

export function PreviewPanel({ files, onErrors }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [errors, setErrors] = useState<ConsoleError[]>([]);
  const [showConsole, setShowConsole] = useState(false);

  // Listen for error messages from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "cf-preview-error") {
        const err: ConsoleError = {
          message: event.data.message || "Unknown error",
          source: event.data.source,
          line: event.data.line,
          col: event.data.col,
          timestamp: Date.now(),
        };
        setErrors((prev) => {
          const next = [...prev, err].slice(-50); // Keep last 50
          return next;
        });
        setShowConsole(true);
      }
      if (event.data?.type === "cf-preview-log") {
        // Could capture console.log too if needed
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Notify parent of errors for auto-fix
  useEffect(() => {
    if (errors.length > 0 && onErrors) {
      onErrors(errors);
    }
  }, [errors, onErrors]);

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

    // Error capture + message bridge script
    const errorBridge = `<script>
(function(){
  window.onerror = function(msg, src, line, col, err) {
    window.parent.postMessage({
      type: 'cf-preview-error',
      message: String(msg),
      source: src,
      line: line,
      col: col
    }, '*');
    return false;
  };
  window.addEventListener('unhandledrejection', function(e) {
    window.parent.postMessage({
      type: 'cf-preview-error',
      message: 'Unhandled Promise: ' + (e.reason?.message || String(e.reason)),
    }, '*');
  });
  var origLog = console.log;
  console.log = function() {
    origLog.apply(console, arguments);
    window.parent.postMessage({
      type: 'cf-preview-log',
      args: Array.from(arguments).map(String)
    }, '*');
  };
  var origError = console.error;
  console.error = function() {
    origError.apply(console, arguments);
    window.parent.postMessage({
      type: 'cf-preview-error',
      message: Array.from(arguments).map(String).join(' ')
    }, '*');
  };
})();
</script>`;

    if (htmlFile?.content) {
      let html = htmlFile.content;

      // Inject CSS
      const cssContent = cssFiles
        .map((f) => f.content || "")
        .filter(Boolean)
        .join("\n");
      if (cssContent) {
        if (html.includes("</head>")) {
          html = html.replace("</head>", `<style>\n${cssContent}\n</style>\n</head>`);
        } else {
          html = `<style>\n${cssContent}\n</style>\n` + html;
        }
      }

      // Inject JS
      const jsContent = jsFiles
        .filter((f) => f._id !== htmlFile._id)
        .map((f) => f.content || "")
        .filter(Boolean)
        .join("\n\n");
      if (jsContent) {
        if (html.includes("</body>")) {
          html = html.replace("</body>", `<script>\n${jsContent}\n</script>\n</body>`);
        } else {
          html += `<script>\n${jsContent}\n</script>`;
        }
      }

      // Inject error bridge (before any other scripts)
      if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>\n${errorBridge}`);
      } else if (html.includes("<html>")) {
        html = html.replace("<html>", `<html><head>${errorBridge}</head>`);
      } else {
        html = errorBridge + html;
      }

      return html;
    }

    // No index.html — generate from CSS + JS
    const cssContent = cssFiles.map((f) => f.content || "").filter(Boolean).join("\n");
    const jsContent = jsFiles.map((f) => f.content || "").filter(Boolean).join("\n\n");

    if (!cssContent && !jsContent) {
      return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${errorBridge}</head>
<body style="background:#0a0a0f;color:#666;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;">
    <div style="font-size:3rem;margin-bottom:1rem;">🖥️</div>
    <h2 style="color:#888;margin:0 0 0.5rem;">No Preview Available</h2>
    <p style="font-size:0.875rem;">Create an <code style="background:#1a1a2e;padding:2px 6px;border-radius:4px;color:#10b981;">index.html</code> file to see a live preview here.</p>
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
  ${errorBridge}
  <style>${cssContent}</style>
</head>
<body>
  <script>${jsContent}</script>
</body>
</html>`;
  }, [files, lastRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh when files change
  useEffect(() => {
    setLastRefresh(Date.now());
    // Clear errors on fresh render
    setErrors([]);
  }, [files]);

  const handleRefresh = useCallback(() => {
    setLastRefresh(Date.now());
    setErrors([]);
  }, []);

  const handleOpenExternal = () => {
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const viewportWidth = VIEWPORT_SIZES[viewportMode].width;

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-[#0a0a0f]",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-[#0d0d14]">
        <div className="flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-white/80">Preview</span>
          {errors.length > 0 && (
            <Badge
              variant="secondary"
              className="text-[9px] h-4 px-1.5 bg-red-500/20 text-red-400 border-red-500/30 cursor-pointer"
              onClick={() => setShowConsole(!showConsole)}
            >
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
              {errors.length} error{errors.length !== 1 && "s"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Viewport switcher */}
          <div className="hidden sm:flex items-center gap-0.5 mr-1">
            {(["desktop", "tablet", "mobile"] as ViewportMode[]).map((mode) => {
              const Icon = mode === "desktop" ? Monitor : mode === "tablet" ? Tablet : Smartphone;
              return (
                <Button
                  key={mode}
                  variant={viewportMode === mode ? "secondary" : "ghost"}
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => setViewportMode(mode)}
                >
                  <Icon className="h-3 w-3" />
                </Button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleRefresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleOpenExternal}>
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-auto bg-[#0a0a0f] flex items-start justify-center">
        <div
          className={cn(
            "h-full transition-all",
            viewportMode !== "desktop" && "border-x border-white/10 shadow-lg"
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

      {/* Console panel (errors) */}
      {showConsole && errors.length > 0 && (
        <div className="border-t border-red-500/30 bg-[#0d0d14] max-h-[30%] overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1 border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3 w-3 text-red-400" />
              <span className="text-[10px] font-semibold text-red-400">Console Errors</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-white/30 hover:text-white/60"
                onClick={() => setErrors([])}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-white/30 hover:text-white/60"
                onClick={() => setShowConsole(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="p-2 space-y-1">
            {errors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-2 py-1 rounded bg-red-500/5 border border-red-500/10"
              >
                <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-red-300 font-mono break-all">{err.message}</p>
                  {err.line && (
                    <p className="text-[9px] text-red-400/60 mt-0.5">
                      Line {err.line}{err.col ? `:${err.col}` : ""}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


