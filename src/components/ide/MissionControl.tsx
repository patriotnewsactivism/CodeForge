/**
 * MissionControl — NASA-style agent mission control panel.
 *
 * Three integrated views:
 *  1. "Control" — Live mission status with agent tree + health indicators
 *  2. "Comms"   — Inter-agent communication feed (warnings, findings, blockers)
 *  3. "Timeline"— Chronological thought stream with timestamps
 *
 * Features:
 *  - Agent tree visualization showing parent→child spawning hierarchy
 *  - Real-time pulsing status indicators per agent
 *  - Mission health bar with success/failure tracking
 *  - Per-agent file change counts and step metrics
 *  - Color-coded agent roles with unique icons
 */
import { useQuery } from "convex/react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus,
  FileSearch,
  Loader2,
  MessageSquare,
  Radio,
  Send,
  Shield,
  Target,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface Props {
  projectId: Id<"projects">;
}

// ─── Agent Colors ────────────────────────────────────────────────────────────

const AGENT_META: Record<
  string,
  { dot: string; text: string; bg: string; border: string; icon: string }
> = {
  planner: {
    dot: "bg-violet-400",
    text: "text-violet-400",
    bg: "bg-violet-400/8",
    border: "border-violet-500/20",
    icon: "🗺️",
  },
  "planner-agent": {
    dot: "bg-violet-400",
    text: "text-violet-400",
    bg: "bg-violet-400/8",
    border: "border-violet-500/20",
    icon: "🗺️",
  },
  "ui-agent": {
    dot: "bg-blue-400",
    text: "text-blue-400",
    bg: "bg-blue-400/8",
    border: "border-blue-500/20",
    icon: "🎨",
  },
  "logic-agent": {
    dot: "bg-green-400",
    text: "text-green-400",
    bg: "bg-green-400/8",
    border: "border-green-500/20",
    icon: "⚙️",
  },
  "mobile-agent": {
    dot: "bg-cyan-400",
    text: "text-cyan-400",
    bg: "bg-cyan-400/8",
    border: "border-cyan-500/20",
    icon: "📱",
  },
  "feature-agent": {
    dot: "bg-amber-400",
    text: "text-amber-400",
    bg: "bg-amber-400/8",
    border: "border-amber-500/20",
    icon: "✨",
  },
  "debug-agent": {
    dot: "bg-red-400",
    text: "text-red-400",
    bg: "bg-red-400/8",
    border: "border-red-500/20",
    icon: "🔍",
  },
  "test-agent": {
    dot: "bg-lime-400",
    text: "text-lime-400",
    bg: "bg-lime-400/8",
    border: "border-lime-500/20",
    icon: "🧪",
  },
  "reviewer-agent": {
    dot: "bg-orange-400",
    text: "text-orange-400",
    bg: "bg-orange-400/8",
    border: "border-orange-500/20",
    icon: "🔎",
  },
  "qa-agent": {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    bg: "bg-emerald-400/8",
    border: "border-emerald-500/20",
    icon: "✅",
  },
  "retrospective-agent": {
    dot: "bg-purple-400",
    text: "text-purple-400",
    bg: "bg-purple-400/8",
    border: "border-purple-500/20",
    icon: "🪞",
  },
};

const DEFAULT_META = {
  dot: "bg-pink-400",
  text: "text-pink-400",
  bg: "bg-pink-400/8",
  border: "border-pink-500/20",
  icon: "🤖",
};

const THOUGHT_COLORS: Record<string, string> = {
  plan: "text-violet-400",
  analyze: "text-blue-400",
  code: "text-green-400",
  debug: "text-red-400",
  review: "text-orange-400",
  memory: "text-purple-400",
  search: "text-cyan-400",
  broadcast: "text-pink-400",
  done: "text-emerald-400",
  action: "text-amber-400",
  complete: "text-emerald-400",
  error: "text-red-400",
  warning: "text-yellow-400",
  thinking: "text-blue-300",
  finding: "text-teal-400",
  commit: "text-green-500",
};

