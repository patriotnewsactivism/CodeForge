/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — AGENT MEMORY DASHBOARD
 * ═══════════════════════════════════════════════════════════════════
 *
 * Visual dashboard showing how CodeForge is getting smarter:
 * - Active memories by category
 * - Retrospective scores over time
 * - Memory importance heatmap
 * - Toggle/delete memories
 * - Intelligence stats
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Zap,
  TrendingUp,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Target,
  Shield,
  Lightbulb,
  Code,
  AlertTriangle,
  BarChart3,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

interface MemoryDashboardProps {
  projectId: Id<"projects"> | null;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Brain; color: string; label: string }> = {
  pattern: { icon: Code, color: "text-blue-400 bg-blue-500/10", label: "Patterns" },
  pitfall: { icon: AlertTriangle, color: "text-red-400 bg-red-500/10", label: "Pitfalls" },
  preference: { icon: Target, color: "text-purple-400 bg-purple-500/10", label: "Preferences" },
  architecture: { icon: Shield, color: "text-emerald-400 bg-emerald-500/10", label: "Architecture" },
  optimization: { icon: Zap, color: "text-amber-400 bg-amber-500/10", label: "Optimization" },
  general: { icon: Brain, color: "text-cyan-400 bg-cyan-500/10", label: "General" },
  style: { icon: Sparkles, color: "text-pink-400 bg-pink-500/10", label: "Style" },
};

function getCategoryConfig(cat: string) {
  return CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.general;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ImportanceBar({ value }: { value: number }) {
  const bars = 5;
  const filled = Math.min(bars, Math.max(0, Math.round((value / 10) * bars)));
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-2.5 w-1.5 rounded-[1px] transition-colors",
            i < filled
              ? filled >= 4
                ? "bg-emerald-400"
                : filled >= 2
                ? "bg-amber-400"
                : "bg-red-400"
              : "bg-white/5"
          )}
        />
      ))}
    </div>
  );
}

