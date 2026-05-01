/**
 * MISSION CONTROL — The live action dashboard for the agent swarm.
 *
 * Shows the real-time activity feed, agent tree, and mission status.
 * This is what Don means by "I wanna see live action to know that
 * it's actually doing what it's supposed to."
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import {
  Activity,
  Bot,
  Brain,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  DollarSign,
  Eye,
  FileCode,
  FileDown,
  FilePlus,
  FileX,
  Flame,
  FlaskConical,
  GitBranch,
  Loader2,
  MessageSquare,
  Paintbrush,
  Pause,
  Rocket,
  Sparkles,
  TestTube,
  TreePine,
  XCircle,
  Zap,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface Mission {
  _id: Id<"missions">;
  prompt: string;
  status: "planning" | "running" | "paused" | "completed" | "failed";
  plan?: string;
  totalAgentsSpawned?: number;
  totalFilesCreated?: number;
  totalCost?: number;
  startedAt: number;
  completedAt?: number;
}

interface AgentRun {
  _id: Id<"agentRuns">;
  missionId: Id<"missions">;
  parentAgentId?: Id<"agentRuns">;
  role: string;
  title: string;
  description: string;
  model: string;
  status: string;
  depth: number;
  childCount?: number;
  filesCreated?: number;
  filesModified?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

interface ActivityEntry {
  _id: string;
  missionId: Id<"missions">;
  agentRunId: Id<"agentRuns">;
  type: string;
  title: string;
  detail?: string;
  filePath?: string;
  agentRole: string;
  agentModel: string;
  timestamp: number;
}

// ─── Role Config ────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  string,
  { emoji: string; color: string; bgColor: string; label: string }
> = {
  orchestrator: {
    emoji: "🧠",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    label: "Orchestrator",
  },
  planner: {
    emoji: "📋",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    label: "Planner",
  },
  architect: {
    emoji: "🏗️",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    label: "Architect",
  },
  coder: {
    emoji: "💻",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    label: "Coder",
  },
  reviewer: {
    emoji: "🔍",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    label: "Reviewer",
  },
  debugger: {
    emoji: "🐛",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    label: "Debugger",
  },
  tester: {
    emoji: "🧪",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    label: "Tester",
  },
  styler: {
    emoji: "🎨",
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
    label: "Styler",
  },
};

const EVENT_ICONS: Record<string, JSX.Element> = {
  thinking: <Brain className="w-3.5 h-3.5 text-purple-400" />,
  plan: <FileCode className="w-3.5 h-3.5 text-blue-400" />,
  spawn: <GitBranch className="w-3.5 h-3.5 text-cyan-400" />,
  file_create: <FilePlus className="w-3.5 h-3.5 text-green-400" />,
  file_modify: <FileDown className="w-3.5 h-3.5 text-yellow-400" />,
  file_delete: <FileX className="w-3.5 h-3.5 text-red-400" />,
  code: <Code2 className="w-3.5 h-3.5 text-emerald-400" />,
  test: <TestTube className="w-3.5 h-3.5 text-orange-400" />,
  error: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  fix: <Bug className="w-3.5 h-3.5 text-amber-400" />,
  review: <Eye className="w-3.5 h-3.5 text-yellow-400" />,
  complete: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  message: <MessageSquare className="w-3.5 h-3.5 text-gray-400" />,
};

const STATUS_DISPLAY: Record<
  string,
  { icon: JSX.Element; label: string; color: string }
> = {
  queued: {
    icon: <Clock className="w-3 h-3" />,
    label: "Queued",
    color: "text-gray-400",
  },
  thinking: {
    icon: <Brain className="w-3 h-3 animate-pulse" />,
    label: "Thinking",
    color: "text-purple-400",
  },
  coding: {
    icon: <Code2 className="w-3 h-3 animate-pulse" />,
    label: "Coding",
    color: "text-green-400",
  },
  reviewing: {
    icon: <Eye className="w-3 h-3 animate-pulse" />,
    label: "Reviewing",
    color: "text-yellow-400",
  },
  spawning: {
    icon: <GitBranch className="w-3 h-3 animate-pulse" />,
    label: "Spawning",
    color: "text-cyan-400",
  },
  waiting: {
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: "Waiting",
    color: "text-blue-400",
  },
  completed: {
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "Done",
    color: "text-green-500",
  },
  failed: {
    icon: <XCircle className="w-3 h-3" />,
    label: "Failed",
    color: "text-red-500",
  },
};

// ─── Main Component ─────────────────────────────────────────────

interface MissionControlProps {
  projectId: Id<"projects">;
  compact?: boolean;
}

export function MissionControl({ projectId, compact }: MissionControlProps) {
  const mission = useQuery(api.swarm.getActiveMission, { projectId });
  const [activeTab, setActiveTab] = useState<"feed" | "agents" | "files">(
    "feed"
  );

  if (!mission) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 mb-4">
          <Rocket className="w-10 h-10 text-purple-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Agent Swarm Ready
        </h3>
        <p className="text-sm text-gray-400 max-w-xs">
          Describe what you want built in the chat. The swarm will plan, code,
          review, and debug — all in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Mission Header */}
      <MissionHeader mission={mission} />

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700/50 px-2">
        <TabButton
          active={activeTab === "feed"}
          onClick={() => setActiveTab("feed")}
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Live Feed"
        />
        <TabButton
          active={activeTab === "agents"}
          onClick={() => setActiveTab("agents")}
          icon={<TreePine className="w-3.5 h-3.5" />}
          label="Agent Tree"
        />
        <TabButton
          active={activeTab === "files"}
          onClick={() => setActiveTab("files")}
          icon={<FileCode className="w-3.5 h-3.5" />}
          label="Files"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "feed" && <ActivityFeed mission={mission} />}
        {activeTab === "agents" && <AgentTree mission={mission} />}
        {activeTab === "files" && <FileChanges mission={mission} />}
      </div>
    </div>
  );
}

