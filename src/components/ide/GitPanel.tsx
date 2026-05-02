/**
 * GIT PANEL — View branches, commits, and PRs created by agents
 *
 * Shows all git branches created by missions, their commit counts,
 * PR status, and links to GitHub.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  GitMerge,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; color: string; bgColor: string }> = {
  active: { icon: Clock, label: "Active", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  pr_created: { icon: GitPullRequest, label: "PR Open", color: "text-purple-400", bgColor: "bg-purple-500/10" },
  merged: { icon: GitMerge, label: "Merged", color: "text-green-400", bgColor: "bg-green-500/10" },
  closed: { icon: XCircle, label: "Closed", color: "text-red-400", bgColor: "bg-red-500/10" },
};

interface GitPanelProps {
  projectId: Id<"projects"> | null;
}

export function GitPanel({ projectId }: GitPanelProps) {
  const branches = useQuery(
    api.gitops.getProjectBranches,
    projectId ? { projectId } : "skip"
  );

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        <p className="text-sm">Select a project to view git activity</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <GitBranch className="h-4 w-4 text-chart-3" />
        <span className="text-sm font-semibold">Git Activity</span>
        {branches && branches.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {branches.length} branches
          </Badge>
        )}
      </div>

      {/* Branch list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {!branches || branches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <GitBranch className="h-6 w-6 mb-2 opacity-40" />
              <p className="text-xs font-medium">No branches yet</p>
              <p className="text-[10px] text-center mt-1">
                Branches are auto-created when missions launch
              </p>
            </div>
          ) : (
            branches.map((branch) => {
              const status = STATUS_CONFIG[branch.status] || STATUS_CONFIG.active;
              const StatusIcon = status.icon;
              const created = new Date(branch.createdAt);
              const timeStr = created.toLocaleDateString([], { month: "short", day: "numeric" }) +
                " " + created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

              return (
                <div
                  key={branch._id}
                  className={cn(
                    "rounded-lg border border-border/50 p-3 space-y-2",
                    status.bgColor
                  )}
                >
                  {/* Branch name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GitBranch className="h-3.5 w-3.5 text-chart-3 shrink-0" />
                      <span className="text-xs font-mono font-medium truncate">
                        {branch.branchName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusIcon className={cn("h-3 w-3", status.color)} />
                      <span className={cn("text-[10px] font-medium", status.color)}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      {branch.commits} commits
                    </span>
                    <span>from {branch.baseBranch}</span>
                    <span>{timeStr}</span>
                  </div>

                  {/* PR link */}
                  {branch.prUrl && (
                    <a
                      href={branch.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <GitPullRequest className="h-3 w-3" />
                      PR #{branch.prNumber}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