export function MemoryDashboard({ projectId }: MemoryDashboardProps) {
  const memories = useQuery(
    api.intelligence.listMemories,
    projectId ? { projectId } : "skip"
  );
  const stats = useQuery(
    api.intelligence.getProjectStats,
    projectId ? { projectId } : "skip"
  );

  const toggleMemory = useMutation(api.intelligence.toggleMemory);
  const deleteMemory = useMutation(api.intelligence.deleteMemory);

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [view, setView] = useState<"memories" | "stats">("memories");

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-white/30">
        <p className="text-sm">Select a project to view memories</p>
      </div>
    );
  }

  // Group memories by category
  const grouped: Record<string, typeof memories> = {};
  for (const mem of memories || []) {
    const cat = mem.category || "general";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(mem);
  }

  const handleToggle = async (id: Id<"memories">, current: boolean) => {
    await toggleMemory({ memoryId: id, isActive: !current });
    toast.success(current ? "Memory deactivated" : "Memory reactivated");
  };

  const handleDelete = async (id: Id<"memories">) => {
    await deleteMemory({ memoryId: id });
    toast.success("Memory deleted");
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white/70">Agent Memory</span>
          {memories && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-white/40">
              {memories.length}
            </Badge>
          )}
        </div>
        <div className="flex gap-0.5 bg-white/[0.03] rounded-md p-0.5">
          <button
            onClick={() => setView("memories")}
            className={cn(
              "px-2 py-0.5 text-[10px] font-semibold rounded transition-colors",
              view === "memories" ? "bg-emerald-500/20 text-emerald-400" : "text-white/30 hover:text-white/50"
            )}
          >
            Memories
          </button>
          <button
            onClick={() => setView("stats")}
            className={cn(
              "px-2 py-0.5 text-[10px] font-semibold rounded transition-colors",
              view === "stats" ? "bg-emerald-500/20 text-emerald-400" : "text-white/30 hover:text-white/50"
            )}
          >
            Stats
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {view === "stats" && stats ? (
          <StatsView stats={stats} />
        ) : view === "memories" ? (
          <div className="p-2 space-y-1">
            {Object.entries(grouped).length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-white/20">
                <Brain className="h-10 w-10 opacity-50" />
                <p className="text-xs text-center">
                  No memories yet.
                  <br />
                  Run a mission and CodeForge will start learning!
                </p>
              </div>
            )}

            {Object.entries(grouped)
              .sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0))
              .map(([category, mems]) => {
                const config = getCategoryConfig(category);
                const isExpanded = expandedCategory === category;
                const active = (mems || []).filter((m) => m.isActive).length;

                return (
                  <div key={category} className="rounded-lg overflow-hidden border border-white/[0.04]">
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-white/30" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-white/30" />
                      )}
                      <div className={cn("p-1 rounded", config.color.split(" ")[1])}>
                        <config.icon className={cn("h-3.5 w-3.5", config.color.split(" ")[0])} />
                      </div>
                      <span className="text-xs font-medium text-white/70 flex-1 text-left">
                        {config.label}
                      </span>
                      <span className="text-[10px] text-white/30">
                        {active}/{(mems || []).length} active
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-white/[0.03] bg-white/[0.01]">
                        {(mems || []).map((mem) => (
                          <div
                            key={mem._id}
                            className={cn(
                              "px-3 py-2 border-b border-white/[0.02] last:border-0",
                              !mem.isActive && "opacity-40"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                {mem.title && (
                                  <p className="text-[11px] font-semibold text-white/60 mb-0.5 truncate">
                                    {mem.title}
                                  </p>
                                )}
                                <p className="text-[11px] text-white/40 leading-relaxed line-clamp-3">
                                  {mem.content}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  {mem.importance != null && (
                                    <div className="flex items-center gap-1">
                                      <Flame className="h-2.5 w-2.5 text-white/20" />
                                      <ImportanceBar value={mem.importance} />
                                    </div>
                                  )}
                                  {mem.useCount != null && mem.useCount > 0 && (
                                    <span className="text-[9px] text-white/20">
                                      Used {mem.useCount}×
                                    </span>
                                  )}
                                  {mem._creationTime && (
                                    <span className="text-[9px] text-white/15">
                                      {timeAgo(mem._creationTime)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-0.5 shrink-0">
                                <button
                                  onClick={() => handleToggle(mem._id, mem.isActive)}
                                  className="p-1 rounded hover:bg-white/5 text-white/20 hover:text-white/50 transition-colors"
                                  title={mem.isActive ? "Deactivate" : "Reactivate"}
                                >
                                  {mem.isActive ? (
                                    <Eye className="h-3 w-3" />
                                  ) : (
                                    <EyeOff className="h-3 w-3" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDelete(mem._id)}
                                  className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
                                  title="Delete memory"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Stats Sub-View ──────────────────────────────────────────────

function StatsView({ stats }: { stats: {
  totalMemories: number;
  activeMemories: number;
  totalRetrospectives: number;
  totalMissions: number;
  completedMissions: number;
  totalAgentRuns: number;
  successfulAgents: number;
  agentSuccessRate: number;
  avgRetroScore: number;
  categoryBreakdown: Record<string, number>;
} }) {
  const categories = Object.entries(stats.categoryBreakdown).sort(
    (a, b) => b[1] - a[1]
  );
  const maxCat = categories.length > 0 ? categories[0][1] : 1;

  return (
    <div className="p-3 space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={Brain}
          label="Active Memories"
          value={stats.activeMemories}
          subtext={`of ${stats.totalMemories} total`}
          color="text-emerald-400"
        />
        <StatCard
          icon={Target}
          label="Missions"
          value={stats.completedMissions}
          subtext={`of ${stats.totalMissions} total`}
          color="text-blue-400"
        />
        <StatCard
          icon={Zap}
          label="Agents Spawned"
          value={stats.totalAgentRuns}
          subtext={`${stats.agentSuccessRate}% success`}
          color="text-amber-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Retro Score"
          value={stats.avgRetroScore}
          subtext={`from ${stats.totalRetrospectives} retros`}
          color="text-purple-400"
        />
      </div>

      {/* Category Breakdown */}
      <div>
        <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">
          Memory Categories
        </h4>
        <div className="space-y-1.5">
          {categories.map(([cat, count]) => {
            const config = getCategoryConfig(cat);
            return (
              <div key={cat} className="flex items-center gap-2">
                <config.icon className={cn("h-3.5 w-3.5 shrink-0", config.color.split(" ")[0])} />
                <span className="text-[11px] text-white/50 w-20 truncate">{config.label}</span>
                <div className="flex-1 h-2 bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", config.color.split(" ")[1]?.replace("/10", "/40"))}
                    style={{ width: `${(count / maxCat) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/30 w-6 text-right">{count}</span>
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="text-[11px] text-white/20 text-center py-4">No data yet</p>
          )}
        </div>
      </div>

      {/* Intelligence Level */}
      <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400">Intelligence Level</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-emerald-400">
            {getIntelligenceLevel(stats.activeMemories, stats.totalRetrospectives)}
          </span>
          <span className="text-[10px] text-white/30">
            / Level 10
          </span>
        </div>
        <p className="text-[10px] text-white/30 mt-1">
          {getIntelligenceMessage(stats.activeMemories, stats.totalRetrospectives)}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: typeof Brain;
  label: string;
  value: number;
  subtext: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <span className="text-[10px] text-white/30">{label}</span>
      </div>
      <p className="text-lg font-bold text-white/80">{value}</p>
      <p className="text-[9px] text-white/20">{subtext}</p>
    </div>
  );
}

function getIntelligenceLevel(memories: number, retros: number): number {
  const score = memories * 2 + retros * 5;
  if (score >= 500) return 10;
  if (score >= 300) return 9;
  if (score >= 200) return 8;
  if (score >= 150) return 7;
  if (score >= 100) return 6;
  if (score >= 60) return 5;
  if (score >= 35) return 4;
  if (score >= 20) return 3;
  if (score >= 10) return 2;
  if (score >= 1) return 1;
  return 0;
}

function getIntelligenceMessage(memories: number, retros: number): string {
  const level = getIntelligenceLevel(memories, retros);
  const msgs = [
    "Brand new — no learnings yet. Run some missions!",
    "Just getting started. Every mission makes me smarter.",
    "Learning the basics of your codebase.",
    "Building solid pattern recognition.",
    "Getting good at avoiding past mistakes.",
    "Strong foundation — knows your preferences well.",
    "Advanced — anticipates issues before they happen.",
    "Expert level — deep understanding of your stack.",
    "Master — nearly perfect code generation.",
    "Legendary — your codebase has its own AI brain.",
    "Transcendent — beyond human comprehension. 🧠",
  ];
  return msgs[level] || msgs[0];
}
