/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — MULTI-AGENT DEBATE PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * Before coding, agents debate the best approach:
 * - Orchestrator proposes a plan
 * - Coder challenges with technical concerns
 * - Worker suggests optimizations
 * - Shows live debate as it happens
 * - Final consensus summary
 *
 * This is a visualization component that shows agent-to-agent
 * communication happening on the backend (agentMessages table).
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Users,
  Crown,
  Code,
  Wrench,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Scale,
  ArrowRight,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AgentDebatePanelProps {
  projectId: Id<"projects"> | null;
  missionId?: Id<"missions"> | null;
}

const ROLE_CONFIG = {
  orchestrator: {
    icon: Crown,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    label: "Orchestrator",
    avatar: "🧠",
  },
  coder: {
    icon: Code,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    label: "Coder",
    avatar: "💻",
  },
  worker: {
    icon: Wrench,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Worker",
    avatar: "⚙️",
  },
};

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.worker;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function AgentDebatePanel({ projectId, missionId }: AgentDebatePanelProps) {
  const messages = useQuery(
    api.intelligence.listAgentMessages,
    missionId ? { missionId } : "skip"
  );
  const thoughts = useQuery(
    api.intelligence.listThoughts,
    missionId ? { missionId } : "skip"
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  if (!projectId || !missionId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0a0a0f] text-white/20 p-4">
        <Users className="h-10 w-10 opacity-50" />
        <p className="text-xs text-center">
          No active mission.
          <br />
          Start a coding task to see agents debate!
        </p>
      </div>
    );
  }

  const allMessages = [...(messages || [])].sort(
    (a, b) => a._creationTime - b._creationTime
  );

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Scale className="h-4 w-4 text-indigo-400" />
        <span className="text-xs font-semibold text-white/70">Agent Debate</span>
        {allMessages.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-white/40">
            {allMessages.length} messages
          </Badge>
        )}
        <div className="ml-auto flex gap-1">
          {/* Agent avatars */}
          {Array.from(new Set(allMessages.map((m) => m.fromRole))).map((role) => {
            const cfg = getRoleConfig(role);
            return (
              <div
                key={role}
                className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[10px]", cfg.bg)}
                title={cfg.label}
              >
                {cfg.avatar}
              </div>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          setAutoScroll(atBottom);
        }}
      >
        {allMessages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-white/15">
            <MessageCircle className="h-8 w-8 animate-pulse" />
            <p className="text-[11px]">Waiting for agents to communicate...</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {allMessages.map((msg, idx) => {
            const fromCfg = getRoleConfig(msg.fromRole);
            const toCfg = msg.toRole ? getRoleConfig(msg.toRole) : null;
            const isSystem = msg.type === "system";

            if (isSystem) {
              return (
                <motion.div
                  key={msg._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 py-1"
                >
                  <div className="flex-1 h-px bg-white/[0.04]" />
                  <span className="text-[9px] text-white/15 px-2">{msg.content}</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={msg._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "rounded-lg border p-2.5",
                  fromCfg.border,
                  fromCfg.bg
                )}
              >
                {/* Message header */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{fromCfg.avatar}</span>
                  <span className={cn("text-[11px] font-semibold", fromCfg.color)}>
                    {fromCfg.label}
                  </span>
                  {toCfg && (
                    <>
                      <ArrowRight className="h-2.5 w-2.5 text-white/15" />
                      <span className="text-sm">{toCfg.avatar}</span>
                      <span className={cn("text-[10px]", toCfg.color)}>
                        {toCfg.label}
                      </span>
                    </>
                  )}
                  <span className="text-[9px] text-white/15 ml-auto">
                    {timeAgo(msg._creationTime)}
                  </span>
                </div>

                {/* Message type badge */}
                {msg.type && msg.type !== "message" && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[8px] px-1 py-0 mb-1",
                      msg.type === "plan" ? "border-purple-500/20 text-purple-400" :
                      msg.type === "challenge" ? "border-red-500/20 text-red-400" :
                      msg.type === "suggestion" ? "border-emerald-500/20 text-emerald-400" :
                      msg.type === "consensus" ? "border-amber-500/20 text-amber-400" :
                      "border-white/10 text-white/30"
                    )}
                  >
                    {msg.type}
                  </Badge>
                )}

                {/* Content */}
                <p className="text-[11px] text-white/45 leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Thoughts Footer (shows internal agent reasoning) */}
      {thoughts && thoughts.length > 0 && (
        <div className="border-t border-white/5 bg-[#0d0d14] px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-white/15 animate-pulse" />
            <span className="text-[9px] text-white/20 truncate">
              Latest: {thoughts[thoughts.length - 1]?.content?.slice(0, 80)}...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
