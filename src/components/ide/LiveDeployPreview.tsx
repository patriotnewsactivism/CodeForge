/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — LIVE DEPLOY PREVIEW
 * ═══════════════════════════════════════════════════════════════════
 *
 * Shows the live deployed output in an iframe:
 * - Supports Railway, Vercel, Netlify, custom URLs
 * - Mobile/tablet/desktop viewport toggles
 * - Refresh and fullscreen controls
 * - Connection health indicator
 * - Quick-copy deploy URL
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  Maximize2,
  Copy,
  Check,
  ExternalLink,
  Wifi,
  WifiOff,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface LiveDeployPreviewProps {
  projectId: Id<"projects"> | null;
}

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES: Record<Viewport, { width: string; height: string; label: string; icon: typeof Monitor }> = {
  desktop: { width: "100%", height: "100%", label: "Desktop", icon: Monitor },
  tablet: { width: "768px", height: "1024px", label: "Tablet", icon: Tablet },
  mobile: { width: "375px", height: "667px", label: "Mobile", icon: Smartphone },
};

export function LiveDeployPreview({ projectId }: LiveDeployPreviewProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [customUrl, setCustomUrl] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const project = useQuery(api.projects.get, projectId ? { id: projectId } : "skip");

  // Derive deploy URL from project settings
  const deployUrl = customUrl || project?.settings?.railwayUrl || project?.settings?.deployUrl || "";

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      setIsLoaded(false);
      setIsError(false);
      iframeRef.current.src = deployUrl;
    }
  }, [deployUrl]);

  const handleCopyUrl = async () => {
    if (deployUrl) {
      await navigator.clipboard.writeText(deployUrl);
      setCopied(true);
      toast.success("URL copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFullscreen = () => {
    if (deployUrl) {
      window.open(deployUrl, "_blank");
    }
  };

  const vp = VIEWPORT_SIZES[viewport];
  const VPIcon = vp.icon;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Globe className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-semibold text-white/70">Live Preview</span>
        <div className="ml-auto flex items-center gap-1">
          {deployUrl && (
            isLoaded ? (
              <Wifi className="h-3 w-3 text-emerald-400" />
            ) : isError ? (
              <WifiOff className="h-3 w-3 text-red-400" />
            ) : (
              <RefreshCw className="h-3 w-3 text-amber-400 animate-spin" />
            )
          )}
        </div>
      </div>

      {/* URL Bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.03]">
        <div className="flex-1 relative">
          <Globe className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/15" />
          <Input
            value={customUrl || deployUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Enter deploy URL..."
            className="h-7 text-[10px] pl-7 pr-16 bg-white/[0.02] border-white/5 font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRefresh();
            }}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
            <button onClick={handleCopyUrl} className="p-0.5 hover:bg-white/5 rounded text-white/20 hover:text-white/40">
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
            <button onClick={handleFullscreen} className="p-0.5 hover:bg-white/5 rounded text-white/20 hover:text-white/40">
              <ExternalLink className="h-3 w-3" />
            </button>
            <button onClick={handleRefresh} className="p-0.5 hover:bg-white/5 rounded text-white/20 hover:text-white/40">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Viewport Toggles */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-white/[0.03]">
        {(Object.entries(VIEWPORT_SIZES) as [Viewport, typeof VIEWPORT_SIZES.desktop][]).map(([key, vp]) => {
          const Icon = vp.icon;
          return (
            <button
              key={key}
              onClick={() => setViewport(key)}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium transition-colors",
                viewport === key ? "bg-white/10 text-white/60" : "text-white/20 hover:text-white/40"
              )}
            >
              <Icon className="h-3 w-3" />
              {vp.label}
            </button>
          );
        })}
      </div>

      {/* Preview Frame */}
      <div className="flex-1 flex items-center justify-center bg-[#060609] p-2 overflow-auto">
        {!deployUrl ? (
          <div className="text-center space-y-2">
            <Globe className="h-8 w-8 text-white/10 mx-auto" />
            <p className="text-xs text-white/20">No deploy URL configured</p>
            <p className="text-[10px] text-white/10">
              Deploy your project to Railway, Vercel, or enter a custom URL above
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "bg-white rounded-lg overflow-hidden shadow-2xl transition-all duration-300",
              viewport === "desktop" ? "w-full h-full" : ""
            )}
            style={viewport !== "desktop" ? {
              width: vp.width,
              height: vp.height,
              maxWidth: "100%",
              maxHeight: "100%",
            } : {}}
          >
            <iframe
              ref={iframeRef}
              src={deployUrl}
              className="w-full h-full border-0"
              onLoad={() => { setIsLoaded(true); setIsError(false); }}
              onError={() => { setIsLoaded(false); setIsError(true); }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Deploy Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
