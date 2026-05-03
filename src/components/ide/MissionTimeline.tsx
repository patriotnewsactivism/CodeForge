/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — MISSION HISTORY TIMELINE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Visual timeline showing all past missions with:
 * - Status indicators (running/completed/failed)
 * - Agent count + agent role breakdown
 * - Duration & cost
 * - Retrospective score + key learning
 * - Expand to see agent tree
 * - Click to replay any mission
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Pause,
  GitBranch,
  Brain,
  Users,
  Zap,
  FileCode,
  PlayCircle,
  Sparkles,
  Timer,
  Star,
} from "lucide-react";

interface MissionTimelineProps {
  projectId: Id<"projects"> | null;
  onReplayMission?: (missionId: Id<"missions">) => void;
  onViewAgents?: (missionId: Id<"missions">) => void;
}

const STATUS_CONFIG = {
  planning: { icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10", label: "Planning" },
  running: { icon: Loader2, color: "text-amber-400", bg: "bg-amber-500/10", label: "Running", animate: true },
  paused: { icon: Pause, color: "text-gray-400", bg: "bg-gray-500/10", label: "Paused" },
  completed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Failed" },
} as const;

const ROLE_COLORS: Record<string, string> = {
  orchestrator: "bg-purple-500/20 text-purple-400 border-purple-500/20",
  coder: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  worker: "bg-amber-500/20 text-amber-400 border-amber-500/20",
};

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;

  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diff < 172800000) {
    return "Yesterday " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 8 ? "text-emerald-400 bg-emerald-500/10" :
    score >= 6 ? "text-blue-400 bg-blue-500/10" :
    score >= 4 ? "text-amber-400 bg-amber-500/10" :
    "text-red-400 bg-red-500/10";

  return (
    <div className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold", color)}>
      <Star className="h-2.5 w-2.5" />
      {score}/10
    </div>
  );
}

