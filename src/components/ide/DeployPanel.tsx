/**
 * DEPLOY PANEL — Track deployment status and history
 *
 * Shows deployment records, their status, provider info,
 * and links to live URLs.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Rocket,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
  Globe,
  Server,
} from "lucide-react";

const DEPLOY_STATUS: Record<string, { icon: typeof Clock; label: string; color: string; bgColor: string }> = {
  pending: { icon: Clock, label: "Pending", color: "text-yellow-400", bgColor: "bg-yellow-500/10" },
  deploying: { icon: Loader2, label: "Deploying", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  success: { icon: CheckCircle, label: "Live", color: "text-green-400", bgColor: "bg-green-500/10" },
  failed: { icon: XCircle, label: "Failed", color: "text-red-400", bgColor: "bg-red-500/10" },
};

interface DeployPanelProps {
  projectId: Id<"projects"> | null;
}

export function DeployPanel({ projectId }: DeployPanelProps) {
  const deployments = useQuery(
    api.autodeploy.listByProject,
    projectId ? { projectId } : "skip"
  );

  const latest = useQuery(
    api.autodeploy.getLatest,
    projectId ? { projectId } : "skip"
  );

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        <p className="text-sm">Select a project to view deployments</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Rocket className="h-4 w-4 text-chart-3" />
        <span className="text-sm font-semibold">Deployments</span>
        {deployments && deployments.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {deployments.length}
          </Badge>
        )}
      </div>

      {/* Latest deploy banner */}
      {latest && (
        <div className={cn(
          "mx-2 mt-2 rounded-lg border border-border/50 p-2.5",
          DEPLOY_STATUS[latest.status]?.bgColor || "bg-muted"
        )}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              {latest.status === "deploying" ? (
                <Loader2 className={cn("h-3.5 w-3.5 animate-spin", DEPLOY_STATUS[latest.status]?.color)} />
              ) : (
                (() => {
                  const StatusIcon = DEPLOY_STATUS[latest.status]?.icon || Clock;
                  return <StatusIcon className={cn("h-3.5 w-3.5", DEPLOY_STATUS[latest.status]?.color)} />;
                })()
              )}
              <span className="text-xs font-semibold">Latest Deploy</span>
            </div>
            <Badge
              variant="outline"
              className={cn("text-[9px] h-4", DEPLOY_STATUS[latest.status]?.color)}
            >
              {DEPLOY_STATUS[latest.status]?.label || latest.status}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              {latest.provider}
            </span>
            <span>{latest.environment}</span>
          </div>

          {latest.url && (
            <a
              href={latest.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 mt-1.5 text-[11px] text-green-400 hover:text-green-300 transition-colors"
            >
              <Globe className="h-3 w-3" />
              {latest.url}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}

          {latest.message && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
              {latest.message}
            </p>
          )}
        </div>
      )}

      {/* Deploy history */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {!deployments || deployments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Rocket className="h-6 w-6 mb-2 opacity-40" />
              <p className="text-xs font-medium">No deployments yet</p>
              <p className="text-[10px] text-center mt-1">
                Auto-deploy triggers when missions complete
              </p>
            </div>
          ) : (
            deployments.map((deploy) => {
              const status = DEPLOY_STATUS[deploy.status] || DEPLOY_STATUS.pending;
              const StatusIcon = deploy.status === "deploying" ? Loader2 : status.icon;
              const started = new Date(deploy.startedAt);
              const timeStr = started.toLocaleDateString([], { month: "short", day: "numeric" }) +
                " " + started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

              const duration = deploy.completedAt
                ? Math.round((deploy.completedAt - deploy.startedAt) / 1000)
                : null;

              return (
                <div
                  key={deploy._id}
                  className="flex items-center gap-2 rounded-lg border border-border/30 px-2.5 py-2 hover:bg-muted/20 transition-colors"
                >
                  <StatusIcon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      status.color,
                      deploy.status === "deploying" && "animate-spin"
                    )}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium truncate">
                        {deploy.environment}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        via {deploy.provider}
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {timeStr}
                      {duration !== null && ` • ${duration}s`}
                      {deploy.triggeredBy && deploy.triggeredBy !== "system" && (
                        <span> • by {deploy.triggeredBy}</span>
                      )}
                    </div>
                  </div>

                  {deploy.url && (
                    <a
                      href={deploy.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-chart-3 hover:text-chart-3/80 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
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
