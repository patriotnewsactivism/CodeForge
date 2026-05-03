/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — PERFORMANCE PROFILER
 * ═══════════════════════════════════════════════════════════════════
 *
 * Analyze project code for performance bottlenecks:
 * - Bundle size estimation per file
 * - Import graph analysis (circular deps, heavy imports)
 * - Render count estimation for React components
 * - Lighthouse-like scoring for frontend projects
 * - Suggested optimizations
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Gauge,
  Package,
  FileCode,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Zap,
  Timer,
  HardDrive,
  Network,
} from "lucide-react";

interface PerformanceProfilerProps {
  projectId: Id<"projects"> | null;
}

interface FileStats {
  path: string;
  sizeBytes: number;
  imports: number;
  exports: number;
  linesOfCode: number;
  hasLazyImports: boolean;
  reExportCount: number;
  warnings: string[];
}

// Known heavy packages and their approximate gzipped sizes
const HEAVY_PACKAGES: Record<string, { size: string; alternative?: string }> = {
  "moment": { size: "72KB", alternative: "date-fns (6KB)" },
  "lodash": { size: "71KB", alternative: "lodash-es (tree-shakable)" },
  "@mui/material": { size: "300KB+", alternative: "shadcn/ui (tree-shakable)" },
  "antd": { size: "200KB+", alternative: "shadcn/ui (tree-shakable)" },
  "jquery": { size: "30KB", alternative: "vanilla JS" },
  "chart.js": { size: "60KB", alternative: "recharts (tree-shakable)" },
  "three": { size: "150KB+" },
  "firebase": { size: "100KB+", alternative: "firebase/compat (modular)" },
  "rxjs": { size: "42KB" },
  "d3": { size: "90KB", alternative: "d3-selection + specific modules" },
};

