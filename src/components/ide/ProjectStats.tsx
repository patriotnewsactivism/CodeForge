/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — PROJECT STATISTICS
 * ═══════════════════════════════════════════════════════════════════
 *
 * Shows project metrics: file count, line count, language breakdown,
 * total size, code complexity estimate.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  FileCode,
  Layers,
  Hash,
  HardDrive,
} from "lucide-react";

interface ProjectStatsProps {
  projectId: Id<"projects"> | null;
}

const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f7df1e",
  html: "#e34c26",
  css: "#1572b6",
  python: "#3572A5",
  json: "#292929",
  markdown: "#083fa1",
  shell: "#89e051",
  yaml: "#cb171e",
  rust: "#dea584",
  go: "#00add8",
  java: "#b07219",
  ruby: "#701516",
  swift: "#f05138",
  plaintext: "#555555",
};

export function ProjectStats({ projectId }: ProjectStatsProps) {
  const files = useQuery(
    api.files.listWithContent,
    projectId ? { projectId } : "skip"
  );

  const stats = useMemo(() => {
    if (!files) return null;

    const codeFiles = files.filter(
      (f: any) => f.type === "file" && f.content
    );
    const totalLines = codeFiles.reduce(
      (sum: number, f: any) => sum + (f.content?.split("\n").length || 0),
      0
    );
    const totalSize = codeFiles.reduce(
      (sum: number, f: any) => sum + (f.content?.length || 0),
      0
    );

    // Language breakdown
    const langMap: Record<string, { files: number; lines: number }> = {};
    codeFiles.forEach((f: any) => {
      const lang = f.language || "plaintext";
      if (!langMap[lang]) langMap[lang] = { files: 0, lines: 0 };
      langMap[lang].files++;
      langMap[lang].lines += f.content?.split("\n").length || 0;
    });

    const languages = Object.entries(langMap)
      .map(([lang, data]) => ({
        lang,
        ...data,
        pct: totalLines > 0 ? (data.lines / totalLines) * 100 : 0,
      }))
      .sort((a, b) => b.lines - a.lines);

    return {
      fileCount: codeFiles.length,
      totalLines,
      totalSize,
      languages,
    };
  }, [files]);

  if (!stats) {
    return (
      <div className="text-center py-8 text-white/15 text-xs">
        <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-20" />
        <p>No project selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <FileCode className="h-4 w-4 mx-auto mb-1 text-emerald-400/50" />
          <div className="text-sm font-bold text-white/60">{stats.fileCount}</div>
          <div className="text-[9px] text-white/20">Files</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <Hash className="h-4 w-4 mx-auto mb-1 text-blue-400/50" />
          <div className="text-sm font-bold text-white/60">
            {stats.totalLines.toLocaleString()}
          </div>
          <div className="text-[9px] text-white/20">Lines</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <HardDrive className="h-4 w-4 mx-auto mb-1 text-purple-400/50" />
          <div className="text-sm font-bold text-white/60">
            {(stats.totalSize / 1024).toFixed(1)}K
          </div>
          <div className="text-[9px] text-white/20">Size</div>
        </div>
      </div>

      {/* Language breakdown bar */}
      <div>
        <h4 className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
          <Layers className="h-3 w-3" /> Languages
        </h4>
        <div className="h-2 rounded-full overflow-hidden flex bg-white/5">
          {stats.languages.map((l) => (
            <div
              key={l.lang}
              className="h-full transition-all"
              style={{
                width: `${l.pct}%`,
                backgroundColor: LANG_COLORS[l.lang] || "#555",
                minWidth: l.pct > 0 ? "2px" : 0,
              }}
              title={`${l.lang}: ${l.pct.toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="mt-2 space-y-1">
          {stats.languages.slice(0, 6).map((l) => (
            <div key={l.lang} className="flex items-center gap-2 text-[10px]">
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: LANG_COLORS[l.lang] || "#555" }}
              />
              <span className="text-white/40 flex-1">{l.lang}</span>
              <span className="text-white/20">{l.files} files</span>
              <span className="text-white/30 w-12 text-right">
                {l.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