// ─── Mission Header ─────────────────────────────────────────────

function MissionHeader({ mission }: { mission: Mission }) {
  const isActive = mission.status === "planning" || mission.status === "running";
  const elapsed = mission.completedAt
    ? mission.completedAt - mission.startedAt
    : Date.now() - mission.startedAt;

  return (
    <div className="px-3 py-2.5 border-b border-gray-700/50 bg-gradient-to-r from-purple-900/20 via-[#0d1117] to-cyan-900/20">
      {/* Status Row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {isActive ? (
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </div>
          ) : mission.status === "completed" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          ) : mission.status === "failed" ? (
            <XCircle className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <Pause className="w-3.5 h-3.5 text-yellow-500" />
          )}
          <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
            {mission.status === "planning"
              ? "Planning..."
              : mission.status === "running"
                ? "Swarm Active"
                : mission.status === "completed"
                  ? "Mission Complete"
                  : mission.status === "failed"
                    ? "Mission Failed"
                    : "Paused"}
          </span>
        </div>
        <span className="text-xs text-gray-500 tabular-nums">
          {formatDuration(elapsed)}
        </span>
      </div>

      {/* Prompt */}
      <p className="text-xs text-gray-400 truncate mb-2" title={mission.prompt}>
        {mission.prompt}
      </p>

      {/* Stats Row */}
      <div className="flex items-center gap-3">
        <StatBadge
          icon={<Bot className="w-3 h-3" />}
          value={mission.totalAgentsSpawned || 0}
          label="agents"
        />
        <StatBadge
          icon={<FileCode className="w-3 h-3" />}
          value={mission.totalFilesCreated || 0}
          label="files"
        />
        <StatBadge
          icon={<DollarSign className="w-3 h-3" />}
          value={`$${(mission.totalCost || 0).toFixed(3)}`}
          label="cost"
        />
      </div>
    </div>
  );
}

