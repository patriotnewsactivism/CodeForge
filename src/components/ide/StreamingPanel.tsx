/**
 * STREAMING PANEL — Watch agents think in real-time
 *
 * Shows the live thought stream from all agents in a mission.
 * Each thought has a phase indicator, content, and agent info.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import {
  Brain,
  Code,
  Eye,
  Lightbulb,
  Play,
  Sparkles,
  GitBranch,
  CheckCircle,
  Radio,
} from "lucide-react";

const PHASE_CONFIG: Record<string, { icon: typeof Brain; label: string; color: string; bgColor: string }> = {
  reasoning: { icon: Brain, label: "Reasoning", color: "text-purple-400", bgColor: "bg-purple-500/10" },
  planning: { icon: Lightbulb, label: "Planning", color: "text-yellow-400", bgColor: "bg-yellow-500/10" },
  coding: { icon: Code, label: "Coding", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  reviewing: { icon: Eye, label: "Reviewing", color: "text-green-400", bgColor: "bg-green-500/10" },
  refining: { icon: Sparkles, label: "Refining", color: "text-orange-400", bgColor: "bg-orange-500/10" },
  spawning: { icon: GitBranch, label: "Spawning", color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
  complete: { icon: CheckCircle, label: "Complete", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
};

interface StreamingPanelProps {
  projectId: Id<"projects"> | null;
  missionId?: Id<"missions"> | null;
}

export function StreamingPanel({ projectId, missionId }: StreamingPanelProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get active mission if not provided
  const activeMission = useQuery(
    api.swarm.getActiveMission,
    projectId ? { projectId } : "skip"
  );

  const resolvedMissionId = missionId || activeMission?._id;

  const thoughts = useQuery(
    api.streaming.listByMission,
    resolvedMissionId ? { missionId: resolvedMissionId, limit: 100 } : "skip"
  );

  const stats = useQuery(
    api.streaming.missionStreamStats,
    resolvedMissionId ? { missionId: resolvedMissionId } : "skip"
  );

  // Auto-scroll to bottom on new thoughts
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [thoughts, autoScroll]);

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        <p className="text-sm">Select a project to view agent streams</p>
      </div>
    );
  }

  if (!resolvedMissionId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
        <Radio className="h-8 w-8 opacity-40" />
        <p className="text-sm font-medium">No Active Mission</p>
        <p className="text-xs text-center">Launch a mission to see agents think in real-time</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-red-400 animate-pulse" />
          <span className="text-sm font-semibold">Live Stream</span>
          {stats && (
            <Badge variant="secondary" className="text-[10px]">
              {stats.totalThoughts} thoughts
            </Badge>
          )}
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full transition-colors",
            autoScroll ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
          )}
        >
          {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
        </button>
      </div>

      {/* Thought Stream */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1.5">
          {(!thoughts || thoughts.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Brain className="h-6 w-6 mb-2 opacity-40 animate-pulse" />
              <p className="text-xs">Waiting for agent thoughts...</p>
            </div>
          ) : (
            thoughts.map((thought) => {
              const phase = PHASE_CONFIG[thought.phase] || PHASE_CONFIG.reasoning;
              const PhaseIcon = phase.icon;
              const time = new Date(thought.timestamp);
              const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

              return (
                <div
                  key={thought._id}
                  className={cn(
                    "rounded-lg border border-border/50 p-2 transition-all",
                    phase.bgColor
                  )}
                >
                  {/* Phase + Time header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <PhaseIcon className={cn("h-3 w-3", phase.color)} />
                      <span className={cn("text-[10px] font-semibold uppercase tracking-wider", phase.color)}>
                        {phase.label}
                      </span>
                      {thought.codeFile && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {thought.codeFile}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {thought.costSoFar !== undefined && (
                        <span className="text-[9px] text-chart-2">
                          ${thought.costSoFar.toFixed(4)}
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground">{timeStr}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <pre className="text-xs text-foreground/80 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-32 overflow-hidden">
                    {thought.content}
                  </pre>

                  {/* Token count */}
                  {thought.tokensSoFar !== undefined && (
                    <div className="mt-1 text-[9px] text-muted-foreground">
                      {thought.tokensSoFar.toLocaleString()} tokens
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer stats */}
      {stats && stats.totalThoughts > 0 && (
        <div className="border-t border-border px-3 py-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
          {Object.entries(stats.phases as Record<string, number>).map(([phase, count]) => {
            const config = PHASE_CONFIG[phase];
            return config ? (
              <span key={phase} className={cn("flex items-center gap-1", config.color)}>
                {config.label}: {count}
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