const COMMS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  warning: {
    bg: "bg-yellow-400/8 border-yellow-500/20",
    text: "text-yellow-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  context: {
    bg: "bg-blue-400/8 border-blue-500/20",
    text: "text-blue-400",
    icon: <Brain className="h-3 w-3" />,
  },
  request: {
    bg: "bg-violet-400/8 border-violet-500/20",
    text: "text-violet-400",
    icon: <Send className="h-3 w-3" />,
  },
  finding: {
    bg: "bg-teal-400/8 border-teal-500/20",
    text: "text-teal-400",
    icon: <Target className="h-3 w-3" />,
  },
  blocker: {
    bg: "bg-red-400/8 border-red-500/20",
    text: "text-red-400",
    icon: <XCircle className="h-3 w-3" />,
  },
  resolved: {
    bg: "bg-emerald-400/8 border-emerald-500/20",
    text: "text-emerald-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentNode {
  agentId: string;
  agentName: string;
  icon: string;
  status: "active" | "done" | "error" | "waiting";
  latestThought: string;
  latestType: string;
  thoughtCount: number;
  fileChanges: number;
  startedAt: number;
  children: AgentNode[];
  depth: number;
}

type ViewMode = "control" | "comms" | "timeline";

// ─── Component ───────────────────────────────────────────────────────────────

