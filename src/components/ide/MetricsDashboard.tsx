/**
 * MetricsDashboard.tsx — Live Metrics Dashboard
 *
 * Real-time charts for cost, token usage, latency, and agent performance.
 * Uses lightweight inline SVG charts (no external charting library).
 *
 * Charts:
 *  1. Token Usage Over Time — area chart of input/output tokens
 *  2. Cost Breakdown — horizontal bar chart by model
 *  3. Mission Latency — bar chart with per-mission timing
 *  4. Agent Performance Comparison — radar-style scoring grid
 *
 * Wired to existing dashboard.getCostBreakdown, dashboard.getMissionTimeline,
 * and benchmarkRuns Convex tables. Frontend-only — no schema changes.
 */

import { useQuery } from "convex/react";
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Cpu,
  Layers,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  projectId: Id<"projects">;
}

// ─── Lightweight SVG Mini Charts ─────────────────────────────────────────────

/** Sparkline / area chart */
function AreaChart({
  data,
  color = "#22c55e",
  height = 60,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  if (data.length < 2) {
    return (
      <div
        className={cn("flex items-center justify-center text-[10px] text-muted-foreground/40", className)}
        style={{ height }}
      >
        Not enough data
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const w = 100;
  const h = height;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => ({
    x: i * step,
    y: h - (v / max) * (h - 8) - 4,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]!.x} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)} style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots on last 3 points */}
      {points.slice(-3).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />
      ))}
    </svg>
  );
}

