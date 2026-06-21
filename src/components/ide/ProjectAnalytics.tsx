/**
 * ProjectAnalytics — In-IDE analytics overview for a project.
 *
 * Shows mission stats, agent performance, cost breakdown,
 * and deployment health in a compact panel format.
 * Designed to replace the basic AnalyticsDashboard with
 * richer, more actionable data.
 */
import { useQuery } from "convex/react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Cpu,
  Flame,
  GitBranch,
  Rocket,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface Props {
  projectId: Id<"projects">;
}

export function ProjectAnalytics({ projectId }: Props) {
  const dashboard = useQuery(api.dashboard.getDashboard, { projectId });
  const costData = useQuery(api.dashboard.getCostBreakdown, { projectId });
  const timeline = useQuery(api.dashboard.getMissionTimeline, { projectId });

  if (!dashboard) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <BarChart3 className="h-6 w-6 text-muted-foreground/20 animate-pulse" />
          <span className="text-[10px] text-muted-foreground/40">Loading analytics...</span>
        </div>
      </div>
    );
  }

  const { missions, deployments, violations, debates, learning, memories, incidents } = dashboard;

  return (
    <div className="h-full overflow-y-auto bg-[oklch(0.10_0.02_260)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Project Analytics
          </span>
        </div>
      </div>

      <div className="p-2 space-y-2">
        {/* ── Top Stats Grid ── */}
        <div className="grid grid-cols-2 gap-1.5">
          <StatCard
            icon={<Target className="h-3.5 w-3.5" />}
            iconColor="text-violet-400"
            label="Missions"
            value={missions.total}
            sub={`${missions.successRate}% success`}
            subColor={missions.successRate >= 80 ? "text-emerald-400" : "text-amber-400"}
          />
          <StatCard
            icon={<Cpu className="h-3.5 w-3.5" />}
            iconColor="text-blue-400"
            label="This Week"
            value={missions.last7Days}
            sub={`${missions.running} running`}
            subColor={missions.running > 0 ? "text-amber-400" : "text-muted-foreground/40"}
          />
          <StatCard
            icon={<Rocket className="h-3.5 w-3.5" />}
            iconColor="text-green-400"
            label="Deploys"
            value={deployments.total}
            sub={`${deployments.deployed} live`}
            subColor="text-emerald-400"
          />
          <StatCard
            icon={<CircleDollarSign className="h-3.5 w-3.5" />}
            iconColor="text-amber-400"
            label="Cost"
            value={costData ? `$${costData.totalCostUsd.toFixed(2)}` : "—"}
            sub={`${costData?.periodDays ?? 30}d period`}
            subColor="text-muted-foreground/40"
          />
        </div>

        {/* ── Mission Success/Fail Breakdown ── */}
        <div className="rounded-lg border border-border/30 bg-white/[0.02] p-2.5">
          <h3 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            Mission Outcomes
          </h3>
          <div className="flex gap-1 h-6 rounded-md overflow-hidden">
            {missions.total > 0 ? (
              <>
                {missions.completed > 0 && (
                  <div
                    className="bg-emerald-500/70 flex items-center justify-center transition-all"
                    style={{
                      width: `${(missions.completed / missions.total) * 100}%`,
                    }}
                  >
                    <span className="text-[8px] font-bold text-white/90">
                      {missions.completed}
                    </span>
                  </div>
                )}
                {missions.failed > 0 && (
                  <div
                    className="bg-red-500/70 flex items-center justify-center transition-all"
                    style={{
                      width: `${(missions.failed / missions.total) * 100}%`,
                    }}
                  >
                    <span className="text-[8px] font-bold text-white/90">
                      {missions.failed}
                    </span>
                  </div>
                )}
                {missions.running > 0 && (
                  <div
                    className="bg-amber-500/70 flex items-center justify-center transition-all animate-pulse"
                    style={{
                      width: `${(missions.running / missions.total) * 100}%`,
                    }}
                  >
                    <span className="text-[8px] font-bold text-white/90">
                      {missions.running}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 bg-white/5 flex items-center justify-center">
                <span className="text-[8px] text-muted-foreground/30">No missions yet</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[8px] text-emerald-400/70">
              <CheckCircle2 className="h-2.5 w-2.5" /> {missions.completed} completed
            </span>
            <span className="flex items-center gap-1 text-[8px] text-red-400/70">
              <XCircle className="h-2.5 w-2.5" /> {missions.failed} failed
            </span>
          </div>
        </div>

        {/* ── Security & Governance ── */}
        <div className="rounded-lg border border-border/30 bg-white/[0.02] p-2.5">
          <h3 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            Security & Governance
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat
              label="Violations"
              value={violations.total}
              detail={`${violations.blocked} blocked`}
              color={violations.bySeverity.critical > 0 ? "text-red-400" : "text-foreground/80"}
            />
            <MiniStat
              label="Debates"
              value={debates.total}
              detail={`${debates.avgConfidence}% conf.`}
              color="text-foreground/80"
            />
            <MiniStat
              label="24h Violations"
              value={violations.last24h}
              detail={`${violations.bySeverity.high} high`}
              color={violations.last24h > 5 ? "text-amber-400" : "text-foreground/80"}
            />
            <MiniStat
              label="Incidents"
              value={incidents.total}
              detail={`${incidents.open} open`}
              color={incidents.open > 0 ? "text-amber-400" : "text-foreground/80"}
            />
          </div>
        </div>

        {/* ── Learning Loop ── */}
        <div className="rounded-lg border border-border/30 bg-white/[0.02] p-2.5">
          <h3 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
            <Flame className="h-3 w-3" />
            Learning Loop
          </h3>
          {learning.latestHealthScore !== null && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[9px] mb-1">
                <span className="text-muted-foreground/50">System Health</span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    learning.latestHealthScore >= 7
                      ? "text-emerald-400"
                      : learning.latestHealthScore >= 4
                        ? "text-amber-400"
                        : "text-red-400",
                  )}
                >
                  {learning.latestHealthScore}/10
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    learning.latestHealthScore >= 7
                      ? "bg-emerald-400"
                      : learning.latestHealthScore >= 4
                        ? "bg-amber-400"
                        : "bg-red-400",
                  )}
                  style={{ width: `${learning.latestHealthScore * 10}%` }}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <MiniStat
              label="Memories"
              value={memories.total}
              detail={`${memories.avgImportance}% avg imp.`}
              color="text-foreground/80"
            />
            <MiniStat
              label="Lessons"
              value={learning.totalLessonsLearned}
              detail={`${learning.reflectionSessions} sessions`}
              color="text-foreground/80"
            />
            <MiniStat
              label="Mutations"
              value={learning.mutationsApplied}
              detail={`${learning.mutationsPending} pending`}
              color="text-foreground/80"
            />
            <MiniStat
              label="Forensics"
              value={learning.forensicReports}
              detail={`${learning.openForensic} open`}
              color={learning.openForensic > 0 ? "text-amber-400" : "text-foreground/80"}
            />
          </div>
        </div>

        {/* ── Recent Deployments ── */}
        {deployments.recent.length > 0 && (
          <div className="rounded-lg border border-border/30 bg-white/[0.02] p-2.5">
            <h3 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
              <GitBranch className="h-3 w-3" />
              Recent Deploys
            </h3>
            <div className="space-y-1">
              {deployments.recent.map((d: any) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 text-[10px] py-0.5"
                >
                  <DeployStatusDot status={d.status} />
                  <span className="font-mono text-foreground/70 truncate flex-1">
                    {d.branch ?? "main"}
                  </span>
                  <span className="text-[8px] text-muted-foreground/40 tabular-nums shrink-0">
                    {d.createdAt
                      ? new Date(d.createdAt).toLocaleDateString()
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Mini Sparkline — Mission Timeline ── */}
        {timeline && timeline.length > 0 && (
          <div className="rounded-lg border border-border/30 bg-white/[0.02] p-2.5">
            <h3 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" />
              30-Day Trend
            </h3>
            <MiniBarChart data={timeline} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconColor,
  label,
  value,
  sub,
  subColor,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string | number;
  sub: string;
  subColor: string;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-white/[0.02] p-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("shrink-0", iconColor)}>{icon}</span>
        <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-lg font-bold text-foreground/90 leading-none tabular-nums">{value}</p>
      <p className={cn("text-[9px] mt-0.5", subColor)}>{sub}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  color: string;
}) {
  return (
    <div>
      <span className="text-[9px] text-muted-foreground/40 block">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", color)}>{value}</span>
      <span className="text-[8px] text-muted-foreground/30 ml-1">{detail}</span>
    </div>
  );
}

function DeployStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    deployed: "bg-emerald-400",
    canary: "bg-amber-400 animate-pulse",
    awaiting_human: "bg-blue-400",
    ci_running: "bg-amber-400 animate-pulse",
    ci_failed: "bg-red-400",
    rolled_back: "bg-orange-400",
    pending_ci: "bg-gray-400",
    deploying: "bg-blue-400 animate-pulse",
  };
  return (
    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", colors[status] ?? "bg-gray-400")} />
  );
}

function MiniBarChart({
  data,
}: {
  data: Array<{ date: string; success: number; fail: number; total: number }>;
}) {
  const maxVal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="flex items-end gap-px h-10">
      {data.slice(-30).map(d => {
        const successH = (d.success / maxVal) * 100;
        const failH = (d.fail / maxVal) * 100;
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col justify-end gap-px min-w-0"
            title={`${d.date}: ${d.success} ok, ${d.fail} fail`}
          >
            {d.fail > 0 && (
              <div
                className="bg-red-400/60 rounded-t-sm min-h-[1px]"
                style={{ height: `${failH}%` }}
              />
            )}
            {d.success > 0 && (
              <div
                className="bg-emerald-400/60 rounded-t-sm min-h-[1px]"
                style={{ height: `${successH}%` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
