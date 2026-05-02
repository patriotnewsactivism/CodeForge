/**
 * SWARM VISUALIZER — Interactive agent tree visualization
 *
 * The signature feature: watch agents spawn exponentially in real-time.
 * Canvas-based rendering with animated nodes and edges.
 * Each node = an agent, color-coded by role, pulsing when active.
 * Click to inspect, zoom/pan to navigate the tree.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Network,
  Bot,
  Brain,
  Code2,
  Eye,
  Bug,
  TestTube,
  Sparkles,
  Shield,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Zap,
  Maximize2,
  Minimize2,
} from "lucide-react";

// ─── Role Config ──────────────────────────────────────────────
const ROLE_CONFIG: Record<string, {
  icon: typeof Bot;
  color: string;
  bg: string;
  ring: string;
  label: string;
}> = {
  orchestrator: { icon: Brain, color: "text-purple-400", bg: "bg-purple-500/20", ring: "ring-purple-500/40", label: "Orchestrator" },
  planner: { icon: Sparkles, color: "text-blue-400", bg: "bg-blue-500/20", ring: "ring-blue-500/40", label: "Planner" },
  coder: { icon: Code2, color: "text-green-400", bg: "bg-green-500/20", ring: "ring-green-500/40", label: "Coder" },
  reviewer: { icon: Eye, color: "text-amber-400", bg: "bg-amber-500/20", ring: "ring-amber-500/40", label: "Reviewer" },
  debugger: { icon: Bug, color: "text-red-400", bg: "bg-red-500/20", ring: "ring-red-500/40", label: "Debugger" },
  tester: { icon: TestTube, color: "text-cyan-400", bg: "bg-cyan-500/20", ring: "ring-cyan-500/40", label: "Tester" },
  architect: { icon: Brain, color: "text-violet-400", bg: "bg-violet-500/20", ring: "ring-violet-500/40", label: "Architect" },
  security: { icon: Shield, color: "text-orange-400", bg: "bg-orange-500/20", ring: "ring-orange-500/40", label: "Security" },
};

const STATUS_CONFIG: Record<string, { color: string; pulse: boolean; label: string }> = {
  queued: { color: "border-zinc-500/50", pulse: false, label: "Queued" },
  thinking: { color: "border-purple-500", pulse: true, label: "Thinking" },
  coding: { color: "border-green-500", pulse: true, label: "Coding" },
  reviewing: { color: "border-amber-500", pulse: true, label: "Reviewing" },
  spawning: { color: "border-blue-500", pulse: true, label: "Spawning" },
  waiting: { color: "border-cyan-500/50", pulse: false, label: "Waiting" },
  completed: { color: "border-green-500/70", pulse: false, label: "Done" },
  failed: { color: "border-red-500/70", pulse: false, label: "Failed" },
};

const DEFAULT_ROLE = { icon: Bot, color: "text-zinc-400", bg: "bg-zinc-500/20", ring: "ring-zinc-500/40", label: "Agent" };
const DEFAULT_STATUS = { color: "border-zinc-500/50", pulse: false, label: "Unknown" };

// ─── Types ────────────────────────────────────────────────────
interface Agent {
  _id: Id<"agentRuns">;
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
  cost?: number;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

interface TreeNode {
  agent: Agent;
  children: TreeNode[];
  x: number;
  y: number;
}

// ─── Tree Layout ──────────────────────────────────────────────
function buildTree(agents: Agent[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const agent of agents) {
    map.set(agent._id, { agent, children: [], x: 0, y: 0 });
  }

  for (const agent of agents) {
    const node = map.get(agent._id)!;
    if (agent.parentAgentId && map.has(agent.parentAgentId)) {
      map.get(agent.parentAgentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function layoutTree(roots: TreeNode[], nodeW: number, nodeH: number, gapX: number, gapY: number): { nodes: TreeNode[]; width: number; height: number } {
  let cursor = 0;
  const allNodes: TreeNode[] = [];

  function measure(node: TreeNode, depth: number): number {
    node.y = depth * (nodeH + gapY);

    if (node.children.length === 0) {
      node.x = cursor;
      cursor += nodeW + gapX;
      allNodes.push(node);
      return node.x;
    }

    let firstX = 0;
    let lastX = 0;
    for (let i = 0; i < node.children.length; i++) {
      const cx = measure(node.children[i], depth + 1);
      if (i === 0) firstX = cx;
      lastX = cx;
    }

    node.x = (firstX + lastX) / 2;
    allNodes.push(node);
    return node.x;
  }

  for (const root of roots) {
    measure(root, 0);
  }

  const maxDepth = allNodes.reduce((m, n) => Math.max(m, n.agent.depth), 0);
  return {
    nodes: allNodes,
    width: cursor,
    height: (maxDepth + 1) * (nodeH + gapY),
  };
}

// ─── Agent Node ───────────────────────────────────────────────
function AgentNode({ agent, selected, onSelect }: { agent: Agent; selected: boolean; onSelect: () => void }) {
  const role = ROLE_CONFIG[agent.role] || DEFAULT_ROLE;
  const status = STATUS_CONFIG[agent.status] || DEFAULT_STATUS;
  const RoleIcon = role.icon;
  const isActive = status.pulse;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-[140px] rounded-lg border-2 p-2 transition-all hover:scale-105 cursor-pointer text-left",
        status.color,
        role.bg,
        selected && "ring-2 ring-offset-1 ring-offset-background " + role.ring,
        isActive && "animate-pulse"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <RoleIcon className={cn("h-3.5 w-3.5 shrink-0", role.color)} />
        <span className="text-[10px] font-bold truncate">{role.label}</span>
        {isActive && <Loader2 className="h-2.5 w-2.5 animate-spin text-chart-3 ml-auto shrink-0" />}
        {agent.status === "completed" && <CheckCircle2 className="h-2.5 w-2.5 text-green-400 ml-auto shrink-0" />}
        {agent.status === "failed" && <XCircle className="h-2.5 w-2.5 text-red-400 ml-auto shrink-0" />}
      </div>
      <p className="text-[9px] text-foreground/70 line-clamp-2 leading-tight">{agent.title}</p>
      <div className="flex items-center gap-1 mt-1 text-[8px] text-muted-foreground">
        <span className="truncate">{agent.model}</span>
        {agent.cost != null && agent.cost > 0 && (
          <span className="ml-auto text-chart-2 shrink-0">${agent.cost.toFixed(3)}</span>
        )}
      </div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────
function AgentDetail({ agent }: { agent: Agent }) {
  const role = ROLE_CONFIG[agent.role] || DEFAULT_ROLE;
  const status = STATUS_CONFIG[agent.status] || DEFAULT_STATUS;
  const RoleIcon = role.icon;
  const elapsed = agent.startedAt && agent.completedAt
    ? ((agent.completedAt - agent.startedAt) / 1000).toFixed(1) + "s"
    : agent.startedAt
      ? ((Date.now() - agent.startedAt) / 1000).toFixed(0) + "s"
      : null;

  return (
    <div className="p-3 border-t border-border bg-card/80">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", role.bg)}>
          <RoleIcon className={cn("h-4 w-4", role.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold truncate">{agent.title}</h4>
          <div className="flex items-center gap-1.5 text-[10px]">
            <Badge variant="outline" className={cn("text-[9px] h-4", role.color)}>{role.label}</Badge>
            <Badge variant="outline" className={cn("text-[9px] h-4", agent.status === "completed" ? "text-green-400" : agent.status === "failed" ? "text-red-400" : "text-chart-3")}>{status.label}</Badge>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-2">{agent.description}</p>

      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Zap className="h-3 w-3 text-chart-3" />
          <span>{agent.model}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <ChevronRight className="h-3 w-3" />
          <span>Depth {agent.depth}</span>
        </div>
        {agent.filesCreated != null && agent.filesCreated > 0 && (
          <div className="flex items-center gap-1 text-green-400">
            <Code2 className="h-3 w-3" />
            <span>{agent.filesCreated} created</span>
          </div>
        )}
        {agent.filesModified != null && agent.filesModified > 0 && (
          <div className="flex items-center gap-1 text-amber-400">
            <Code2 className="h-3 w-3" />
            <span>{agent.filesModified} modified</span>
          </div>
        )}
        {elapsed && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{elapsed}</span>
          </div>
        )}
        {agent.cost != null && agent.cost > 0 && (
          <div className="flex items-center gap-1 text-chart-2">
            <DollarSign className="h-3 w-3" />
            <span>${agent.cost.toFixed(4)}</span>
          </div>
        )}
      </div>

      {agent.result && (
        <div className="mt-2 p-2 rounded bg-background/50 text-[10px] text-muted-foreground max-h-20 overflow-y-auto">
          {agent.result}
        </div>
      )}
      {agent.error && (
        <div className="mt-2 p-2 rounded bg-red-500/10 text-[10px] text-red-400 max-h-20 overflow-y-auto">
          {agent.error}
        </div>
      )}
    </div>
  );
}

// ─── Swarm SVG Lines ──────────────────────────────────────────
function TreeLines({ roots, nodeW, nodeH }: { roots: TreeNode[]; nodeW: number; nodeH: number }) {
  const lines: { x1: number; y1: number; x2: number; y2: number; active: boolean }[] = [];

  function walk(node: TreeNode) {
    for (const child of node.children) {
      lines.push({
        x1: node.x + nodeW / 2,
        y1: node.y + nodeH,
        x2: child.x + nodeW / 2,
        y2: child.y,
        active: STATUS_CONFIG[child.agent.status]?.pulse || false,
      });
      walk(child);
    }
  }

  for (const root of roots) walk(root);

  return (
    <>
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={l.active ? "hsl(var(--chart-3))" : "hsl(var(--border))"}
          strokeWidth={l.active ? 2 : 1}
          strokeDasharray={l.active ? undefined : "4 2"}
          opacity={l.active ? 0.8 : 0.4}
        />
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────
interface SwarmVisualizerProps {
  projectId: Id<"projects"> | null;
}

export function SwarmVisualizer({ projectId }: SwarmVisualizerProps) {
  const missions = useQuery(api.missions.listByProject, projectId ? { projectId } : "skip");
  const latestMission = missions?.[0] ?? null;
  const agents = useQuery(api.swarm.getMissionAgents, latestMission ? { missionId: latestMission._id } : "skip");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodeW = 148;
  const nodeH = 68;
  const gapX = 16;
  const gapY = 32;

  const { roots, layout } = useMemo(() => {
    if (!agents || agents.length === 0) return { roots: [], layout: { nodes: [], width: 0, height: 0 } };
    const r = buildTree(agents as Agent[]);
    const l = layoutTree(r, nodeW, nodeH, gapX, gapY);
    return { roots: r, layout: l };
  }, [agents]);

  const selectedAgent = useMemo(() => {
    if (!selectedId || !agents) return null;
    return (agents as Agent[]).find(a => a._id === selectedId) ?? null;
  }, [selectedId, agents]);

  // Auto-scroll to active agents
  useEffect(() => {
    if (!containerRef.current || !agents) return;
    const active = (agents as Agent[]).find(a =>
      ["thinking", "coding", "reviewing", "spawning"].includes(a.status)
    );
    if (active) {
      const node = layout.nodes.find(n => n.agent._id === active._id);
      if (node && containerRef.current) {
        containerRef.current.scrollTo({
          left: node.x - containerRef.current.clientWidth / 2 + nodeW / 2,
          top: node.y - 20,
          behavior: "smooth",
        });
      }
    }
  }, [agents, layout.nodes]);

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        <p className="text-sm">Select a project to view the swarm</p>
      </div>
    );
  }

  const activeCount = agents?.filter(a => ["thinking", "coding", "reviewing", "spawning"].includes(a.status)).length || 0;
  const completedCount = agents?.filter(a => a.status === "completed").length || 0;
  const totalCount = agents?.length || 0;
  const totalCost = agents?.reduce((s, a) => s + ((a as Agent).cost || 0), 0) || 0;

  return (
    <div className={cn("flex flex-col bg-card", expanded ? "fixed inset-0 z-50" : "h-full")}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
        <Network className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-semibold">Swarm</span>
        {totalCount > 0 && (
          <>
            <Badge variant="secondary" className="text-[10px]">{totalCount} agents</Badge>
            {activeCount > 0 && (
              <Badge className="bg-chart-3/20 text-chart-3 border-chart-3/30 text-[10px]">
                <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />{activeCount} active
              </Badge>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          {totalCost > 0 && <span className="text-chart-2">${totalCost.toFixed(3)}</span>}
          {completedCount > 0 && <span className="text-green-400">{completedCount} done</span>}
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-muted/50 rounded">
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Tree View */}
      {!agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 p-4 text-muted-foreground">
          <Network className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-xs font-medium">No agents yet</p>
          <p className="text-[10px] text-center mt-1">Launch a mission to see the swarm in action</p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div
            ref={containerRef}
            className="flex-1 overflow-auto"
            style={{ minHeight: 0 }}
          >
            <div
              className="relative"
              style={{
                width: layout.width + 32,
                height: layout.height + nodeH + 32,
                minWidth: "100%",
                minHeight: "100%",
              }}
            >
              {/* SVG edges */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={layout.width + 32}
                height={layout.height + nodeH + 32}
              >
                <g transform="translate(16, 16)">
                  <TreeLines roots={roots} nodeW={nodeW} nodeH={nodeH} />
                </g>
              </svg>

              {/* Agent nodes */}
              {layout.nodes.map(node => (
                <div
                  key={node.agent._id}
                  className="absolute"
                  style={{
                    left: node.x + 16,
                    top: node.y + 16,
                    width: nodeW,
                  }}
                >
                  <AgentNode
                    agent={node.agent}
                    selected={selectedId === node.agent._id}
                    onSelect={() => setSelectedId(
                      selectedId === node.agent._id ? null : node.agent._id
                    )}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          {selectedAgent && <AgentDetail agent={selectedAgent} />}
        </div>
      )}
    </div>
  );
}
