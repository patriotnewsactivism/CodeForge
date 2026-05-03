/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — COLLABORATION / SHARE BAR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Shows active collaborators / share link.
 * Generates a shareable URL for the project.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Users,
  Share2,
  Copy,
  Check,
  Link2,
  Globe,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CollaborationBarProps {
  projectId: Id<"projects"> | null;
  projectName?: string;
}

// Random avatar colors for collaborators
const COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export function CollaborationBar({ projectId, projectName }: CollaborationBarProps) {
  const [copied, setCopied] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Generate a share link (in production this would be a real shareable URL)
  const shareUrl = projectId
    ? `${window.location.origin}/project/${projectId}`
    : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Share link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1.5 text-white/30 hover:text-white/60"
          disabled={!projectId}
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="text-[10px] hidden sm:inline">Share</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-emerald-400" />
            Share Project
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Project info */}
          <div className="bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-400/60" />
              <span className="text-sm text-white/60 font-medium">
                {projectName || "Untitled Project"}
              </span>
            </div>
          </div>

          {/* Share link */}
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider font-semibold mb-1.5 block">
              Share Link
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#0a0a0f] border border-white/10 rounded-md px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3 w-3 text-white/20 shrink-0" />
                  <span className="text-[11px] text-white/40 truncate font-mono">
                    {shareUrl}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                className="h-8 px-3 gap-1"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Collaborators (placeholder for future real-time) */}
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider font-semibold mb-1.5 block">
              Active Users
            </label>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#0d0d14]",
                    COLORS[0]
                  )}
                >
                  You
                </div>
              </div>
              <span className="text-[10px] text-white/20">
                1 active · Share the link to collaborate
              </span>
            </div>
          </div>

          {/* Access settings */}
          <div className="bg-white/5 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Lock className="h-3.5 w-3.5" />
              <span>Anyone with the link can view</span>
            </div>
            <p className="text-[10px] text-white/15">
              Real-time collaboration coming soon — multiple cursors, live edits,
              voice chat.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