export function MissionTimeline({
  projectId,
  onReplayMission,
  onViewAgents,
}: MissionTimelineProps) {
  const timeline = useQuery(
    api.intelligence.getMissionTimeline,
    projectId ? { projectId } : "skip"
  );

  const [expandedMission, setExpandedMission] = useState<string | null>(null);

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-white/30">
        <p className="text-sm">Select a project</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Clock className="h-4 w-4 text-blue-400" />
        <span className="text-xs font-semibold text-white/70">Mission Timeline</span>
        {timeline && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-white/40">
            {timeline.length}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {(!timeline || timeline.length === 0) && (
          <div className="flex flex-col items-center gap-3 py-12 text-white/20">
            <Zap className="h-10 w-10 opacity-50" />
            <p className="text-xs text-center">
              No missions yet.
              <br />
              Ask CodeForge to build something!
            </p>
          </div>
        )}

        <div className="relative px-3 py-2">
          {/* Timeline line */}
          {timeline && timeline.length > 0 && (
            <div className="absolute left-[22px] top-4 bottom-4 w-px bg-white/[0.06]" />
          )}

          {(timeline || []).map((mission, idx) => {
            const statusCfg = STATUS_CONFIG[mission.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
            const StatusIcon = statusCfg.icon;
            const isExpanded = expandedMission === mission._id;
            const isRunning = mission.status === "running" || mission.status === "planning";

            return (
              <div key={mission._id} className="relative mb-3">
                {/* Timeline dot */}
                <div
                  className={cn(
                    "absolute left-0 top-3 z-10 h-3 w-3 rounded-full border-2 border-[#0a0a0f]",
                    statusCfg.bg,
                    isRunning && "animate-pulse"
                  )}
                >
                  <div className={cn("h-full w-full rounded-full", statusCfg.bg)} />
                </div>

                {/* Card */}
                <div className="ml-6 rounded-lg border border-white/[0.04] bg-white/[0.01] overflow-hidden">
                  <button
                    onClick={() => setExpandedMission(isExpanded ? null : mission._id)}
                    className="w-full text-left p-2.5 hover:bg-white/[0.015] transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <StatusIcon
                        className={cn(
                          "h-4 w-4 shrink-0 mt-0.5",
                          statusCfg.color,
                          (statusCfg as any).animate && "animate-spin"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/70 leading-snug line-clamp-2">
                          {mission.prompt}
                        </p>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
                          {/* Time */}
                          <span className="text-[9px] text-white/25">
                            {formatDate(mission.startedAt)}
                          </span>
                          {/* Duration */}
                          {mission.duration != null && (
                            <span className="flex items-center gap-0.5 text-[9px] text-white/25">
                              <Timer className="h-2.5 w-2.5" />
                              {formatDuration(mission.duration)}
                            </span>
                          )}
                          {/* Agents */}
                          <span className="flex items-center gap-0.5 text-[9px] text-white/25">
                            <Users className="h-2.5 w-2.5" />
                            {mission.agentCount} agent{mission.agentCount !== 1 ? "s" : ""}
                          </span>
                          {/* Files */}
                          {mission.totalFiles != null && mission.totalFiles > 0 && (
                            <span className="flex items-center gap-0.5 text-[9px] text-white/25">
                              <FileCode className="h-2.5 w-2.5" />
                              {mission.totalFiles} file{mission.totalFiles !== 1 ? "s" : ""}
                            </span>
                          )}
                          {/* Score */}
                          <ScoreBadge score={mission.retroScore} />
                          {/* Memories */}
                          {mission.memoriesCreated > 0 && (
                            <span className="flex items-center gap-0.5 text-[9px] text-emerald-400/60">
                              <Brain className="h-2.5 w-2.5" />
                              +{mission.memoriesCreated}
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-white/20 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-white/20 shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.03] bg-white/[0.005] p-2.5">
                      {/* Plan */}
                      {mission.plan && (
                        <div className="mb-2">
                          <span className="text-[9px] font-semibold text-white/25 uppercase">Plan</span>
                          <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed line-clamp-4">
                            {(() => {
                              try { return JSON.parse(mission.plan).overview || mission.plan; }
                              catch { return mission.plan; }
                            })()}
                          </p>
                        </div>
                      )}

                      {/* Agent Breakdown */}
                      {mission.agents.length > 0 && (
                        <div className="mb-2">
                          <span className="text-[9px] font-semibold text-white/25 uppercase">Agents</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mission.agents.map((agent) => (
                              <div
                                key={agent._id}
                                className={cn(
                                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border",
                                  ROLE_COLORS[agent.role] || "bg-white/5 text-white/40 border-white/10"
                                )}
                              >
                                {agent.status === "completed" ? (
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                ) : agent.status === "failed" ? (
                                  <XCircle className="h-2.5 w-2.5" />
                                ) : agent.status === "running" ? (
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                ) : (
                                  <Clock className="h-2.5 w-2.5" />
                                )}
                                {agent.title.length > 30 ? agent.title.slice(0, 30) + "…" : agent.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Retro Summary */}
                      {mission.retroSummary && (
                        <div className="mb-2 rounded bg-emerald-500/[0.03] border border-emerald-500/10 p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Sparkles className="h-3 w-3 text-emerald-400" />
                            <span className="text-[9px] font-semibold text-emerald-400/60">Key Learning</span>
                          </div>
                          <p className="text-[10px] text-white/40 leading-relaxed">
                            {mission.retroSummary}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-1.5 mt-2">
                        {onReplayMission && (
                          <button
                            onClick={() => onReplayMission(mission._id as Id<"missions">)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-medium hover:bg-blue-500/20 transition-colors"
                          >
                            <PlayCircle className="h-3 w-3" />
                            Replay
                          </button>
                        )}
                        {onViewAgents && (
                          <button
                            onClick={() => onViewAgents(mission._id as Id<"missions">)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-[10px] font-medium hover:bg-purple-500/20 transition-colors"
                          >
                            <Users className="h-3 w-3" />
                            View Agents
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