function StatBadge({
  icon,
  value,
  label,
}: {
  icon: JSX.Element;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1 text-gray-400">
      {icon}
      <span className="text-xs font-medium text-white tabular-nums">{value}</span>
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}

// ─── Activity Feed (Live Action) ────────────────────────────────

function ActivityFeed({ mission }: { mission: Mission }) {
  const activities = useQuery(api.swarm.getActivityLog, {
    missionId: mission._id,
    limit: 200,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prevCount = useRef(0);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    if (!activities || !autoScroll || !scrollRef.current) return;
    if (activities.length > prevCount.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCount.current = activities.length;
  }, [activities?.length, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Waiting for activity...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto px-2 py-1 scroll-smooth"
    >
      {activities.map((entry, idx) => {
        const roleConfig = ROLE_CONFIG[entry.agentRole] || ROLE_CONFIG.coder;
        const icon = EVENT_ICONS[entry.type] || EVENT_ICONS.message;
        const isExpanded = expandedId === entry._id;
        const showDetail =
          entry.detail &&
          entry.type !== "thinking" &&
          entry.type !== "message";

        return (
          <div
            key={entry._id}
            className={cn(
              "group flex gap-2 py-1.5 px-1 rounded-md transition-colors",
              "hover:bg-gray-800/40",
              entry.type === "error" && "bg-red-900/10",
              entry.type === "complete" && "bg-green-900/10",
              entry.type === "spawn" && "bg-cyan-900/10"
            )}
          >
            {/* Timeline dot */}
            <div className="flex flex-col items-center mt-1">
              <div
                className={cn(
                  "rounded-full p-1",
                  roleConfig.bgColor
                )}
              >
                {icon}
              </div>
              {idx < activities.length - 1 && (
                <div className="w-px flex-1 bg-gray-700/30 mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn("text-[10px] font-medium", roleConfig.color)}>
                  {roleConfig.emoji} {roleConfig.label}
                </span>
                <span className="text-[10px] text-gray-600">•</span>
                <span className="text-[10px] text-gray-500 tabular-nums">
                  {formatTime(entry.timestamp)}
                </span>
                {entry.filePath && (
                  <>
                    <span className="text-[10px] text-gray-600">•</span>
                    <span className="text-[10px] text-cyan-400/70 font-mono truncate">
                      {entry.filePath}
                    </span>
                  </>
                )}
              </div>

              <div
                className={cn(
                  "text-xs text-gray-300 leading-relaxed",
                  showDetail && "cursor-pointer"
                )}
                onClick={() =>
                  showDetail &&
                  setExpandedId(isExpanded ? null : entry._id)
                }
              >
                <span>{entry.title}</span>
                {showDetail && !isExpanded && (
                  <ChevronRight className="inline w-3 h-3 ml-1 text-gray-500" />
                )}
                {showDetail && isExpanded && (
                  <ChevronDown className="inline w-3 h-3 ml-1 text-gray-500" />
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && entry.detail && (
                <div className="mt-1.5 p-2 rounded bg-gray-800/60 border border-gray-700/40">
                  <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-48 overflow-y-auto">
                    {entry.detail}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: "smooth",
            });
          }}
          className="sticky bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-purple-600/90 text-white text-xs flex items-center gap-1 hover:bg-purple-500 transition-colors shadow-lg"
        >
          <ChevronDown className="w-3 h-3" /> Live
        </button>
      )}
    </div>
  );
}

// ─── Agent Tree Visualization ───────────────────────────────────

function AgentTree({ mission }: { mission: Mission }) {
  const agents = useQuery(api.swarm.listAgentRuns, {
    missionId: mission._id,
  });

  if (!agents || agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No agents spawned yet
      </div>
    );
  }

  // Build tree structure
  const rootAgents = agents.filter((a) => !a.parentAgentId);
  const childMap = new Map<string, AgentRun[]>();
  agents.forEach((a) => {
    if (a.parentAgentId) {
      const children = childMap.get(a.parentAgentId) || [];
      children.push(a);
      childMap.set(a.parentAgentId, children);
    }
  });

  return (
    <div className="h-full overflow-y-auto px-2 py-2">
      {rootAgents.map((agent) => (
        <AgentNode
          key={agent._id}
          agent={agent}
          childMap={childMap}
          depth={0}
        />
      ))}
    </div>
  );
}

function AgentNode({
  agent,
  childMap,
  depth,
}: {
  agent: AgentRun;
  childMap: Map<string, AgentRun[]>;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = childMap.get(agent._id) || [];
  const roleConfig = ROLE_CONFIG[agent.role] || ROLE_CONFIG.coder;
  const statusConfig = STATUS_DISPLAY[agent.status] || STATUS_DISPLAY.queued;
  const isActive =
    agent.status === "thinking" ||
    agent.status === "coding" ||
    agent.status === "spawning" ||
    agent.status === "reviewing";

  return (
    <div className="mb-1">
      <div
        style={{ paddingLeft: `${depth * 16}px` }}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md transition-all",
          "hover:bg-gray-800/40",
          isActive && "bg-gray-800/30 ring-1 ring-inset ring-purple-500/20"
        )}
      >
        {/* Expand toggle */}
        {children.length > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-500 hover:text-gray-300"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-3" />
        )}

        {/* Role icon */}
        <div
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-md text-xs",
            roleConfig.bgColor
          )}
        >
          {roleConfig.emoji}
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-white truncate">
              {agent.title}
            </span>
            {isActive && (
              <span className="flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-[10px]", roleConfig.color)}>
              {roleConfig.label}
            </span>
            <span className="text-[10px] text-gray-600">•</span>
            <span className="text-[10px] text-gray-500">{agent.model}</span>
          </div>
        </div>

        {/* Status */}
        <div className={cn("flex items-center gap-1", statusConfig.color)}>
          {statusConfig.icon}
          <span className="text-[10px] font-medium">{statusConfig.label}</span>
        </div>

        {/* Stats */}
        {(agent.filesCreated || 0) > 0 && (
          <div className="flex items-center gap-0.5 text-gray-500">
            <FileCode className="w-3 h-3" />
            <span className="text-[10px]">{agent.filesCreated}</span>
          </div>
        )}
        {(agent.cost || 0) > 0 && (
          <span className="text-[10px] text-gray-500 tabular-nums">
            ${agent.cost?.toFixed(4)}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded &&
        children.map((child) => (
          <AgentNode
            key={child._id}
            agent={child}
            childMap={childMap}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

// ─── File Changes View ──────────────────────────────────────────

function FileChanges({ mission }: { mission: Mission }) {
  const activities = useQuery(api.swarm.getActivityLog, {
    missionId: mission._id,
    limit: 500,
  });

  if (!activities) return null;

  const fileEvents = activities.filter(
    (a) =>
      a.type === "file_create" ||
      a.type === "file_modify" ||
      a.type === "file_delete"
  );

  if (fileEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No file changes yet
      </div>
    );
  }

  // Group by file
  const fileMap = new Map<
    string,
    { path: string; events: ActivityEntry[]; latestType: string }
  >();
  fileEvents.forEach((e) => {
    const path = e.filePath || "unknown";
    const existing = fileMap.get(path);
    if (existing) {
      existing.events.push(e);
      existing.latestType = e.type;
    } else {
      fileMap.set(path, { path, events: [e], latestType: e.type });
    }
  });

  return (
    <div className="h-full overflow-y-auto px-2 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider px-2 mb-2">
        {fileMap.size} files changed
      </div>
      {Array.from(fileMap.values()).map(({ path, events, latestType }) => (
        <FileChangeRow
          key={path}
          path={path}
          events={events}
          latestType={latestType}
        />
      ))}
    </div>
  );
}

function FileChangeRow({
  path,
  events,
  latestType,
}: {
  path: string;
  events: ActivityEntry[];
  latestType: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const lastEvent = events[events.length - 1];

  return (
    <div className="mb-1">
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-800/40 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {latestType === "file_create" ? (
          <FilePlus className="w-3.5 h-3.5 text-green-400" />
        ) : latestType === "file_modify" ? (
          <FileDown className="w-3.5 h-3.5 text-yellow-400" />
        ) : (
          <FileX className="w-3.5 h-3.5 text-red-400" />
        )}
        <span className="text-xs text-cyan-300 font-mono flex-1 truncate">
          {path}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] py-0 h-4",
            latestType === "file_create" && "border-green-600 text-green-400",
            latestType === "file_modify" && "border-yellow-600 text-yellow-400",
            latestType === "file_delete" && "border-red-600 text-red-400"
          )}
        >
          {latestType.replace("file_", "")}
        </Badge>
        <span className="text-[10px] text-gray-500">
          by {ROLE_CONFIG[lastEvent.agentRole]?.emoji} {lastEvent.agentRole}
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-500" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-500" />
        )}
      </div>

      {expanded && lastEvent.detail && (
        <div className="ml-6 mr-2 mb-1 p-2 rounded bg-gray-800/60 border border-gray-700/40">
          <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-64 overflow-y-auto">
            {lastEvent.detail}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Utility Components ─────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: JSX.Element;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2",
        active
          ? "text-white border-purple-500"
          : "text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remainSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
