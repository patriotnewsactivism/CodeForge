/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — SMART CONTEXT WINDOW
 * ═══════════════════════════════════════════════════════════════════
 *
 * Shows users exactly what context the AI sees when it works:
 * - Active files included in context
 * - Memories being applied
 * - Token usage estimate
 * - Toggle files in/out of context
 * - Context quality score
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  FileCode,
  Brain,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Info,
  Zap,
  Shield,
  Hash,
  Layers,
} from "lucide-react";

interface ContextWindowProps {
  projectId: Id<"projects"> | null;
  activeFileId?: Id<"files"> | null;
  sessionId?: Id<"sessions"> | null;
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

function formatTokens(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export function ContextWindow({ projectId, activeFileId, sessionId }: ContextWindowProps) {
  const files = useQuery(
    api.files.listByProject,
    projectId ? { projectId } : "skip"
  );
  const activeMemories = useQuery(
    api.intelligence.getActiveMemories,
    projectId ? { projectId } : "skip"
  );
  const sessionMessages = useQuery(
    api.chatMessages.listBySession,
    sessionId ? { sessionId } : "skip"
  );

  const [excludedFiles, setExcludedFiles] = useState<Set<string>>(new Set());
  const [expandedSection, setExpandedSection] = useState<string | null>("files");

  // Compute context stats
  const contextStats = useMemo(() => {
    const includedFiles = (files || []).filter(
      (f) => f.type === "file" && !excludedFiles.has(f._id)
    );
    const fileTokens = includedFiles.reduce(
      (sum, f) => sum + estimateTokens(f.content || ""),
      0
    );
    const memoryTokens = (activeMemories || []).reduce(
      (sum, m) => sum + estimateTokens(m.content),
      0
    );
    const chatTokens = (sessionMessages || [])
      .slice(-10) // Last 10 messages as context
      .reduce((sum, m) => sum + estimateTokens(m.content), 0);

    const totalTokens = fileTokens + memoryTokens + chatTokens;
    const maxTokens = 128000; // Typical model max
    const utilization = Math.round((totalTokens / maxTokens) * 100);

    return {
      includedFiles: includedFiles.length,
      totalFiles: (files || []).filter((f) => f.type === "file").length,
      fileTokens,
      memoryCount: (activeMemories || []).length,
      memoryTokens,
      chatMessages: (sessionMessages || []).length,
      chatTokens,
      totalTokens,
      maxTokens,
      utilization,
    };
  }, [files, activeMemories, sessionMessages, excludedFiles]);

  const toggleFile = (fileId: string) => {
    setExcludedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  // Context quality
  const quality = getContextQuality(contextStats);

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-white/30">
        <p className="text-sm">Select a project</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Eye className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-semibold text-white/70">AI Context</span>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 ml-auto border",
            quality.color
          )}
        >
          {quality.label}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Token Usage Bar */}
        <div className="px-3 py-2 border-b border-white/[0.03]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30">Context Window</span>
            <span className="text-[10px] text-white/40">
              {formatTokens(contextStats.totalTokens)} / {formatTokens(contextStats.maxTokens)} tokens
            </span>
          </div>
          <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-blue-500/60 transition-all"
                style={{ width: `${(contextStats.fileTokens / contextStats.maxTokens) * 100}%` }}
                title={`Files: ${formatTokens(contextStats.fileTokens)} tokens`}
              />
              <div
                className="bg-emerald-500/60 transition-all"
                style={{ width: `${(contextStats.memoryTokens / contextStats.maxTokens) * 100}%` }}
                title={`Memories: ${formatTokens(contextStats.memoryTokens)} tokens`}
              />
              <div
                className="bg-purple-500/60 transition-all"
                style={{ width: `${(contextStats.chatTokens / contextStats.maxTokens) * 100}%` }}
                title={`Chat: ${formatTokens(contextStats.chatTokens)} tokens`}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <ContextLegend color="bg-blue-500/60" label="Files" tokens={contextStats.fileTokens} />
            <ContextLegend color="bg-emerald-500/60" label="Memory" tokens={contextStats.memoryTokens} />
            <ContextLegend color="bg-purple-500/60" label="Chat" tokens={contextStats.chatTokens} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-1 px-3 py-2 border-b border-white/[0.03]">
          <ContextStat icon={FileCode} value={contextStats.includedFiles} label="Files" color="text-blue-400" />
          <ContextStat icon={Brain} value={contextStats.memoryCount} label="Memories" color="text-emerald-400" />
          <ContextStat icon={MessageSquare} value={contextStats.chatMessages} label="Messages" color="text-purple-400" />
        </div>

