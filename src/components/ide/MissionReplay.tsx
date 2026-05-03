/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — MISSION REPLAY
 * ═══════════════════════════════════════════════════════════════════
 *
 * Timelapse replay of a mission — watch agents build in fast-forward.
 * Shows tool calls, file changes, and agent spawns chronologically.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Gauge,
  FileCode,
  FilePen,
  Trash2,
  GitFork,
  MessageCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface MissionReplayProps {
  missionId: Id<"missions"> | null;
  onClose: () => void;
}

const TOOL_ICONS: Record<string, typeof FileCode> = {
  create_file: FileCode,
  edit_file: FilePen,
  delete_file: Trash2,
  spawn_agent: GitFork,
  send_message: MessageCircle,
  complete_task: CheckCircle2,
};

const TOOL_COLORS: Record<string, string> = {
  create_file: "text-emerald-400",
  edit_file: "text-amber-400",
  delete_file: "text-red-400",
  spawn_agent: "text-purple-400",
  send_message: "text-blue-400",
  complete_task: "text-emerald-400",
};

const SPEED_OPTIONS = [1, 2, 5, 10];

export function MissionReplay({ missionId, onClose }: MissionReplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const toolCalls = useQuery(
    api.engine.listMissionToolCalls,
    missionId ? { missionId } : "skip"
  );
  const agents = useQuery(
    api.engine.listMissionAgents,
    missionId ? { missionId } : "skip"
  );

  const sortedCalls = (toolCalls || []).slice().sort(
    (a, b) => a.startedAt - b.startedAt
  );

  // Auto-scroll to current item
  useEffect(() => {
    if (listRef.current && currentIndex > 0) {
      const items = listRef.current.children;
      if (items[currentIndex]) {
        items[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentIndex]);

  // Play/pause logic
  useEffect(() => {
    if (isPlaying && sortedCalls.length > 0) {
      const baseDelay = 600; // ms between events at 1x
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= sortedCalls.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, baseDelay / speed);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, sortedCalls.length]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  const handleSkip = useCallback(() => {
    setCurrentIndex(sortedCalls.length - 1);
    setIsPlaying(false);
  }, [sortedCalls.length]);

  if (!missionId) return null;

  const progress = sortedCalls.length > 0
    ? ((currentIndex + 1) / sortedCalls.length) * 100
    : 0;

  // Stats
  const agentMap = new Map((agents || []).map((a) => [a._id, a]));

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-[#0d0d14]">
        <div className="flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-white/80">Mission Replay</span>
          <Badge
            variant="secondary"
            className="text-[9px] h-4 px-1.5 bg-purple-500/20 text-purple-400"
          >
            {currentIndex + 1}/{sortedCalls.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] text-white/40"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={isPlaying ? "secondary" : "default"}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleSkip}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>

        {/* Speed selector */}
        <div className="flex items-center gap-1 ml-2">
          <Gauge className="h-3 w-3 text-white/30" />
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                speed === s
                  ? "bg-purple-500/20 text-purple-400"
                  : "text-white/30 hover:text-white/60"
              )}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden ml-2">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedCalls.map((call, i) => {
          const Icon = TOOL_ICONS[call.toolName] || FileCode;
          const color = TOOL_COLORS[call.toolName] || "text-white/60";
          const isVisible = i <= currentIndex;
          const isCurrent = i === currentIndex;
          const agent = agentMap.get(call.agentRunId);

          let label = call.toolName.replace(/_/g, " ");
          if (call.filePath) label = call.filePath;

          return (
            <div
              key={call._id}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded transition-all duration-200",
                !isVisible && "opacity-0 scale-95",
                isVisible && !isCurrent && "opacity-40",
                isCurrent && "opacity-100 bg-white/5 ring-1 ring-purple-500/30"
              )}
            >
              <div className={cn("shrink-0", color)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/80 truncate font-mono">{label}</p>
                {agent && (
                  <p className="text-[9px] text-white/30 truncate">
                    {agent.role} · {agent.title}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {call.status === "success" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400/60" />
                ) : call.status === "error" ? (
                  <XCircle className="h-3 w-3 text-red-400/60" />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