export function MissionControl({ projectId }: Props) {
  const toolCalls = useQuery(api.engine.listToolCalls, {
    projectId,
    limit: 200,
  });
  const thoughts = useQuery(api.agentThoughts.listRecent, {
    projectId,
    limit: 120,
  });

  // Inter-agent messages — uses the agentMessages table via thoughts as fallback
  // Extract comm-style messages from thoughts (broadcasts, warnings, findings)
  const agentMessages = useMemo(() => {
    if (!thoughts) return [];
    return thoughts
      .filter(
        (t: any) =>
          t.type === "broadcast" ||
          t.type === "warning" ||
          t.type === "finding" ||
          t.type === "error",
      )
      .map((t: any) => ({
        _id: t._id,
        fromAgentId: t.agentId,
        fromAgentName: t.agentName,
        messageType:
          t.type === "broadcast"
            ? "context"
            : t.type === "warning"
              ? "warning"
              : t.type === "finding"
                ? "finding"
                : "blocker",
        content: t.content,
        timestamp: t.timestamp,
        relatedFiles: [] as string[],
      }));
  }, [thoughts]);

  const [view, setView] = useState<ViewMode>("control");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  // Auto-scroll on new activity
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [toolCalls?.length, thoughts?.length, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  // Build agent tree from thoughts
  const { agentTree, missionHealth, agentCount, totalSteps } = useMemo(() => {
    if (!thoughts || thoughts.length === 0) {
      return { agentTree: [] as AgentNode[], missionHealth: 0, agentCount: 0, totalSteps: 0 };
    }

    const agentMap = new Map<
      string,
      {
        agentId: string;
        agentName: string;
        latestThought: string;
        latestType: string;
        isActive: boolean;
        isDone: boolean;
        isError: boolean;
        thoughtCount: number;
        fileChanges: number;
        firstSeen: number;
      }
    >();

    for (const t of thoughts) {
      const existing = agentMap.get(t.agentId);
      const isDone = t.type === "done" || t.type === "complete";
      const isError = t.type === "error";
      const isActive = !isDone && !isError && Date.now() - t.timestamp < 30000;

      agentMap.set(t.agentId, {
        agentId: t.agentId,
        agentName: t.agentName,
        latestThought: t.content,
        latestType: t.type,
        isActive: isDone || isError ? false : (existing?.isActive ?? false) || isActive,
        isDone: isDone || (existing?.isDone ?? false),
        isError: isError || (existing?.isError ?? false),
        thoughtCount: (existing?.thoughtCount ?? 0) + 1,
        fileChanges:
          (existing?.fileChanges ?? 0) +
          (t.content.includes("create_file") || t.content.includes("edit_file") ? 1 : 0),
        firstSeen: existing?.firstSeen ?? t.timestamp,
      });
    }

    // Build tree: planner is root, rest are children
    const agents = Array.from(agentMap.values());
    const getStatus = (a: typeof agents[0]): AgentNode["status"] => {
      if (a.isError) return "error";
      if (a.isDone) return "done";
      if (a.isActive) return "active";
      return "waiting";
    };

    const planner = agents.find(a => a.agentId === "planner" || a.agentId === "planner-agent");
    const others = agents
      .filter(a => a.agentId !== "planner" && a.agentId !== "planner-agent")
      .sort((a, b) => a.firstSeen - b.firstSeen);

    const getMeta = (id: string) => AGENT_META[id] ?? DEFAULT_META;

    const childNodes: AgentNode[] = others.map(a => ({
      agentId: a.agentId,
      agentName: a.agentName,
      icon: getMeta(a.agentId).icon,
      status: getStatus(a),
      latestThought: a.latestThought,
      latestType: a.latestType,
      thoughtCount: a.thoughtCount,
      fileChanges: a.fileChanges,
      startedAt: a.firstSeen,
      children: [],
      depth: 1,
    }));

    const tree: AgentNode[] = planner
      ? [
          {
            agentId: planner.agentId,
            agentName: planner.agentName,
            icon: getMeta(planner.agentId).icon,
            status: getStatus(planner),
            latestThought: planner.latestThought,
            latestType: planner.latestType,
            thoughtCount: planner.thoughtCount,
            fileChanges: planner.fileChanges,
            startedAt: planner.firstSeen,
            children: childNodes,
            depth: 0,
          },
        ]
      : childNodes;

    // Calculate mission health
    const done = agents.filter(a => a.isDone).length;
    const errored = agents.filter(a => a.isError).length;
    const total = agents.length;
    const health = total > 0 ? Math.round(((done) / Math.max(total, 1)) * 100) : 0;

    return {
      agentTree: tree,
      missionHealth: errored > 0 ? Math.max(health - errored * 15, 0) : health,
      agentCount: total,
      totalSteps: agents.reduce((s, a) => s + a.thoughtCount, 0),
    };
  }, [thoughts]);

  // Active tool calls
  const activeCalls =
    toolCalls?.filter(
      (c: { status: string }) => c.status === "running" || c.status === "pending",
    ) ?? [];

  const isRunning =
    activeCalls.length > 0 ||
    (thoughts?.some((t: { isStreaming?: boolean }) => t.isStreaming) ?? false);

  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[oklch(0.10_0.02_260)]">
      {/* ── Mission Control Header ── */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        {/* Top row: title + live badge */}
        <div className="flex items-center gap-2 mb-2">
          <Radio
            className={cn(
              "h-4 w-4",
              isRunning ? "text-red-400 animate-pulse" : "text-muted-foreground/40",
            )}
          />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex-1">
            Mission Control
          </span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              LIVE
            </span>
          )}
        </div>

        {/* Mission health bar */}
        {agentCount > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between text-[9px] mb-1">
              <span className="text-muted-foreground/60">Mission Health</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  missionHealth >= 80
                    ? "text-emerald-400"
                    : missionHealth >= 50
                      ? "text-amber-400"
                      : "text-red-400",
                )}
              >
                {missionHealth}%
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  missionHealth >= 80
                    ? "bg-emerald-400"
                    : missionHealth >= 50
                      ? "bg-amber-400"
                      : "bg-red-400",
                )}
                style={{ width: `${missionHealth}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats strip */}
        {agentCount > 0 && (
          <div className="flex gap-3 text-[9px] mb-2">
            <span className="text-muted-foreground/50">
              <span className="text-foreground/80 font-semibold">{agentCount}</span> agents
            </span>
            <span className="text-muted-foreground/50">
              <span className="text-foreground/80 font-semibold">{totalSteps}</span> steps
            </span>
            <span className="text-muted-foreground/50">
              <span className="text-foreground/80 font-semibold">{activeCalls.length}</span> active
            </span>
          </div>
        )}

        {/* View tabs */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {(
            [
              { id: "control" as const, label: "Control", icon: <Target className="h-3 w-3" /> },
              { id: "comms" as const, label: "Comms", icon: <MessageSquare className="h-3 w-3" /> },
              { id: "timeline" as const, label: "Timeline", icon: <Activity className="h-3 w-3" /> },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide transition-colors",
                view === tab.id
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground/50 hover:text-foreground/70",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0" onScroll={handleScroll}>
        {/* ── CONTROL VIEW — Agent tree ── */}
        {view === "control" && (
          <div className="p-2 space-y-1">
            {agentTree.length === 0 && (
              <EmptyState
                icon={<Shield className="h-8 w-8 text-muted-foreground/15" />}
                title="Awaiting Mission"
                subtitle="Ask CodeForge to build something to see agents spawn"
              />
            )}

            {agentTree.map(node => (
              <AgentTreeNode
                key={node.agentId}
                node={node}
                expanded={expandedAgents}
                onToggle={toggleAgent}
                isRunning={isRunning}
              />
            ))}

            {/* Active tool calls */}
            {activeCalls.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/15 bg-amber-400/5 p-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-amber-400/70 mb-1.5 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Live Operations ({activeCalls.length})
                </p>
                {activeCalls.slice(0, 8).map(
                  (call: { _id: string; tool: string; args: string }) => {
                    let args: Record<string, string> = {};
                    try {
                      args = JSON.parse(call.args);
                    } catch {
                      /* */
                    }
                    return (
                      <div key={call._id} className="flex items-center gap-1.5 py-0.5">
                        <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400 shrink-0" />
                        <span className="text-[10px] text-amber-300 font-medium shrink-0">
                          {call.tool}
                        </span>
                        <span className="text-[9px] text-muted-foreground/40 truncate">
                          {args.path ?? args.query ?? args.role ?? ""}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* ── COMMS VIEW — Inter-agent messages ── */}
        {view === "comms" && (
          <div className="p-2 space-y-1.5">
            {(!agentMessages || agentMessages.length === 0) && (
              <EmptyState
                icon={<MessageSquare className="h-8 w-8 text-muted-foreground/15" />}
                title="No Comms Yet"
                subtitle="Agent-to-agent messages appear here during missions"
              />
            )}

            {agentMessages
              ?.filter((m: any) => m.messageType || m.fromAgentId)
              .map((msg: any, i: number) => {
                const style =
                  COMMS_COLORS[msg.messageType] ?? COMMS_COLORS.context;
                const fromMeta = AGENT_META[msg.fromAgentId] ?? DEFAULT_META;

                return (
                  <div
                    key={msg._id ?? i}
                    className={cn(
                      "rounded-lg border p-2.5 transition-all",
                      style.bg,
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn("shrink-0", style.text)}>
                        {style.icon}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold",
                          fromMeta.text,
                        )}
                      >
                        {msg.fromAgentName ?? msg.fromAgentId}
                      </span>
                      {msg.toAgentName && (
                        <>
                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30" />
                          <span className="text-[10px] text-muted-foreground/70">
                            {msg.toAgentName}
                          </span>
                        </>
                      )}
                      <span className="ml-auto text-[8px] text-muted-foreground/30 tabular-nums shrink-0">
                        {msg.timestamp
                          ? new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-[10px] text-foreground/70 leading-snug break-words pl-5">
                      {msg.content}
                    </p>

                    {/* Related files */}
                    {msg.relatedFiles?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
                        {msg.relatedFiles.map((f: string) => (
                          <span
                            key={f}
                            className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground/50 font-mono"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            <div ref={bottomRef} />
          </div>
        )}

        {/* ── TIMELINE VIEW — Full thought stream ── */}
        {view === "timeline" && (
          <div className="p-1.5 space-y-0.5 font-mono text-[10px]">
            {(!thoughts || thoughts.length === 0) && (
              <EmptyState
                icon={<Brain className="h-8 w-8 text-muted-foreground/15" />}
                title="No Activity"
                subtitle="Agent thoughts and actions will stream here"
              />
            )}
            {thoughts?.map(
              (
                t: {
                  _id: string;
                  agentId: string;
                  agentName: string;
                  type: string;
                  content: string;
                  timestamp: number;
                  isStreaming?: boolean;
                },
                i: number,
                arr: typeof thoughts,
              ) => {
                const color = THOUGHT_COLORS[t.type] ?? "text-foreground/70";
                const agentColor = (AGENT_META[t.agentId] ?? DEFAULT_META).text;
                const isLast = i === arr.length - 1;
                return (
                  <div
                    key={t._id}
                    className={cn(
                      "flex items-start gap-1.5 px-1.5 py-0.5 rounded",
                      isLast ? "bg-[oklch(0.15_0.02_260)]" : "",
                    )}
                  >
                    <span className="shrink-0 text-muted-foreground/25 w-12 tabular-nums pt-0.5 text-[9px]">
                      {new Date(t.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-bold w-12 truncate text-[9px] pt-0.5",
                        agentColor,
                      )}
                    >
                      {t.agentName.replace(/^[^\s]+ /, "").slice(0, 8)}
                    </span>
                    <span className={cn("shrink-0 text-[9px] pt-0.5 w-12", color)}>
                      [{t.type}]
                    </span>
                    <span className={cn("flex-1 leading-relaxed break-words", color)}>
                      {t.content}
                      {isLast && t.isStreaming && (
                        <span className="inline-block w-1 h-3 bg-current ml-0.5 animate-pulse" />
                      )}
                    </span>
                  </div>
                );
              },
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="mx-2 mb-2 py-1 text-[10px] text-muted-foreground hover:text-foreground bg-white/5 rounded text-center shrink-0 flex items-center justify-center gap-1"
        >
          <ChevronDown className="h-3 w-3" /> Jump to latest
        </button>
      )}
    </div>
  );
}

// ─── Agent Tree Node ─────────────────────────────────────────────────────────

function AgentTreeNode({
  node,
  expanded,
  onToggle,
  isRunning,
  depth = 0,
}: {
  node: AgentNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  isRunning: boolean;
  depth?: number;
}) {
  const meta = AGENT_META[node.agentId] ?? DEFAULT_META;
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.agentId) || node.children.length <= 4;
  const statusConfig = {
    active: { label: "⚡ active", className: "bg-amber-400/15 text-amber-400" },
    done: { label: "✓ done", className: "bg-emerald-400/15 text-emerald-400" },
    error: { label: "✕ error", className: "bg-red-400/15 text-red-400" },
    waiting: { label: "◦ idle", className: "bg-white/5 text-muted-foreground/40" },
  };
  const status = statusConfig[node.status];

  return (
    <div className={cn(depth > 0 && "ml-3 border-l border-white/5 pl-2")}>
      {/* Connector line for children */}
      {depth > 0 && (
        <div className="absolute -left-px top-0 w-2 h-3 border-b border-white/5" />
      )}

      <div
        className={cn(
          "rounded-lg border p-2 transition-all duration-300 relative",
          meta.bg,
          meta.border,
          node.status === "active" && "shadow-sm ring-1 ring-inset",
          node.status === "active" && meta.border.replace("border-", "ring-"),
        )}
      >
        {/* Agent header */}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Expand/collapse for agents with children */}
          {hasChildren && (
            <button
              type="button"
              onClick={() => onToggle(node.agentId)}
              className="shrink-0 p-0.5 rounded hover:bg-white/5"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              )}
            </button>
          )}

          {/* Status dot */}
          <div
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              meta.dot,
              node.status === "active" && "animate-pulse",
              node.status === "done" && "opacity-60",
              node.status === "error" && "bg-red-400",
            )}
          />

          {/* Icon + Name */}
          <span className="text-xs shrink-0">{node.icon}</span>
          <span className={cn("text-[11px] font-semibold truncate flex-1", meta.text)}>
            {node.agentName}
          </span>

          {/* Status badge */}
          <span
            className={cn(
              "text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
              status.className,
            )}
          >
            {status.label}
          </span>
        </div>

        {/* Latest thought */}
        <p className="text-[10px] text-foreground/60 leading-snug break-words line-clamp-2 mt-1 pl-5">
          {node.latestThought.slice(0, 180)}
          {node.status === "active" && (
            <span className="inline-block w-1 h-3 bg-current ml-0.5 animate-pulse align-middle" />
          )}
        </p>

        {/* Stats */}
        <div className="flex gap-3 mt-1 pl-5">
          <span className="text-[9px] text-muted-foreground/35">
            {node.thoughtCount} steps
          </span>
          {node.fileChanges > 0 && (
            <span className="text-[9px] text-green-400/50 flex items-center gap-0.5">
              <FileCode2 className="h-2.5 w-2.5" />
              {node.fileChanges} files
            </span>
          )}
          {hasChildren && (
            <span className="text-[9px] text-muted-foreground/35">
              {node.children.length} sub-agents
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1 relative">
          {node.children.map(child => (
            <AgentTreeNode
              key={child.agentId}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              isRunning={isRunning}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon}
      <p className="text-xs text-muted-foreground mt-3">{title}</p>
      <p className="text-[10px] text-muted-foreground/40 mt-1">{subtitle}</p>
    </div>
  );
}
