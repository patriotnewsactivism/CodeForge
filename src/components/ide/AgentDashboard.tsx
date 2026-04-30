import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Zap,
  Brain,
  FileCode,
  DollarSign,
} from "lucide-react";

interface AgentTask {
  _id: Id<"agentTasks">;
  _creationTime: number;
  title: string;
  description: string;
  status: "queued" | "running" | "completed" | "failed";
  model: string;
  filesCreated?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  startedAt?: number;
  completedAt?: number;
  agentIndex: number;
}

const AGENT_COLORS = [
  "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
  "text-violet-400 bg-violet-500/20 border-violet-500/30",
  "text-amber-400 bg-amber-500/20 border-amber-500/30",
  "text-emerald-400 bg-emerald-500/20 border-emerald-500/30",
  "text-rose-400 bg-rose-500/20 border-rose-500/30",
  "text-blue-400 bg-blue-500/20 border-blue-500/30",
  "text-orange-400 bg-orange-500/20 border-orange-500/30",
  "text-teal-400 bg-teal-500/20 border-teal-500/30",
  "text-pink-400 bg-pink-500/20 border-pink-500/30",
  "text-lime-400 bg-lime-500/20 border-lime-500/30",
];

const STATUS_CONFIG = {
  queued: {
    icon: Clock,
    label: "Queued",
    color: "text-muted-foreground",
    bg: "bg-muted/20",
  },
  running: {
    icon: Loader2,
    label: "Working...",
    color: "text-chart-3",
    bg: "bg-chart-3/10",
  },
  completed: {
    icon: CheckCircle2,
    label: "Done",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
};

function AgentCard({ task }: { task: AgentTask }) {
  const status = STATUS_CONFIG[task.status];
  const StatusIcon = status.icon;
  const colorClass = AGENT_COLORS[task.agentIndex % AGENT_COLORS.length];
  const elapsed =
    task.startedAt && task.completedAt
      ? ((task.completedAt - task.startedAt) / 1000).toFixed(1)
      : task.startedAt
        ? ((Date.now() - task.startedAt) / 1000).toFixed(0)
        : null;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all",
        status.bg,
        task.status === "running" && "border-chart-3/40 ring-1 ring-chart-3/20"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border",
              colorClass
            )}
          >
            {task.agentIndex + 1}
          </div>
          <div>
            <h4 className="text-[12px] font-semibold leading-tight">
              {task.title}
            </h4>
            <div className="flex items-center gap-1 mt-0.5">
              {task.model === "deepseek-v3.2" ? (
                <Zap className="h-2.5 w-2.5 text-chart-3" />
              ) : (
                <Brain className="h-2.5 w-2.5 text-chart-2" />
              )}
              <span className="text-[9px] text-muted-foreground">
                {task.model}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <StatusIcon
            className={cn(
              "h-4 w-4",
              status.color,
              task.status === "running" && "animate-spin"
            )}
          />
        </div>
      </div>

      {/* Progress bar for running tasks */}
      {task.status === "running" && (
        <div className="w-full h-1 rounded-full bg-background/50 overflow-hidden mb-2">
          <div className="h-full bg-chart-3 rounded-full animate-pulse w-2/3 transition-all" />
        </div>
      )}

      {/* Stats for completed */}
      {task.status === "completed" && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
          {task.filesCreated !== undefined && task.filesCreated > 0 && (
            <div className="flex items-center gap-0.5">
              <FileCode className="h-3 w-3 text-chart-3" />
              <span>
                {task.filesCreated} file{task.filesCreated !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {task.cost !== undefined && task.cost > 0 && (
            <div className="flex items-center gap-0.5">
              <DollarSign className="h-3 w-3 text-chart-2" />
              <span>${task.cost.toFixed(4)}</span>
            </div>
          )}
          {elapsed && (
            <div className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              <span>{elapsed}s</span>
            </div>
          )}
        </div>
      )}

      {/* Error for failed */}
      {task.status === "failed" && task.result && (
        <p className="text-[10px] text-red-400 mt-1 truncate">{task.result}</p>
      )}
    </div>
  );
}

export function AgentDashboard({
  sessionId,
  parentTaskId,
}: {
  sessionId: Id<"sessions"> | null;
  parentTaskId: string | null;
}) {
  const tasks = useQuery(
    api.agents.listByParent,
    parentTaskId ? { parentTaskId } : "skip"
  );

  if (!tasks || tasks.length === 0) return null;

  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const running = tasks.filter((t) => t.status === "running").length;
  const total = tasks.length;
  const totalCost = tasks.reduce((sum, t) => sum + (t.cost || 0), 0);
  const totalFiles = tasks.reduce((sum, t) => sum + (t.filesCreated || 0), 0);
  const allDone = completed + failed === total;

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      {/* Dashboard header */}
      <div className="px-4 py-3 border-b border-border bg-card/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-chart-3/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-chart-3" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Multi-Agent Build</h3>
              <p className="text-[10px] text-muted-foreground">
                {total} agent{total !== 1 ? "s" : ""} working in parallel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allDone ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge className="bg-chart-3/20 text-chart-3 border-chart-3/30 text-[10px]">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {running} active
              </Badge>
            )}
          </div>
        </div>

        {/* Overall progress */}
        <div className="mt-2 w-full h-1.5 rounded-full bg-background/50 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              allDone ? "bg-green-500" : "bg-chart-3"
            )}
            style={{ width: `${((completed + failed) / total) * 100}%` }}
          />
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span>
            {completed}/{total} completed
          </span>
          {failed > 0 && <span className="text-red-400">{failed} failed</span>}
          {totalFiles > 0 && (
            <span className="text-chart-3">{totalFiles} files created</span>
          )}
          {totalCost > 0 && (
            <span className="text-chart-2">${totalCost.toFixed(4)} spent</span>
          )}
        </div>
      </div>

      {/* Agent cards grid */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tasks
          .sort((a, b) => a.agentIndex - b.agentIndex)
          .map((task) => (
            <AgentCard key={task._id} task={task} />
          ))}
      </div>
    </div>
  );
}