/** Horizontal bar chart */
function HBarChart({
  items,
  height = 120,
}: {
  items: { label: string; value: number; color: string; display: string }[];
  height?: number;
}) {
  const max = Math.max(...items.map(i => i.value), 1);

  return (
    <div className="space-y-2" style={{ minHeight: height }}>
      {items.map(item => (
        <div key={item.label} className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground truncate">{item.label}</span>
            <span className="text-foreground font-mono shrink-0 ml-2">{item.display}</span>
          </div>
          <div className="h-2 rounded-full bg-black/30 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Vertical bar chart */
function VBarChart({
  data,
  labels,
  colors,
  height = 80,
}: {
  data: number[];
  labels: string[];
  colors?: string[];
  height?: number;
}) {
  const max = Math.max(...data, 1);
  const defaultColors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * (height - 16));
        const color = colors?.[i] ?? defaultColors[i % defaultColors.length]!;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[8px] text-muted-foreground/60 font-mono">{v || ""}</span>
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                height: barH,
                backgroundColor: color,
                opacity: 0.7,
              }}
            />
            <span className="text-[8px] text-muted-foreground/40 truncate w-full text-center">
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  children,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: number; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/20 bg-card/30 overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-3">
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
            `bg-${color}/10 border-${color}/20`,
          )}
          style={{
            backgroundColor: `color-mix(in oklch, ${color} 10%, transparent)`,
            borderColor: `color-mix(in oklch, ${color} 20%, transparent)`,
          }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-foreground font-mono">{value}</span>
            {trend && (
              <span
                className={cn(
                  "text-[9px] font-semibold flex items-center gap-0.5",
                  trend.value >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                <TrendingUp
                  className={cn("h-2.5 w-2.5", trend.value < 0 && "rotate-180")}
                />
                {Math.abs(trend.value)}% {trend.label}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/60 truncate">{title}</p>
        </div>
      </div>
      {subtitle && (
        <div className="px-3 pb-2">
          <p className="text-[9px] text-muted-foreground/40">{subtitle}</p>
        </div>
      )}
      {children && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

type TimeRange = "7d" | "14d" | "30d";

export function MetricsDashboard({ projectId }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [expandedSection, setExpandedSection] = useState<string | null>("overview");

  const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;

  const dashboard = useQuery(api.dashboard.getDashboard, { projectId });
  const costData = useQuery(api.dashboard.getCostBreakdown, {
    projectId,
    days,
  });
  const timeline = useQuery(api.dashboard.getMissionTimeline, {
    projectId,
    days,
  });

  // Derive chart data
  const tokenChartData = useMemo(() => {
    if (!costData?.byModel) return [];
    return Object.values(costData.byModel).map((m: any) => m.tokens || 0);
  }, [costData]);

  const costBarItems = useMemo(() => {
    if (!costData?.byModel) return [];
    const modelColors: Record<string, string> = {
      "deepseek-v4-flash": "#10b981",
      "deepseek-v3.2": "#22c55e",
      "grok-4.1-fast": "#3b82f6",
      "gpt-5-mini": "#a855f7",
      "claude-opus-5": "#f59e0b",
    };

    return Object.entries(costData.byModel)
      .sort(([, a]: any, [, b]: any) => b.cost - a.cost)
      .map(([model, data]: [string, any]) => ({
        label: model,
        value: data.cost,
        color: modelColors[model] ?? "#6b7280",
        display: `$${data.cost.toFixed(4)}`,
      }));
  }, [costData]);

  const missionTimelineData = useMemo(() => {
    if (!timeline) return { dates: [] as string[], success: [] as number[], fail: [] as number[] };
    return {
      dates: timeline.map((t: any) => t.date?.slice(5) ?? ""),
      success: timeline.map((t: any) => t.success ?? 0),
      fail: timeline.map((t: any) => t.fail ?? 0),
    };
  }, [timeline]);

  // Agent performance from benchmarks
  const agentPerformance = useMemo(() => {
    if (!dashboard?.benchmarks?.recent) return [];
    return dashboard.benchmarks.recent.map((b: any) => ({
      role: b.role ?? "unknown",
      modelA: b.modelA ?? "",
      modelB: b.modelB ?? "",
      scoreA: b.scoreA ?? 0,
      scoreB: b.scoreB ?? 0,
      winner: b.winner ?? "tie",
    }));
  }, [dashboard]);

  const isLoading = !dashboard || !costData || !timeline;

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 bg-[oklch(0.11_0.02_260)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-teal-400/10 border border-teal-500/20 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-teal-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Live Metrics</h2>
              <p className="text-[10px] text-muted-foreground">
                Real-time cost, tokens & performance
              </p>
            </div>
          </div>

          {/* Time range selector */}
          <div className="flex items-center gap-1 bg-black/20 rounded-lg p-0.5 border border-border/20">
            {(["7d", "14d", "30d"] as TimeRange[]).map(range => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
                  timeRange === range
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground/50 hover:text-muted-foreground",
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-muted-foreground">Loading metrics...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ── Overview Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                title="Total Cost"
                value={`$${costData.totalCostUsd.toFixed(2)}`}
                icon={<CircleDollarSign className="h-4 w-4" />}
                color="#f59e0b"
                subtitle={`${days}-day period`}
              />
              <MetricCard
                title="Missions"
                value={`${dashboard.missions.total}`}
                icon={<Zap className="h-4 w-4" />}
                color="#3b82f6"
                trend={
                  dashboard.missions.successRate > 0
                    ? {
                        value: dashboard.missions.successRate,
                        label: "success",
                      }
                    : undefined
                }
              />
              <MetricCard
                title="Running"
                value={`${dashboard.missions.running}`}
                icon={<Activity className="h-4 w-4" />}
                color="#22c55e"
              />
              <MetricCard
                title="Errors"
                value={`${dashboard.missions.failed}`}
                icon={<Layers className="h-4 w-4" />}
                color="#ef4444"
              />
            </div>

            {/* ── Token Usage Chart ──────────────────────────────── */}
            <CollapsibleSection
              id="tokens"
              title="Token Usage"
              icon={<Cpu className="h-3.5 w-3.5" />}
              color="text-cyan-400"
              expanded={expandedSection === "tokens"}
              onToggle={() => toggleSection("tokens")}
            >
              <div className="space-y-2">
                <AreaChart
                  data={tokenChartData.length > 0 ? tokenChartData : [0, 0]}
                  color="#06b6d4"
                  height={70}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground/40 px-1">
                  <span>By model</span>
                  <span>
                    {Object.values(costData.byModel)
                      .reduce((s: number, m: any) => s + (m.tokens || 0), 0)
                      .toLocaleString()}{" "}
                    total tokens
                  </span>
                </div>
              </div>
            </CollapsibleSection>

            {/* ── Cost Breakdown ──────────────────────────────────── */}
            <CollapsibleSection
              id="cost"
              title="Cost Breakdown"
              icon={<CircleDollarSign className="h-3.5 w-3.5" />}
              color="text-amber-400"
              expanded={expandedSection === "cost"}
              onToggle={() => toggleSection("cost")}
            >
              {costBarItems.length > 0 ? (
                <HBarChart items={costBarItems} />
              ) : (
                <EmptyState text="No cost data in this period" />
              )}
            </CollapsibleSection>

            {/* ── Mission Timeline ────────────────────────────────── */}
            <CollapsibleSection
              id="missions"
              title="Mission Timeline"
              icon={<Activity className="h-3.5 w-3.5" />}
              color="text-green-400"
              expanded={expandedSection === "missions"}
              onToggle={() => toggleSection("missions")}
            >
              {missionTimelineData.dates.length > 0 ? (
                <div className="space-y-2">
                  <AreaChart
                    data={missionTimelineData.success}
                    color="#22c55e"
                    height={60}
                  />
                  {missionTimelineData.fail.some(v => v > 0) && (
                    <AreaChart
                      data={missionTimelineData.fail}
                      color="#ef4444"
                      height={30}
                    />
                  )}
                  <div className="flex justify-between text-[9px] text-muted-foreground/40 px-1">
                    <span className="text-green-400/60">
                      ● Success ({missionTimelineData.success.reduce((a, b) => a + b, 0)})
                    </span>
                    <span className="text-red-400/60">
                      ● Failures ({missionTimelineData.fail.reduce((a, b) => a + b, 0)})
                    </span>
                  </div>
                </div>
              ) : (
                <EmptyState text="No missions in this period" />
              )}
            </CollapsibleSection>

            {/* ── Agent Performance ───────────────────────────────── */}
            <CollapsibleSection
              id="agents"
              title="Agent Performance"
              icon={<Zap className="h-3.5 w-3.5" />}
              color="text-violet-400"
              expanded={expandedSection === "agents"}
              onToggle={() => toggleSection("agents")}
            >
              {agentPerformance.length > 0 ? (
                <div className="space-y-2">
                  {agentPerformance.map((perf: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/15 bg-black/10"
                    >
                      <span className="text-[10px] font-semibold text-violet-400 w-20 truncate">
                        {perf.role}
                      </span>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1">
                          <div className="flex justify-between text-[9px] mb-0.5">
                            <span className="text-blue-400 truncate">{perf.modelA}</span>
                            <span className="text-blue-400 font-mono">{perf.scoreA}</span>
                          </div>
                          <div className="h-1 rounded-full bg-black/30 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-400 transition-all"
                              style={{ width: `${Math.min(100, perf.scoreA * 10)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[8px] text-muted-foreground/30 shrink-0">vs</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-[9px] mb-0.5">
                            <span className="text-amber-400 truncate">{perf.modelB}</span>
                            <span className="text-amber-400 font-mono">{perf.scoreB}</span>
                          </div>
                          <div className="h-1 rounded-full bg-black/30 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-400 transition-all"
                              style={{ width: `${Math.min(100, perf.scoreB * 10)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[9px] font-bold shrink-0 w-4 text-center",
                          perf.winner === "A"
                            ? "text-blue-400"
                            : perf.winner === "B"
                              ? "text-amber-400"
                              : "text-muted-foreground/40",
                        )}
                      >
                        {perf.winner === "tie" ? "=" : perf.winner}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No benchmark data yet" />
              )}
            </CollapsibleSection>

            {/* ── Latency Stats ───────────────────────────────────── */}
            <CollapsibleSection
              id="latency"
              title="Debate Latency"
              icon={<Clock className="h-3.5 w-3.5" />}
              color="text-orange-400"
              expanded={expandedSection === "latency"}
              onToggle={() => toggleSection("latency")}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="px-2 py-1.5 rounded-md border border-border/15 bg-black/10">
                  <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                    Avg Duration
                  </span>
                  <p className="text-sm font-bold text-orange-400 font-mono">
                    {dashboard.debates.avgDurationMs > 0
                      ? `${(dashboard.debates.avgDurationMs / 1000).toFixed(1)}s`
                      : "—"}
                  </p>
                </div>
                <div className="px-2 py-1.5 rounded-md border border-border/15 bg-black/10">
                  <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                    Avg Confidence
                  </span>
                  <p className="text-sm font-bold text-emerald-400 font-mono">
                    {dashboard.debates.avgConfidence > 0
                      ? `${dashboard.debates.avgConfidence}%`
                      : "—"}
                  </p>
                </div>
                <div className="px-2 py-1.5 rounded-md border border-border/15 bg-black/10">
                  <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                    Total Debates
                  </span>
                  <p className="text-sm font-bold text-foreground font-mono">
                    {dashboard.debates.total}
                  </p>
                </div>
                <div className="px-2 py-1.5 rounded-md border border-border/15 bg-black/10">
                  <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                    Proceed Rate
                  </span>
                  <p className="text-sm font-bold text-green-400 font-mono">
                    {dashboard.debates.total > 0
                      ? `${Math.round(
                          (dashboard.debates.proceed / dashboard.debates.total) * 100,
                        )}%`
                      : "—"}
                  </p>
                </div>
              </div>
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CollapsibleSection({
  id,
  title,
  icon,
  color,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/20 bg-card/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className={cn("shrink-0", color)}>{icon}</div>
        <span className={cn("text-[11px] font-bold uppercase tracking-wider flex-1", color)}>
          {title}
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        )}
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-4">
      <p className="text-[10px] text-muted-foreground/30">{text}</p>
    </div>
  );
}
