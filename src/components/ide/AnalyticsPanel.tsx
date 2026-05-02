/**
 * ANALYTICS PANEL — Mission metrics and project insights
 *
 * Displays cost breakdowns, agent performance, model usage,
 * and mission history at a glance.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Code2,
  DollarSign,
  Loader2,
  Rocket,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, subValue, color }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border/30 p-2.5 bg-background/30">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("h-3 w-3", color)} />
        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-base font-bold">{value}</p>
      {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-background/50 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface AnalyticsPanelProps {
  projectId: Id<"projects"> | null;
}

export function AnalyticsPanel({ projectId }: AnalyticsPanelProps) {
  const stats = useQuery(api.analytics.getProjectStats, projectId ? { projectId } : "skip");
  const modelUsage = useQuery(api.analytics.getModelUsage, projectId ? { projectId } : "skip");
  const rolePerf = useQuery(api.analytics.getRolePerformance, projectId ? { projectId } : "skip");
  const recentMissions = useQuery(api.analytics.getRecentMissions, projectId ? { projectId } : "skip");

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        <p className="text-sm">Select a project to view analytics</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
        <BarChart3 className="h-4 w-4 text-chart-2" />
        <span className="text-sm font-semibold">Analytics</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Overview Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                icon={Rocket}
                label="Missions"
                value={String(stats.totalMissions)}
                subValue={`${stats.completedMissions} done, ${stats.activeMissions} active`}
                color="text-purple-400"
              />
              <StatCard
                icon={DollarSign}
                label="Total Cost"
                value={`$${stats.totalCost.toFixed(3)}`}
                subValue={stats.totalMissions > 0 ? `$${(stats.totalCost / stats.totalMissions).toFixed(3)}/mission` : undefined}
                color="text-chart-2"
              />
              <StatCard
                icon={Bot}
                label="Agents"
                value={String(stats.totalAgents)}
                subValue={`~${stats.avgAgentsPerMission} per mission`}
                color="text-chart-3"
              />
              <StatCard
                icon={Clock}
                label="Avg Duration"
                value={stats.avgMissionDuration > 60 ? `${(stats.avgMissionDuration / 60).toFixed(1)}m` : `${stats.avgMissionDuration}s`}
                subValue={`${stats.totalFilesCreated} files created`}
                color="text-cyan-400"
              />
            </div>
          )}

          {/* Model Usage */}
          {modelUsage && modelUsage.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Model Usage
              </h3>
              <div className="space-y-2">
                {modelUsage.map(m => {
                  const maxRuns = Math.max(...modelUsage.map(x => x.runs));
                  return (
                    <div key={m.model} className="rounded-lg border border-border/30 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium truncate">{m.model}</span>
                        <Badge variant="outline" className="text-[9px] h-4">{m.runs} runs</Badge>
                      </div>
                      <MiniBar value={m.runs} max={maxRuns} color="bg-chart-3" />
                      <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground">
                        <span className="text-green-400">{m.completed} ✓</span>
                        {m.failed > 0 && <span className="text-red-400">{m.failed} ✗</span>}
                        <span className="text-chart-2">${m.totalCost.toFixed(3)}</span>
                        {m.avgDuration > 0 && <span>{m.avgDuration}s avg</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Role Performance */}
          {rolePerf && rolePerf.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Target className="h-3 w-3" /> Role Performance
              </h3>
              <div className="space-y-1.5">
                {rolePerf.map(r => (
                  <div key={r.role} className="flex items-center gap-2 rounded-lg border border-border/30 px-2.5 py-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium capitalize">{r.role}</span>
                        <span className="text-[9px] text-muted-foreground">×{r.runs}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
                        {r.filesCreated > 0 && <span className="text-chart-3">{r.filesCreated} files</span>}
                        <span className="text-chart-2">${r.totalCost.toFixed(3)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn(
                        "text-xs font-bold",
                        r.successRate >= 80 ? "text-green-400" :
                        r.successRate >= 50 ? "text-amber-400" : "text-red-400"
                      )}>{r.successRate}%</span>
                      <p className="text-[8px] text-muted-foreground">success</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Missions */}
          {recentMissions && recentMissions.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Recent Missions
              </h3>
              <div className="space-y-1.5">
                {recentMissions.map(m => {
                  const date = new Date(m.startedAt);
                  const timeStr = date.toLocaleDateString([], { month: "short", day: "numeric" }) +
                    " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                  return (
                    <div key={m._id} className="rounded-lg border border-border/30 px-2.5 py-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {m.status === "completed" && <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />}
                        {m.status === "failed" && <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
                        {(m.status === "running" || m.status === "planning") && <Loader2 className="h-3 w-3 text-chart-3 animate-spin shrink-0" />}
                        <span className="text-[11px] font-medium truncate">{m.prompt}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <span>{timeStr}</span>
                        <span>{m.totalAgentsSpawned} agents</span>
                        {m.totalCost > 0 && <span className="text-chart-2">${m.totalCost.toFixed(3)}</span>}
                        {m.duration != null && <span>{m.duration}s</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {stats && stats.totalMissions === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs font-medium">No data yet</p>
              <p className="text-[10px] text-center mt-1">Launch missions to see analytics</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
