/**
 * RETROSPECTIVE PANEL — Post-mission self-improvement analysis
 *
 * Shows what worked, what failed, improvement suggestions,
 * and the score trend over time. This is the "report card"
 * that proves the swarm is getting smarter.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Lightbulb,
  RefreshCw,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";

interface RetrospectivePanelProps {
  projectId: Id<"projects"> | null;
  missionId?: Id<"missions"> | null;
  className?: string;
}

export function RetrospectivePanel({
  projectId,
  missionId,
  className,
}: RetrospectivePanelProps) {
  const allRetros = useQuery(
    api.retrospective.listByProject,
    projectId ? { projectId } : "skip"
  );
  const currentRetro = useQuery(
    api.retrospective.getByMission,
    missionId ? { missionId } : "skip"
  );
  const scoreTrend = useQuery(
    api.retrospective.getScoreTrend,
    projectId ? { projectId } : "skip"
  );

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Show the current mission's retro, or the selected one, or most recent
  const retro =
    currentRetro ||
    (selectedIndex !== null && allRetros ? allRetros[selectedIndex] : null) ||
    (allRetros && allRetros.length > 0 ? allRetros[allRetros.length - 1] : null);

  if (!projectId) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full text-muted-foreground",
          className
        )}
      >
        <RefreshCw className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">Select a project to view retrospectives</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4 text-chart-3" />
          <span className="text-xs font-semibold">Self-Improvement</span>
          {allRetros && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {allRetros.length} reviews
            </Badge>
          )}
        </div>
      </div>

      {/* Score Trend */}
      {scoreTrend && scoreTrend.length > 0 && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3 w-3 text-chart-3" />
            <span className="text-[10px] font-medium text-muted-foreground">
              Performance Trend
            </span>
          </div>
          <div className="flex items-end gap-1 h-10">
            {scoreTrend.map((s, i) => {
              const height = Math.max(4, (s.score / 100) * 40);
              const isSelected = selectedIndex === i;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={cn(
                    "flex-1 rounded-t-sm transition-all",
                    s.score >= 70
                      ? "bg-green-500"
                      : s.score >= 40
                        ? "bg-yellow-500"
                        : "bg-red-500",
                    isSelected ? "opacity-100 ring-1 ring-white/30" : "opacity-50 hover:opacity-70"
                  )}
                  style={{ height: `${height}px` }}
                  title={`Mission score: ${s.score}/100`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">
              {scoreTrend.length > 1
                ? `${scoreTrend[0].score} → ${scoreTrend[scoreTrend.length - 1].score}`
                : `Score: ${scoreTrend[0].score}`}
            </span>
            {scoreTrend.length > 1 && (
              <span
                className={cn(
                  "text-[9px] flex items-center gap-0.5",
                  scoreTrend[scoreTrend.length - 1].score > scoreTrend[0].score
                    ? "text-green-400"
                    : "text-red-400"
                )}
              >
                {scoreTrend[scoreTrend.length - 1].score > scoreTrend[0].score ? (
                  <ArrowUpRight className="h-2.5 w-2.5" />
                ) : (
                  <ArrowDownRight className="h-2.5 w-2.5" />
                )}
                {Math.abs(
                  scoreTrend[scoreTrend.length - 1].score - scoreTrend[0].score
                )}{" "}
                pts
              </span>
            )}
          </div>
        </div>
      )}

      {/* Retro Content */}
      <ScrollArea className="flex-1">
        {!retro ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <BarChart3 className="h-6 w-6 mb-2 opacity-30" />
            <p className="text-xs">No retrospectives yet</p>
            <p className="text-[10px] opacity-60">
              Complete a mission to see the analysis
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Score */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-chart-3" />
                <span className="text-sm font-semibold">
                  Score: {retro.score}/100
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  retro.score >= 70
                    ? "border-green-500/50 text-green-400"
                    : retro.score >= 40
                      ? "border-yellow-500/50 text-yellow-400"
                      : "border-red-500/50 text-red-400"
                )}
              >
                {retro.score >= 80
                  ? "Excellent"
                  : retro.score >= 60
                    ? "Good"
                    : retro.score >= 40
                      ? "Average"
                      : "Needs Work"}
              </Badge>
            </div>

            {/* Summary */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {retro.summary}
            </p>

            {/* What Worked */}
            {retro.whatWorked.length > 0 && (
              <RetroSection
                icon={<CheckCircle2 className="h-3 w-3 text-green-400" />}
                title="What Worked"
                items={retro.whatWorked}
                color="text-green-400"
                bgColor="bg-green-500/10"
              />
            )}

            {/* What Failed */}
            {retro.whatFailed.length > 0 && (
              <RetroSection
                icon={<XCircle className="h-3 w-3 text-red-400" />}
                title="What Failed"
                items={retro.whatFailed}
                color="text-red-400"
                bgColor="bg-red-500/10"
              />
            )}

            {/* Improvements */}
            {retro.improvements.length > 0 && (
              <RetroSection
                icon={<Lightbulb className="h-3 w-3 text-yellow-400" />}
                title="Improvements for Next Time"
                items={retro.improvements}
                color="text-yellow-400"
                bgColor="bg-yellow-500/10"
              />
            )}

            {/* Patterns */}
            {retro.patternsFound.length > 0 && (
              <RetroSection
                icon={<TrendingUp className="h-3 w-3 text-purple-400" />}
                title="Patterns Discovered"
                items={retro.patternsFound}
                color="text-purple-400"
                bgColor="bg-purple-500/10"
              />
            )}

            {/* Meta */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {new Date(retro.createdAt).toLocaleString()}
              </div>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                <span>{retro.memoriesCreated || 0} memories stored</span>
                {retro.cost && <span>${retro.cost.toFixed(4)}</span>}
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── RetroSection ───────────────────────────────────────────────

function RetroSection({
  icon,
  title,
  items,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  color: string;
  bgColor: string;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1.5 w-full text-left px-2 py-1 rounded",
          bgColor
        )}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        {icon}
        <span className={cn("text-[11px] font-medium", color)}>{title}</span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">
          {items.length}
        </Badge>
      </button>
      {expanded && (
        <ul className="pl-7 mt-1 space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="text-[10px] text-muted-foreground leading-relaxed">
              • {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