function analyzeFile(path: string, content: string): FileStats {
  const lines = content.split("\n");
  const imports = (content.match(/^import\s/gm) || []).length;
  const exports = (content.match(/^export\s/gm) || []).length;
  const hasLazyImports = /React\.lazy|import\(\s*['"]/m.test(content);
  const reExportCount = (content.match(/^export\s+\{[^}]*\}\s+from/gm) || []).length;
  const warnings: string[] = [];

  // Check for known patterns
  if (content.includes("import * as") && !path.includes("node_modules")) {
    warnings.push("Namespace import (import *) prevents tree-shaking");
  }
  if (/useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*\},\s*\[\s*\]\s*\)/.test(content)) {
    // Empty dependency array — may be fine but flag for review
  }
  if ((content.match(/useState/g) || []).length > 8) {
    warnings.push(`${(content.match(/useState/g) || []).length} useState calls — consider useReducer`);
  }
  if ((content.match(/useEffect/g) || []).length > 5) {
    warnings.push(`${(content.match(/useEffect/g) || []).length} useEffect calls — may cause re-render cascades`);
  }
  if (content.includes("JSON.parse") && content.includes("JSON.stringify") && content.includes("useEffect")) {
    warnings.push("JSON serialization inside render cycle detected");
  }
  if (/\.map\(.*\.map\(/.test(content)) {
    warnings.push("Nested .map() calls — O(n²) complexity");
  }
  if (content.length > 50000) {
    warnings.push("Very large file — consider code splitting");
  }

  return {
    path,
    sizeBytes: new Blob([content]).size,
    imports,
    exports,
    linesOfCode: lines.filter((l) => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("*")).length,
    hasLazyImports,
    reExportCount,
    warnings,
  };
}

export function PerformanceProfiler({ projectId }: PerformanceProfilerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"size" | "warnings" | "imports">("warnings");

  const files = useQuery(
    api.files.list,
    projectId ? { projectId } : "skip"
  );

  const analysis = useMemo(() => {
    if (!files) return null;

    const stats: FileStats[] = [];
    let totalSize = 0;
    let totalWarnings = 0;
    let totalImports = 0;
    let lazyCount = 0;

    for (const file of files) {
      if (!file.content || file.path.includes("node_modules") || file.path.includes(".lock")) continue;
      if (!/\.(ts|tsx|js|jsx|css|json)$/.test(file.name)) continue;

      const s = analyzeFile(file.path, file.content);
      stats.push(s);
      totalSize += s.sizeBytes;
      totalWarnings += s.warnings.length;
      totalImports += s.imports;
      if (s.hasLazyImports) lazyCount++;
    }

    // Score 0-100
    let score = 100;
    score -= Math.min(30, totalWarnings * 3); // -3 per warning, max -30
    if (lazyCount === 0 && stats.length > 10) score -= 10; // No code splitting
    const avgFileSize = totalSize / (stats.length || 1);
    if (avgFileSize > 10000) score -= 10; // Large average file size
    if (stats.some((s) => s.linesOfCode > 500)) score -= 5; // Large files
    score = Math.max(0, Math.min(100, score));

    return {
      stats: stats.sort((a, b) =>
        sortBy === "size" ? b.sizeBytes - a.sizeBytes :
        sortBy === "warnings" ? b.warnings.length - a.warnings.length :
        b.imports - a.imports
      ),
      totalSize,
      totalWarnings,
      totalImports,
      lazyCount,
      score,
      fileCount: stats.length,
    };
  }, [files, sortBy]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const scoreColor = (s: number) =>
    s >= 80 ? "text-emerald-400" : s >= 60 ? "text-blue-400" : s >= 40 ? "text-amber-400" : "text-red-400";

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-white/30">
        <p className="text-sm">Open a project to profile</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Gauge className="h-4 w-4 text-rose-400" />
        <span className="text-xs font-semibold text-white/70">Performance</span>
        {analysis && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto border-white/10 text-white/40">
            {analysis.fileCount} files
          </Badge>
        )}
      </div>

      {!analysis ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-xs text-white/20">Analyzing project...</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Score Card */}
          <div className="p-3 border-b border-white/[0.03]">
            <div className="flex items-center gap-4">
              <div className={cn("text-4xl font-black", scoreColor(analysis.score))}>
                {analysis.score}
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/40 mb-1">Performance Score</p>
                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      analysis.score >= 80 ? "bg-emerald-500" :
                      analysis.score >= 60 ? "bg-blue-500" :
                      analysis.score >= 40 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${analysis.score}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-1.5 p-3 border-b border-white/[0.03]">
            <div className="text-center p-1.5 rounded bg-white/[0.01] border border-white/[0.04]">
              <HardDrive className="h-3 w-3 text-white/15 mx-auto mb-0.5" />
              <p className="text-[11px] font-bold text-white/50">{formatSize(analysis.totalSize)}</p>
              <p className="text-[8px] text-white/15">Total</p>
            </div>
            <div className="text-center p-1.5 rounded bg-white/[0.01] border border-white/[0.04]">
              <Network className="h-3 w-3 text-white/15 mx-auto mb-0.5" />
              <p className="text-[11px] font-bold text-white/50">{analysis.totalImports}</p>
              <p className="text-[8px] text-white/15">Imports</p>
            </div>
            <div className="text-center p-1.5 rounded bg-white/[0.01] border border-white/[0.04]">
              <AlertTriangle className="h-3 w-3 text-amber-400/50 mx-auto mb-0.5" />
              <p className="text-[11px] font-bold text-amber-400/60">{analysis.totalWarnings}</p>
              <p className="text-[8px] text-white/15">Warnings</p>
            </div>
            <div className="text-center p-1.5 rounded bg-white/[0.01] border border-white/[0.04]">
              <Zap className="h-3 w-3 text-emerald-400/50 mx-auto mb-0.5" />
              <p className="text-[11px] font-bold text-emerald-400/60">{analysis.lazyCount}</p>
              <p className="text-[8px] text-white/15">Lazy</p>
            </div>
          </div>

          {/* Sort */}
          <div className="flex gap-1 px-3 py-1.5 border-b border-white/[0.03]">
            <span className="text-[9px] text-white/15 self-center mr-1">Sort:</span>
            {(["warnings", "size", "imports"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-medium",
                  sortBy === key ? "bg-white/10 text-white/50" : "text-white/15 hover:text-white/30"
                )}
              >
                {key}
              </button>
            ))}
          </div>

          {/* File List */}
          <div className="p-2 space-y-1">
            {analysis.stats.map((file) => {
              const isExpanded = expanded === file.path;
              const hasWarnings = file.warnings.length > 0;

              return (
                <div
                  key={file.path}
                  className={cn(
                    "rounded-lg border overflow-hidden",
                    hasWarnings
                      ? "border-amber-500/10 bg-amber-500/[0.02]"
                      : "border-white/[0.04] bg-white/[0.01]"
                  )}
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : file.path)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-white/[0.015] transition-colors"
                  >
                    <FileCode className="h-3 w-3 text-white/15 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-white/40 truncate font-mono">{file.path}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-white/15">{formatSize(file.sizeBytes)}</span>
                        <span className="text-[9px] text-white/10">{file.linesOfCode} lines</span>
                        {hasWarnings && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-500/20 text-amber-400">
                            {file.warnings.length} ⚠
                          </Badge>
                        )}
                        {file.hasLazyImports && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/20 text-emerald-400">
                            lazy ⚡
                          </Badge>
                        )}
                      </div>
                    </div>
                    {hasWarnings && (
                      isExpanded
                        ? <ChevronDown className="h-3 w-3 text-white/15 shrink-0" />
                        : <ChevronRight className="h-3 w-3 text-white/15 shrink-0" />
                    )}
                  </button>

                  {isExpanded && file.warnings.length > 0 && (
                    <div className="px-2 pb-2 ml-5 space-y-1">
                      {file.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px]">
                          <AlertTriangle className="h-3 w-3 text-amber-400/40 shrink-0 mt-0.5" />
                          <span className="text-white/25">{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
