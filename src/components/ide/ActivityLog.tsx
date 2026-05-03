/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — ACTIVITY LOG / CHANGELOG
 * ═══════════════════════════════════════════════════════════════════
 *
 * Live activity feed showing all actions taken by the user and AI agents.
 * File creates, edits, agent spawns, deployments, etc.
 */
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  FileCode,
  FilePlus,
  FileX,
  Bot,
  GitBranch,
  Rocket,
  Search,
  Eye,
  Trash2,
  ChevronRight,
  Clock,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ActivityEntry {
  id: string;
  type:
    | "file_create"
    | "file_edit"
    | "file_delete"
    | "agent_spawn"
    | "agent_complete"
    | "mission_start"
    | "mission_complete"
    | "deploy"
    | "git_push"
    | "search"
    | "review";
  message: string;
  detail?: string;
  timestamp: number;
}

const TYPE_CONFIG: Record<
  ActivityEntry["type"],
  { icon: typeof Activity; color: string; bg: string }
> = {
  file_create: { icon: FilePlus, color: "text-emerald-400/60", bg: "bg-emerald-500/10" },
  file_edit: { icon: FileCode, color: "text-blue-400/60", bg: "bg-blue-500/10" },
  file_delete: { icon: FileX, color: "text-red-400/60", bg: "bg-red-500/10" },
  agent_spawn: { icon: Bot, color: "text-purple-400/60", bg: "bg-purple-500/10" },
  agent_complete: { icon: Bot, color: "text-emerald-400/60", bg: "bg-emerald-500/10" },
  mission_start: { icon: Rocket, color: "text-yellow-400/60", bg: "bg-yellow-500/10" },
  mission_complete: { icon: Rocket, color: "text-emerald-400/60", bg: "bg-emerald-500/10" },
  deploy: { icon: Rocket, color: "text-cyan-400/60", bg: "bg-cyan-500/10" },
  git_push: { icon: GitBranch, color: "text-orange-400/60", bg: "bg-orange-500/10" },
  search: { icon: Search, color: "text-white/30", bg: "bg-white/5" },
  review: { icon: Eye, color: "text-pink-400/60", bg: "bg-pink-500/10" },
};

// Global activity log store
const activityEntries: ActivityEntry[] = [];
let activityListeners: (() => void)[] = [];

export function logActivity(
  type: ActivityEntry["type"],
  message: string,
  detail?: string
) {
  activityEntries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    detail,
    timestamp: Date.now(),
  });
  // Keep last 200 entries
  if (activityEntries.length > 200) {
    activityEntries.length = 200;
  }
  activityListeners.forEach((fn) => fn());
}

function useActivityLog() {
  const [, forceUpdate] = useState(0);

  useMemo(() => {
    const listener = () => forceUpdate((n) => n + 1);
    activityListeners.push(listener);
    return () => {
      activityListeners = activityListeners.filter((l) => l !== listener);
    };
  }, []);

  return activityEntries;
}

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

interface ActivityLogProps {
  className?: string;
}

export function ActivityLog({ className }: ActivityLogProps) {
  const entries = useActivityLog();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = entries;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          e.detail?.toLowerCase().includes(q)
      );
    }
    if (filterType) {
      result = result.filter((e) => e.type === filterType);
    }
    return result;
  }, [entries, search, filterType]);

  return (
    <div className={cn("flex flex-col h-full bg-[#0a0a0f]", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <Activity className="h-3.5 w-3.5 text-emerald-400/50" />
        <span className="text-xs font-semibold text-white/40">Activity Log</span>
        <span className="text-[9px] text-white/15">({entries.length})</span>
        <div className="flex-1" />
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-white/15 hover:text-white/30"
            onClick={() => {
              activityEntries.length = 0;
              activityListeners.forEach((fn) => fn());
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/15" />
          <Input
            placeholder="Filter activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-6 text-[10px] bg-transparent border-white/5"
          />
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-white/10 text-xs">
            {entries.length === 0 ? "No activity yet" : "No matching activity"}
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((entry) => {
              const config = TYPE_CONFIG[entry.type];
              const Icon = config.icon;

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 px-3 py-1.5 hover:bg-white/[0.02] transition-colors group"
                >
                  <div
                    className={cn(
                      "h-5 w-5 rounded flex items-center justify-center shrink-0 mt-0.5",
                      config.bg
                    )}
                  >
                    <Icon className={cn("h-3 w-3", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50 leading-snug">
                      {entry.message}
                    </p>
                    {entry.detail && (
                      <p className="text-[9px] text-white/15 mt-0.5 truncate">
                        {entry.detail}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] text-white/10 shrink-0 mt-0.5">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
