/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — AGENT ACTIVITY PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * Real-time streaming view of agent activity.
 * Subscribes to toolCalls + agentThoughts tables for live updates.
 *
 * Shows: agent tree, live tool calls, thinking phases, file changes.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bot,
  FileCode,
  FilePlus,
  FileX,
  Search,
  Edit3,
  Eye,
  Brain,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Users,
  Clock,
  Sparkles,
  MessageSquare,
} from "lucide-react";

interface AgentActivityPanelProps {
  missionId: Id<"missions"> | null;
  projectId?: Id<"projects"> | null;
}

// ─── Tool Call Icons ────────────────────────────────────────────
const TOOL_ICONS: Record<string, typeof FileCode> = {
  create_file: FilePlus,
  edit_file: Edit3,
  delete_file: FileX,
  read_file: Eye,
  list_files: FileCode,
  search_files: Search,
  spawn_agent: Users,
  send_message: MessageSquare,
  complete_task: CheckCircle2,
};

const TOOL_COLORS: Record<string, string> = {
  create_file: "text-emerald-400",
  edit_file: "text-amber-400",
  delete_file: "text-red-400",
  read_file: "text-blue-400",
  list_files: "text-cyan-400",
  search_files: "text-purple-400",
  spawn_agent: "text-pink-400",
  send_message: "text-sky-400",
  complete_task: "text-emerald-400",
};

const PHASE_ICONS: Record<string, typeof Brain> = {
  thinking: Brain,
  acting: Zap,
  observing: Eye,
  reflecting: Sparkles,
};

