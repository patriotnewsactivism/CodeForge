/**
 * MEMORY PANEL — Visualize what the agent swarm has learned
 *
 * Shows all memories organized by category, confidence scores,
 * usage stats, and the improvement trend over time.
 * Users can boost or deactivate memories to guide the swarm.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  Lightbulb,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

// ─── Category Config ────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { emoji: string; label: string; color: string; bgColor: string }
> = {
  pattern: {
    emoji: "✅",
    label: "Patterns",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  antipattern: {
    emoji: "❌",
    label: "Anti-Patterns",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  convention: {
    emoji: "📏",
    label: "Conventions",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  bugfix: {
    emoji: "🐛",
    label: "Bug Fixes",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
  },
  architecture: {
    emoji: "🏗️",
    label: "Architecture",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  dependency: {
    emoji: "📦",
    label: "Dependencies",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
  preference: {
    emoji: "👤",
    label: "Preferences",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
  },
  performance: {
    emoji: "⚡",
    label: "Performance",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  security: {
    emoji: "🔒",
    label: "Security",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
  },
  general: {
    emoji: "💡",
    label: "General",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
  },
};

// ─── Component ──────────────────────────────────────────────────

interface MemoryPanelProps {
  projectId: Id<"projects"> | null;
  className?: string;
}

export function MemoryPanel({ projectId, className }: MemoryPanelProps) {
  const memories = useQuery(
    api.memory.listByProject,
    projectId ? { projectId } : "skip"
  );
  const stats = useQuery(
    api.memory.getStats,
    projectId ? { projectId } : "skip"
  );
  const scoreTrend = useQuery(
    api.retrospective.getScoreTrend,
    projectId ? { projectId } : "skip"
  );

  const boostMemory = useMutation(api.memory.boost);
  const deactivateMemory = useMutation(api.memory.deactivate);

  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});
  const [filter, setFilter] = useState<string>("all");

  if (!projectId) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full text-muted-foreground",
          className
        )}
      >
        <Brain className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">Select a project to view agent memory</p>
      </div>
    );
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Group memories by category
  const grouped: Record<string, typeof memories> = {};
  for (const m of memories || []) {
    if (filter !== "all" && m.category !== filter) continue;
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category]!.push(m);
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Brain className="h-4 w-4 text-chart-3" />
          <span className="text-xs font-semibold">Agent Memory</span>
          {stats && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {stats.active} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            {stats ? `${stats.totalUses} uses` : "—"}
          </span>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && stats.active > 0 && (
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">
              Avg Confidence
            </span>
            <span className="text-[10px] font-mono text-chart-3">
              {Math.round(stats.avgConfidence * 100)}%
            </span>
          </div>
          <Progress
            value={stats.avgConfidence * 100}
            className="h-1"
          />

          {/* Score trend */}
          {scoreTrend && scoreTrend.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <TrendingUp className="h-3 w-3 text-chart-3" />
              <span className="text-[10px] text-muted-foreground">
                Mission scores:{" "}
              </span>
              <div className="flex gap-1">
                {scoreTrend.slice(-5).map((s, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1 py-0",
                      s.score >= 70
                        ? "border-green-500/50 text-green-400"
                        : s.score >= 40
                          ? "border-yellow-500/50 text-yellow-400"
                          : "border-red-500/50 text-red-400"
                    )}
                  >
                    {s.score}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-border overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors",
            filter === "all"
              ? "bg-chart-3/20 text-chart-3"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const count = stats?.byCategory[key] || 0;
          if (count === 0 && filter !== key) return null;
          return (
            <button
              type="button"
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors",
                filter === key
                  ? `${config.bgColor} ${config.color}`
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {config.emoji} {count}
            </button>
          );
        })}
      </div>

      {/* Memory List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {!memories || memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Lightbulb className="h-6 w-6 mb-2 opacity-30" />
              <p className="text-xs">No memories yet</p>
              <p className="text-[10px] opacity-60">
                Run a mission to start learning
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, categoryMemories]) => {
              const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
              const isExpanded = expandedCategories[category] !== false; // default open

              return (
                <div key={category} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-1.5 w-full px-2 py-1 rounded hover:bg-muted/50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className={cn("text-xs font-medium", config.color)}>
                      {config.emoji} {config.label}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 ml-auto"
                    >
                      {(categoryMemories || []).length}
                    </Badge>
                  </button>

                  {isExpanded && (
                    <div className="pl-5 space-y-1 mt-0.5">
                      {(categoryMemories || []).map((memory) => (
                        <MemoryCard
                          key={memory._id}
                          memory={memory}
                          config={config}
                          onBoost={() => boostMemory({ memoryId: memory._id })}
                          onDeactivate={() =>
                            deactivateMemory({ memoryId: memory._id })
                          }
                        />
                      ))}
                    </div>
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

// ─── Memory Card ────────────────────────────────────────────────

interface MemoryCardProps {
  memory: {
    _id: Id<"agentMemory">;
    title: string;
    content: string;
    confidence: number;
    useCount: number;
    sourceAgentRole?: string;
    tags?: string[];
    isActive: boolean;
  };
  config: { color: string; bgColor: string };
  onBoost: () => void;
  onDeactivate: () => void;
}

function MemoryCard({ memory, config, onBoost, onDeactivate }: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const confidencePercent = Math.round(memory.confidence * 100);

  return (
    <div
      className={cn(
        "rounded-md border border-border/50 p-2 transition-colors",
        memory.isActive ? "bg-muted/20" : "bg-muted/5 opacity-50",
        config.bgColor
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left"
        >
          <p className="text-[11px] font-medium leading-tight">
            {memory.title}
          </p>
          {expanded && (
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              {memory.content}
            </p>
          )}
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] px-1 py-0 font-mono",
              confidencePercent >= 80
                ? "border-green-500/50 text-green-400"
                : confidencePercent >= 50
                  ? "border-yellow-500/50 text-yellow-400"
                  : "border-red-500/50 text-red-400"
            )}
          >
            {confidencePercent}%
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2">
          {memory.sourceAgentRole && (
            <span className="text-[9px] text-muted-foreground">
              from {memory.sourceAgentRole}
            </span>
          )}
          <div className="flex items-center gap-0.5">
            <Zap className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">
              {memory.useCount}x used
            </span>
          </div>
        </div>

        {memory.isActive && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onBoost();
              }}
              title="This memory is helpful — boost confidence"
            >
              <ThumbsUp className="h-3 w-3 text-green-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onDeactivate();
              }}
              title="This memory is wrong — deactivate"
            >
              <ThumbsDown className="h-3 w-3 text-red-400" />
            </Button>
          </div>
        )}
      </div>

      {/* Tags */}
      {expanded && memory.tags && memory.tags.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {memory.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[8px] px-1 py-0 opacity-60"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