        {/* Files Section */}
        <SectionHeader
          label="Project Files"
          icon={FileCode}
          count={`${contextStats.includedFiles}/${contextStats.totalFiles}`}
          expanded={expandedSection === "files"}
          onToggle={() => setExpandedSection(expandedSection === "files" ? null : "files")}
        />
        {expandedSection === "files" && (
          <div className="border-b border-white/[0.03]">
            {(files || [])
              .filter((f) => f.type === "file")
              .sort((a, b) => a.path.localeCompare(b.path))
              .map((file) => {
                const isExcluded = excludedFiles.has(file._id);
                const isActive = file._id === activeFileId;
                const tokens = estimateTokens(file.content || "");
                return (
                  <div
                    key={file._id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1 hover:bg-white/[0.015] transition-colors",
                      isActive && "bg-emerald-500/[0.03]"
                    )}
                  >
                    <button
                      onClick={() => toggleFile(file._id)}
                      className="shrink-0"
                    >
                      {isExcluded ? (
                        <ToggleLeft className="h-3.5 w-3.5 text-white/15" />
                      ) : (
                        <ToggleRight className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </button>
                    <span
                      className={cn(
                        "text-[11px] flex-1 truncate",
                        isExcluded ? "text-white/15 line-through" : "text-white/50"
                      )}
                    >
                      {file.path}
                    </span>
                    <span className="text-[9px] text-white/15 shrink-0">
                      {formatTokens(tokens)}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        {/* Memories Section */}
        <SectionHeader
          label="Active Memories"
          icon={Brain}
          count={String(contextStats.memoryCount)}
          expanded={expandedSection === "memories"}
          onToggle={() => setExpandedSection(expandedSection === "memories" ? null : "memories")}
        />
        {expandedSection === "memories" && (
          <div className="border-b border-white/[0.03]">
            {(activeMemories || []).length === 0 && (
              <p className="text-[10px] text-white/15 px-3 py-2">No active memories</p>
            )}
            {(activeMemories || []).map((mem) => (
              <div key={mem._id} className="px-3 py-1.5 hover:bg-white/[0.01]">
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-[8px] px-1 py-0 border-white/10 text-white/25"
                  >
                    {mem.category}
                  </Badge>
                  <span className="text-[10px] text-white/35 truncate flex-1">
                    {mem.title || mem.content.slice(0, 60)}
                  </span>
                  <span className="text-[9px] text-white/15 shrink-0">
                    {formatTokens(estimateTokens(mem.content))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat History Section */}
        <SectionHeader
          label="Chat History"
          icon={MessageSquare}
          count={String(Math.min(contextStats.chatMessages, 10))}
          expanded={expandedSection === "chat"}
          onToggle={() => setExpandedSection(expandedSection === "chat" ? null : "chat")}
        />
        {expandedSection === "chat" && (
          <div className="border-b border-white/[0.03]">
            <p className="text-[10px] text-white/20 px-3 py-2">
              Last {Math.min(contextStats.chatMessages, 10)} messages included as context
              ({formatTokens(contextStats.chatTokens)} tokens)
            </p>
          </div>
        )}

        {/* Tips */}
        <div className="p-3">
          <div className="rounded-lg bg-cyan-500/[0.03] border border-cyan-500/10 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Info className="h-3 w-3 text-cyan-400" />
              <span className="text-[10px] font-semibold text-cyan-400/70">Context Tips</span>
            </div>
            <ul className="space-y-0.5 text-[10px] text-white/30 leading-relaxed">
              <li>• Toggle off large files to save context tokens</li>
              <li>• More memories = smarter suggestions</li>
              <li>• Active file gets priority in AI responses</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────

function ContextLegend({ color, label, tokens }: { color: string; label: string; tokens: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className={cn("h-1.5 w-1.5 rounded-full", color)} />
      <span className="text-[9px] text-white/25">{label} ({formatTokens(tokens)})</span>
    </div>
  );
}

function ContextStat({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof FileCode;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center py-1">
      <Icon className={cn("h-3.5 w-3.5 mb-0.5", color)} />
      <span className="text-sm font-bold text-white/70">{value}</span>
      <span className="text-[9px] text-white/25">{label}</span>
    </div>
  );
}

function SectionHeader({
  label,
  icon: Icon,
  count,
  expanded,
  onToggle,
}: {
  label: string;
  icon: typeof FileCode;
  count: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.015] transition-colors border-b border-white/[0.03]"
    >
      {expanded ? (
        <ChevronDown className="h-3 w-3 text-white/20" />
      ) : (
        <ChevronRight className="h-3 w-3 text-white/20" />
      )}
      <Icon className="h-3.5 w-3.5 text-white/30" />
      <span className="text-[11px] font-medium text-white/50 flex-1 text-left">{label}</span>
      <span className="text-[10px] text-white/20">{count}</span>
    </button>
  );
}

function getContextQuality(stats: {
  includedFiles: number;
  memoryCount: number;
  utilization: number;
}): { label: string; color: string } {
  const score = Math.min(100,
    (stats.includedFiles > 0 ? 30 : 0) +
    (stats.memoryCount > 0 ? 30 : 0) +
    (stats.utilization > 5 && stats.utilization < 80 ? 20 : stats.utilization > 80 ? 10 : 5) +
    (stats.includedFiles > 3 ? 20 : stats.includedFiles > 1 ? 10 : 0)
  );

  if (score >= 80) return { label: "Excellent", color: "border-emerald-500/30 text-emerald-400" };
  if (score >= 60) return { label: "Good", color: "border-blue-500/30 text-blue-400" };
  if (score >= 40) return { label: "Fair", color: "border-amber-500/30 text-amber-400" };
  return { label: "Limited", color: "border-red-500/30 text-red-400" };
}