// ─── Tool Call Entry ────────────────────────────────────────────
function ToolCallEntry({ tc }: { tc: any }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[tc.toolName] || Zap;
  const color = TOOL_COLORS[tc.toolName] || "text-white/50";

  let summary = tc.toolName;
  try {
    const input = JSON.parse(tc.toolInput);
    if (input.path) summary = `${tc.toolName} → ${input.path}`;
    else if (input.title) summary = `${tc.toolName} → ${input.title}`;
    else if (input.query) summary = `${tc.toolName} → "${input.query}"`;
    else if (input.summary) summary = `complete → ${input.summary.slice(0, 60)}`;
  } catch {}

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.03] transition-colors text-left"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
        <span className="text-[11px] text-white/60 truncate flex-1">{summary}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {tc.status === "executing" && (
            <Loader2 className="h-3 w-3 text-emerald-400 animate-spin" />
          )}
          {tc.status === "success" && (
            <CheckCircle2 className="h-3 w-3 text-emerald-400/60" />
          )}
          {tc.status === "error" && (
            <XCircle className="h-3 w-3 text-red-400/60" />
          )}
          {tc.duration ? (
            <span className="text-[9px] text-white/20">{tc.duration}ms</span>
          ) : null}
        </div>
      </button>

      {expanded && tc.toolOutput && (
        <div className="mx-3 mb-2 rounded-md bg-black/40 border border-white/5 overflow-hidden">
          <pre className="p-2 text-[10px] text-white/40 overflow-x-auto max-h-32 overflow-y-auto leading-relaxed">
            {tc.toolOutput.slice(0, 2000)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Agent Node ─────────────────────────────────────────────────
function AgentNode({ agent, allAgents }: { agent: any; allAgents: any[] }) {
  const [expanded, setExpanded] = useState(agent.depth === 0);
  const children = allAgents.filter((a) => a.parentAgentId === agent._id);

  const statusDot = {
    running: "bg-emerald-400 animate-pulse",
    completed: "bg-emerald-400",
    failed: "bg-red-400",
    queued: "bg-white/20",
    waiting: "bg-amber-400 animate-pulse",
  }[agent.status] || "bg-white/20";

  return (
    <div className="ml-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.03] transition-colors text-left"
        style={{ paddingLeft: `${12 + agent.depth * 16}px` }}
      >
        {children.length > 0 ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-white/30 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot)} />
        <span className="text-[11px] text-white/50 capitalize shrink-0">{agent.role}</span>
        <span className="text-[11px] text-white/70 truncate flex-1">{agent.title}</span>
        {agent.status === "running" && (
          <span className="text-[9px] text-emerald-400/50 shrink-0">
            iter {(agent.loopIteration || 0) + 1}
          </span>
        )}
        {agent.toolCallCount > 0 && (
          <span className="text-[9px] text-white/20 shrink-0">
            {agent.toolCallCount} calls
          </span>
        )}
      </button>

      {expanded && agent.result && (
        <div className="ml-12 mr-3 mb-1 text-[10px] text-white/30 truncate">
          ✓ {agent.result.slice(0, 100)}
        </div>
      )}

      {expanded &&
        children.map((child) => (
          <AgentNode key={child._id} agent={child} allAgents={allAgents} />
        ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export function AgentActivityPanel({ missionId, projectId }: AgentActivityPanelProps) {
  const [tab, setTab] = useState<"feed" | "agents" | "thoughts">("feed");

  const mission = useQuery(api.engine.getMission, missionId ? { missionId } : "skip");
  const agents = useQuery(api.engine.listMissionAgents, missionId ? { missionId } : "skip");
  const toolCalls = useQuery(api.engine.listMissionToolCalls, missionId ? { missionId } : "skip");
  const thoughts = useQuery(api.engine.listAgentThoughts, missionId ? { missionId } : "skip");

  // Also get recent missions for the project if no specific mission
  const projectMissions = useQuery(
    api.missions.listByProject,
    !missionId && projectId ? { projectId } : "skip"
  );

  // Pick the latest active mission from project
  const activeMission = missionId
    ? mission
    : projectMissions?.find((m) => m.status === "running" || m.status === "planning");

  const effectiveMissionId = missionId || (activeMission as any)?._id;

  if (!effectiveMissionId) {
    return (
      <div className="flex h-full flex-col bg-[#0a0a0f] border-l border-white/5">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02]">
          <Activity className="h-4 w-4 text-emerald-400/50" />
          <span className="text-xs font-semibold text-white/50">Agent Activity</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-white/20">
            <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-xs">No active mission</p>
            <p className="text-[10px] mt-1">Send a code request to see agents work here</p>
          </div>
        </div>
      </div>
    );
  }

  const rootAgents = (agents || []).filter((a) => !a.parentAgentId);
  const running = (agents || []).filter((a) => a.status === "running").length;
  const completed = (agents || []).filter((a) => a.status === "completed").length;
  const total = agents?.length || 0;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] border-l border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Activity className={cn("h-4 w-4", running > 0 ? "text-emerald-400 animate-pulse" : "text-emerald-400/50")} />
          <span className="text-xs font-semibold text-white/80">Agent Activity</span>
          {running > 0 && (
            <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/20 text-emerald-400 border-0">
              {running} running
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/30">
          <span>{completed}/{total}</span>
          {mission?.totalCost ? (
            <>
              <span>·</span>
              <span className="text-emerald-400/50">${mission.totalCost.toFixed(4)}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {(["feed", "agents", "thoughts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-medium transition-colors",
              tab === t
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-white/30 hover:text-white/50"
            )}
          >
            {t === "feed" ? `Tool Calls (${toolCalls?.length || 0})` :
             t === "agents" ? `Agents (${total})` :
             `Thoughts (${thoughts?.length || 0})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "feed" && (
          <div className="divide-y divide-white/[0.03]">
            {(toolCalls || []).map((tc) => (
              <ToolCallEntry key={tc._id} tc={tc} />
            ))}
            {(!toolCalls || toolCalls.length === 0) && (
              <div className="flex items-center justify-center py-8 text-white/20 text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Waiting for tool calls...
              </div>
            )}
          </div>
        )}

        {tab === "agents" && (
          <div className="py-1">
            {rootAgents.map((agent) => (
              <AgentNode key={agent._id} agent={agent} allAgents={agents || []} />
            ))}
          </div>
        )}

        {tab === "thoughts" && (
          <div className="space-y-0.5 p-2">
            {(thoughts || []).map((thought) => {
              const PhaseIcon = PHASE_ICONS[thought.phase] || Brain;
              return (
                <div key={thought._id} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.02]">
                  <PhaseIcon className={cn(
                    "h-3.5 w-3.5 mt-0.5 shrink-0",
                    thought.phase === "thinking" ? "text-amber-400/60" :
                    thought.phase === "acting" ? "text-emerald-400/60" :
                    thought.phase === "observing" ? "text-blue-400/60" :
                    "text-purple-400/60"
                  )} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-white/50">{thought.content}</span>
                    <div className="text-[9px] text-white/20 mt-0.5">
                      iter {thought.iteration + 1} · {thought.phase}
                    </div>
                  </div>
                </div>
              );
            })}
            {(!thoughts || thoughts.length === 0) && (
              <div className="flex items-center justify-center py-8 text-white/20 text-xs">
                <Brain className="h-4 w-4 mr-2 opacity-30" />
                Waiting for agent thoughts...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mission status bar */}
      {(mission || activeMission) && (
        <div className="border-t border-white/5 px-3 py-1.5 bg-white/[0.02] flex items-center gap-2 text-[10px]">
          {(mission?.status || (activeMission as any)?.status) === "running" && (
            <Loader2 className="h-3 w-3 text-emerald-400 animate-spin" />
          )}
          {(mission?.status || (activeMission as any)?.status) === "completed" && (
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          )}
          {(mission?.status || (activeMission as any)?.status) === "failed" && (
            <XCircle className="h-3 w-3 text-red-400" />
          )}
          <span className="text-white/40 capitalize">
            {(mission?.status || (activeMission as any)?.status) || "Unknown"}
          </span>
          {mission?.prompt && (
            <span className="text-white/20 truncate flex-1">{mission.prompt.slice(0, 60)}</span>
          )}
        </div>
      )}
    </div>
  );
}
