/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — GIT PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * Shows git branches and GitHub connection status.
 * Uses the new gitBranches table and GitHub settings.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  ExternalLink,
  Clock,
  XCircle,
  GitMerge,
  Github,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; color: string; bgColor: string }> = {
  active: { icon: Clock, label: "Active", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  pr_created: { icon: GitPullRequest, label: "PR Open", color: "text-purple-400", bgColor: "bg-purple-500/10" },
  merged: { icon: GitMerge, label: "Merged", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  closed: { icon: XCircle, label: "Closed", color: "text-red-400", bgColor: "bg-red-500/10" },
};

interface GitPanelProps {
  projectId: Id<"projects"> | null;
}

export function GitPanel({ projectId }: GitPanelProps) {
  const githubSettings = useQuery(api.github.getSettings);
  const missions = useQuery(
    api.missions.listByProject,
    projectId ? { projectId } : "skip"
  );

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4 bg-[#0a0a0f]">
        <p className="text-xs text-white/30">Select a project to view git activity</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] border-l border-white/5">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 bg-white/[0.02]">
        <GitBranch className="h-4 w-4 text-emerald-400/60" />
        <span className="text-xs font-semibold text-white/70">Git</span>
        {githubSettings?.connected && (
          <Badge className="text-[9px] h-4 px-1.5 bg-white/5 text-white/40 border-0">
            <Github className="h-2.5 w-2.5 mr-1" />
            connected
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {!githubSettings?.connected ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Github className="h-8 w-8 mb-3 text-white/10" />
            <p className="text-xs text-white/30 font-medium">GitHub not connected</p>
            <p className="text-[10px] text-white/20 text-center mt-1">
              Connect GitHub from the top bar to enable git features
            </p>
          </div>
        ) : !missions || missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <GitBranch className="h-6 w-6 mb-2 text-white/10" />
            <p className="text-xs text-white/30">No missions yet</p>
            <p className="text-[10px] text-white/20 text-center mt-1">
              Branches are created when code missions run
            </p>
          </div>
        ) : (
          missions.map((mission) => (
            <div
              key={mission._id}
              className={cn(
                "rounded-lg border border-white/5 p-3 space-y-2 bg-white/[0.02]",
                mission.status === "running" && "border-emerald-500/20"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-white/60 truncate flex-1">
                  {mission.prompt?.slice(0, 80)}
                </span>
                <Badge
                  className={cn(
                    "text-[9px] h-4 px-1.5 border-0 shrink-0",
                    mission.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                    mission.status === "running" ? "bg-blue-500/10 text-blue-400" :
                    mission.status === "failed" ? "bg-red-500/10 text-red-400" :
                    "bg-white/5 text-white/40"
                  )}
                >
                  {mission.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-white/25">
                <span>{new Date(mission._creationTime).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
