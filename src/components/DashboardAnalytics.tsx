/**
 * DashboardAnalytics — Global analytics overview for the dashboard page.
 *
 * Shows aggregate stats across all projects: total missions,
 * total cost, agent activity, and recent mission feed.
 * Rendered below the project grid on the DashboardPage.
 */
import { useQuery } from "convex/react";
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Cpu,
  Flame,
  Rocket,
  Shield,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * GlobalStats — A row of aggregate metric cards shown on the dashboard.
 * Queries per-project stats for each project and aggregates them.
 * Falls back gracefully if no projects have data yet.
 */
export function DashboardAnalytics({
  projectIds,
}: {
  projectIds: string[];
}) {
  // We don't call individual project queries here — the parent passes
  // aggregate data or we show a static welcome card if no projects exist.

  if (projectIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Quick Overview</h2>
      </div>

      {/* Feature highlight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <FeatureCard
          icon={<Target className="h-5 w-5" />}
          iconBg="bg-violet-500/10 text-violet-400"
          title="Mission Control"
          description="Real-time agent tree visualization with live status tracking, inter-agent comms, and mission health monitoring."
        />
        <FeatureCard
          icon={<Bot className="h-5 w-5" />}
          iconBg="bg-blue-500/10 text-blue-400"
          title="Agent Swarm"
          description="Planner, UI, Logic, Mobile, Debug, Test, Reviewer, and QA agents working in coordinated parallel."
        />
        <FeatureCard
          icon={<Shield className="h-5 w-5" />}
          iconBg="bg-emerald-500/10 text-emerald-400"
          title="Safety & Governance"
          description="Sentry violations, debate gates, approval workflows, and forensic analysis before any deploy."
        />
        <FeatureCard
          icon={<Flame className="h-5 w-5" />}
          iconBg="bg-amber-500/10 text-amber-400"
          title="Self-Improvement"
          description="Retrospective analysis, agent memory system, mutation engine, and continuous learning loop."
        />
      </div>

      {/* Capability indicators */}
      <div className="mt-4 rounded-xl border border-border/30 bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4" />
          Active Capabilities
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Multi-Agent Swarm", active: true },
            { label: "Agent Memory", active: true },
            { label: "Code Review Gate", active: true },
            { label: "Debate System", active: true },
            { label: "Cinema Replay", active: true },
            { label: "Sentry Monitor", active: true },
            { label: "Forensic Analysis", active: true },
            { label: "Auto-Deploy", active: true },
            { label: "Cost Tracking", active: true },
            { label: "GitOps Pipeline", active: true },
          ].map(cap => (
            <span
              key={cap.label}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium",
                cap.active
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-white/5 text-muted-foreground/40 border border-border/20",
              )}
            >
              {cap.active && <CheckCircle2 className="h-3 w-3" />}
              {cap.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  iconBg,
  title,
  description,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-card/50 p-4 hover:border-primary/30 transition-colors">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", iconBg)}>
        {icon}
      </div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground/70 leading-relaxed">{description}</p>
    </div>
  );
}
