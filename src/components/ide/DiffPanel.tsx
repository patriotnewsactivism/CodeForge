/**
 * DIFF PANEL — See what agents changed in each file
 *
 * Shows file modifications with line-level diff highlighting.
 * Green = added, Red = removed. Unified diff format.
 * Connected to activity log so you can trace changes to agents.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Diff,
  FileCode,
  FilePlus,
  FileX,
  FileMinus,
  ChevronDown,
  ChevronRight,
  Bot,
  Clock,
} from "lucide-react";

interface ActivityEntry {
  _id: string;
  type: string;
  title: string;
  detail?: string;
  filePath?: string;
  agentRole: string;
  agentModel: string;
  timestamp: number;
}

// ─── Simple diff engine ───────────────────────────────────────
function computeDiff(oldText: string, newText: string): Array<{
  type: "add" | "remove" | "same";
  line: string;
  lineNum: number;
}> {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: Array<{ type: "add" | "remove" | "same"; line: string; lineNum: number }> = [];

  // Simple LCS-based diff (good enough for display)
  const maxLen = Math.max(oldLines.length, newLines.length);
  let oi = 0, ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi >= oldLines.length) {
      result.push({ type: "add", line: newLines[ni], lineNum: ni + 1 });
      ni++;
    } else if (ni >= newLines.length) {
      result.push({ type: "remove", line: oldLines[oi], lineNum: oi + 1 });
      oi++;
    } else if (oldLines[oi] === newLines[ni]) {
      result.push({ type: "same", line: newLines[ni], lineNum: ni + 1 });
      oi++;
      ni++;
    } else {
      // Look ahead for a match
      let foundOld = -1, foundNew = -1;
      for (let k = 1; k <= 5 && (oi + k < oldLines.length || ni + k < newLines.length); k++) {
        if (foundNew === -1 && ni + k < newLines.length && oldLines[oi] === newLines[ni + k]) {
          foundNew = k;
        }
        if (foundOld === -1 && oi + k < oldLines.length && oldLines[oi + k] === newLines[ni]) {
          foundOld = k;
        }
      }

      if (foundOld !== -1 && (foundNew === -1 || foundOld <= foundNew)) {
        for (let k = 0; k < foundOld; k++) {
          result.push({ type: "remove", line: oldLines[oi + k], lineNum: oi + k + 1 });
        }
        oi += foundOld;
      } else if (foundNew !== -1) {
        for (let k = 0; k < foundNew; k++) {
          result.push({ type: "add", line: newLines[ni + k], lineNum: ni + k + 1 });
        }
        ni += foundNew;
      } else {
        result.push({ type: "remove", line: oldLines[oi], lineNum: oi + 1 });
        result.push({ type: "add", line: newLines[ni], lineNum: ni + 1 });
        oi++;
        ni++;
      }
    }

    if (result.length > maxLen * 3) break; // Safety valve
  }

  return result;
}

// ─── File Change Card ─────────────────────────────────────────
function FileChange({ entry, expanded, onToggle }: {
  entry: ActivityEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isCreate = entry.type === "file_create";
  const isDelete = entry.type === "file_delete";
  const isModify = entry.type === "file_modify";
  const isCode = entry.type === "code";

  const Icon = isCreate ? FilePlus : isDelete ? FileX : isModify ? FileMinus : FileCode;
  const color = isCreate ? "text-green-400" : isDelete ? "text-red-400" : isModify ? "text-amber-400" : "text-blue-400";
  const label = isCreate ? "Created" : isDelete ? "Deleted" : isModify ? "Modified" : "Generated";

  const time = new Date(entry.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // Parse the detail as code if available
  const codeLines = useMemo(() => {
    if (!expanded || !entry.detail) return [];
    const lines = entry.detail.split("\n");
    // For creates, all lines are "added"; for code blocks, show as-is
    return lines.map((line, i) => ({
      type: isCreate ? "add" as const : "same" as const,
      line,
      lineNum: i + 1,
    }));
  }, [expanded, entry.detail, isCreate]);

  return (
    <div className="rounded-lg border border-border/30 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted/20 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium truncate block">{entry.filePath || entry.title}</span>
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <Badge variant="outline" className={cn("text-[8px] h-3.5", color)}>{label}</Badge>
            <span className="flex items-center gap-0.5">
              <Bot className="h-2.5 w-2.5" />
              {entry.agentRole}
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {timeStr}
            </span>
          </div>
        </div>
      </button>

      {expanded && entry.detail && (
        <div className="border-t border-border/30 bg-background/50 overflow-x-auto">
          <pre className="text-[10px] font-mono leading-tight">
            {codeLines.map((l, i) => (
              <div
                key={i}
                className={cn(
                  "px-2 py-px flex",
                  l.type === "add" && "bg-green-500/10 text-green-300",
                  l.type === "remove" && "bg-red-500/10 text-red-300",
                  l.type === "same" && "text-foreground/70"
                )}
              >
                <span className="w-8 shrink-0 text-right mr-2 text-muted-foreground/50 select-none">
                  {l.lineNum}
                </span>
                <span className="w-3 shrink-0 select-none">
                  {l.type === "add" ? "+" : l.type === "remove" ? "-" : " "}
                </span>
                <span className="whitespace-pre">{l.line}</span>
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
interface DiffPanelProps {
  projectId: Id<"projects"> | null;
}

export function DiffPanel({ projectId }: DiffPanelProps) {
  const missions = useQuery(api.missions.listByProject, projectId ? { projectId } : "skip");
  const latestMission = missions?.[0] ?? null;
  const activity = useQuery(api.swarm.getMissionActivity, latestMission ? { missionId: latestMission._id } : "skip");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filter to file-related activity only
  const fileChanges = useMemo(() => {
    if (!activity) return [];
    return (activity as ActivityEntry[]).filter(a =>
      ["file_create", "file_modify", "file_delete", "code"].includes(a.type) && a.detail
    );
  }, [activity]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Stats
  const created = fileChanges.filter(a => a.type === "file_create").length;
  const modified = fileChanges.filter(a => a.type === "file_modify").length;
  const deleted = fileChanges.filter(a => a.type === "file_delete").length;

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        <p className="text-sm">Select a project to view diffs</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
        <Diff className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold">Diffs</span>
        {fileChanges.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto text-[10px]">
            {created > 0 && <span className="text-green-400">+{created}</span>}
            {modified > 0 && <span className="text-amber-400">~{modified}</span>}
            {deleted > 0 && <span className="text-red-400">-{deleted}</span>}
          </div>
        )}
      </div>

      {/* Mission info */}
      {latestMission && (
        <div className="px-3 py-1.5 border-b border-border/50 bg-muted/10">
          <p className="text-[10px] text-muted-foreground truncate">
            <span className="font-medium text-foreground/80">Mission:</span> {latestMission.prompt}
          </p>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {fileChanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Diff className="h-6 w-6 mb-2 opacity-30" />
              <p className="text-xs font-medium">No file changes yet</p>
              <p className="text-[10px] text-center mt-1">File changes from missions appear here</p>
            </div>
          ) : (
            fileChanges.map(entry => (
              <FileChange
                key={entry._id}
                entry={entry}
                expanded={expandedIds.has(entry._id)}
                onToggle={() => toggleExpand(entry._id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
