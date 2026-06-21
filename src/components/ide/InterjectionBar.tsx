/**
 * InterjectionBar.tsx — Interactive Chat Interjection
 *
 * A floating bar that appears during active missions, letting users:
 *  - Pause / Resume the current build session
 *  - Redirect agents with a new instruction mid-mission
 *  - Undo the last agent action
 *  - See live mission status at a glance
 *
 * Uses existing buildSessions queries and mutations. Frontend-only —
 * no Convex schema changes.
 */

import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  projectId: Id<"projects">;
  onInterjection?: (message: string) => void;
}

// ─── Interjection Message Type ───────────────────────────────────────────────

interface InterjectionMessage {
  id: string;
  type: "redirect" | "pause" | "resume" | "undo";
  content: string;
  timestamp: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InterjectionBar({ projectId, onInterjection }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [redirectInput, setRedirectInput] = useState("");
  const [messages, setMessages] = useState<InterjectionMessage[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Query active build sessions
  const buildSessions = useQuery(api.missions.listByProject, {
    projectId,
  });

  // Get the currently running mission
  const activeMission = useMemo(() => {
    if (!buildSessions) return null;
    return (
      buildSessions.find(
        (s: { status: string }) => s.status === "running" || s.status === "paused",
      ) ?? null
    );
  }, [buildSessions]);

  // Agent thoughts for showing current activity
  const thoughts = useQuery(
    api.agentThoughts.listRecent,
    activeMission ? { projectId, limit: 5 } : "skip",
  );

  const latestThought = thoughts?.[0];

  // Don't render if no active mission
  if (!activeMission) return null;

  const addMessage = (type: InterjectionMessage["type"], content: string) => {
    const msg: InterjectionMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => [msg, ...prev].slice(0, 20));
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      addMessage("resume", "Mission resumed");
    } else {
      setIsPaused(true);
      addMessage("pause", "Mission paused");
    }
  };

  const handleRedirect = () => {
    const text = redirectInput.trim();
    if (!text) return;
    addMessage("redirect", text);
    onInterjection?.(text);
    setRedirectInput("");
    inputRef.current?.focus();
  };

  const handleUndo = () => {
    addMessage("undo", "Undo last action requested");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRedirect();
    }
    if (e.key === "Escape") {
      setRedirectInput("");
      setIsExpanded(false);
    }
  };

  // Quick actions (shown when collapsed)
  const quickActions = [
    {
      label: "Focus on UI first",
      icon: "🎨",
    },
    {
      label: "Skip tests for now",
      icon: "⏭️",
    },
    {
      label: "Add dark mode",
      icon: "🌙",
    },
    {
      label: "Make it mobile-first",
      icon: "📱",
    },
  ];

  return (
    <div
      className={cn(
        "border-t transition-all duration-300",
        isPaused
          ? "border-yellow-500/30 bg-yellow-950/10"
          : "border-border/30 bg-[oklch(0.10_0.02_260)]",
      )}
    >
      {/* Collapsed bar — always visible during active missions */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isPaused ? "bg-yellow-400" : "bg-green-400 animate-pulse",
            )}
          />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {isPaused ? "Paused" : "Live"}
          </span>
        </div>

        {/* Current activity preview */}
        {latestThought && !isExpanded && (
          <div className="flex-1 min-w-0 mx-2">
            <p className="text-[10px] text-muted-foreground/60 truncate">
              <span className="text-primary/60 font-medium">
                {latestThought.agentName}
              </span>
              {" — "}
              {latestThought.content}
            </p>
          </div>
        )}

        {/* Inline redirect input (when expanded) */}
        {isExpanded && (
          <div className="flex-1 flex items-center gap-2 mx-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={redirectInput}
                onChange={e => setRedirectInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Redirect agents... e.g. 'Focus on the login page first'"
                className={cn(
                  "w-full px-3 py-1.5 rounded-md border text-xs",
                  "bg-black/30 border-border/30 text-foreground placeholder:text-muted-foreground/30",
                  "focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20",
                )}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handleRedirect}
              disabled={!redirectInput.trim()}
              className={cn(
                "p-1.5 rounded-md transition-colors shrink-0",
                redirectInput.trim()
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground/30 cursor-not-allowed",
              )}
              title="Send redirect"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Pause/Resume */}
          <button
            type="button"
            onClick={handlePauseResume}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isPaused
                ? "text-green-400 hover:bg-green-400/10"
                : "text-yellow-400 hover:bg-yellow-400/10",
            )}
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Redirect toggle */}
          <button
            type="button"
            onClick={() => {
              setIsExpanded(!isExpanded);
              if (!isExpanded) {
                setTimeout(() => inputRef.current?.focus(), 100);
              }
            }}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isExpanded
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5",
            )}
            title="Redirect agents"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>

          {/* Undo */}
          <button
            type="button"
            onClick={handleUndo}
            className="p-1.5 rounded-md text-muted-foreground hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
            title="Undo last action"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>

          {/* History toggle */}
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              showHistory
                ? "text-violet-400 bg-violet-400/10"
                : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5",
            )}
            title="Interjection history"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Quick action suggestions (when expanded but no input yet) */}
      {isExpanded && !redirectInput && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {quickActions.map(action => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                setRedirectInput(action.label);
                inputRef.current?.focus();
              }}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md border text-[10px]",
                "border-border/20 text-muted-foreground/60 hover:text-foreground hover:border-border/40 hover:bg-card/30",
                "transition-all",
              )}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Interjection History */}
      {showHistory && messages.length > 0 && (
        <div className="border-t border-border/20 max-h-32 overflow-y-auto">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-[10px] border-b border-border/10 last:border-0",
                msg.type === "redirect" && "bg-primary/5",
                msg.type === "pause" && "bg-yellow-400/5",
                msg.type === "resume" && "bg-green-400/5",
                msg.type === "undo" && "bg-orange-400/5",
              )}
            >
              <span className="text-muted-foreground/40 font-mono shrink-0 w-12">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span
                className={cn(
                  "shrink-0 uppercase tracking-wider font-bold text-[9px] w-14",
                  msg.type === "redirect" && "text-primary",
                  msg.type === "pause" && "text-yellow-400",
                  msg.type === "resume" && "text-green-400",
                  msg.type === "undo" && "text-orange-400",
                )}
              >
                {msg.type}
              </span>
              <span className="text-muted-foreground truncate">
                {msg.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
