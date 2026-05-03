/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — ARCHITECTURE ADVISOR
 * ═══════════════════════════════════════════════════════════════════
 *
 * AI-powered project analysis that gives real-time recommendations:
 * - File structure quality
 * - Dependency analysis
 * - Code complexity hotspots
 * - Security red flags
 * - Performance suggestions
 * - Architecture score with breakdown
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  FileCode,
  FolderTree,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronRight,
  Layers,
  Lock,
  Package,
  RefreshCw,
  TrendingUp,
  Code,
  Bug,
  Gauge,
} from "lucide-react";

interface ArchitectureAdvisorProps {
  projectId: Id<"projects"> | null;
}

interface Insight {
  id: string;
  type: "success" | "warning" | "error" | "info";
  category: "structure" | "security" | "performance" | "quality" | "deps";
  title: string;
  description: string;
  file?: string;
  fix?: string;
}

const CATEGORY_CONFIG = {
  structure: { icon: FolderTree, color: "text-blue-400", label: "Structure" },
  security: { icon: Shield, color: "text-red-400", label: "Security" },
  performance: { icon: Zap, color: "text-amber-400", label: "Performance" },
  quality: { icon: Code, color: "text-purple-400", label: "Quality" },
  deps: { icon: Package, color: "text-cyan-400", label: "Dependencies" },
};

const TYPE_STYLE = {
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  error: { icon: Bug, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
};

function analyzeProject(
  files: Array<{ path: string; name: string; content: string | null; type: string }>
): { insights: Insight[]; score: number; breakdown: Record<string, number> } {
  const insights: Insight[] = [];
  const codeFiles = files.filter((f) => f.type === "file");
  const breakdown = { structure: 100, security: 100, performance: 100, quality: 100, deps: 100 };

  // ─── Structure Analysis ──────────────────────────────────────
  const dirs = new Set(codeFiles.map((f) => f.path.split("/").slice(0, -1).join("/")));
  const rootFiles = codeFiles.filter((f) => !f.path.includes("/"));

  if (rootFiles.length > 8) {
    insights.push({
      id: "too-many-root",
      type: "warning",
      category: "structure",
      title: "Too many root-level files",
      description: `${rootFiles.length} files at project root. Organize into folders for better maintainability.`,
      fix: "Group related files into src/, lib/, utils/, etc.",
    });
    breakdown.structure -= 15;
  } else {
    insights.push({
      id: "root-ok",
      type: "success",
      category: "structure",
      title: "Clean root structure",
      description: `Only ${rootFiles.length} files at root level — well organized.`,
    });
  }

  // Check for consistent naming
  const hasKebab = codeFiles.some((f) => /[a-z]-[a-z]/.test(f.name));
  const hasCamel = codeFiles.some((f) => /[a-z][A-Z]/.test(f.name));
  const hasPascal = codeFiles.some((f) => /^[A-Z][a-z]/.test(f.name));
  const conventions = [hasKebab, hasCamel, hasPascal].filter(Boolean).length;

  if (conventions > 1) {
    insights.push({
      id: "mixed-naming",
      type: "warning",
      category: "quality",
      title: "Mixed naming conventions",
      description: "Files use multiple naming styles (kebab-case, camelCase, PascalCase). Pick one and stick to it.",
      fix: "Standardize: PascalCase for components, kebab-case for utilities.",
    });
    breakdown.quality -= 10;
  }

  // ─── Security Analysis ──────────────────────────────────────
  for (const file of codeFiles) {
    const content = file.content || "";

    // Check for hardcoded secrets
    const secretPatterns = [
      /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}/i,
      /(?:sk|pk)[-_][a-zA-Z0-9]{20,}/,
      /ghp_[a-zA-Z0-9]{36}/,
    ];
    for (const pat of secretPatterns) {
      if (pat.test(content)) {
        insights.push({
          id: `secret-${file.path}`,
          type: "error",
          category: "security",
          title: "Possible hardcoded secret",
          description: `Found what looks like a hardcoded credential in ${file.name}`,
          file: file.path,
          fix: "Move secrets to environment variables (.env file)",
        });
        breakdown.security -= 20;
        break;
      }
    }

    // Check for eval
    if (/\beval\s*\(/.test(content)) {
      insights.push({
        id: `eval-${file.path}`,
        type: "error",
        category: "security",
        title: "eval() usage detected",
        description: `Using eval() in ${file.name} is a security risk — can execute arbitrary code.`,
        file: file.path,
        fix: "Replace eval with safer alternatives (JSON.parse, Function constructor, etc.)",
      });
      breakdown.security -= 15;
    }

    // innerHTML
    if (/innerHTML\s*=/.test(content) || /dangerouslySetInnerHTML/.test(content)) {
      insights.push({
        id: `xss-${file.path}`,
        type: "warning",
        category: "security",
        title: "Potential XSS vulnerability",
        description: `Direct HTML injection in ${file.name}. Sanitize user input.`,
        file: file.path,
        fix: "Use DOMPurify or React's built-in escaping",
      });
      breakdown.security -= 10;
    }
  }

  if (!insights.some((i) => i.category === "security" && i.type !== "success")) {
    insights.push({
      id: "security-ok",
      type: "success",
      category: "security",
      title: "No security issues detected",
      description: "No hardcoded secrets, eval(), or XSS patterns found.",
    });
  }

  // ─── Performance Analysis ───────────────────────────────────
  for (const file of codeFiles) {
    const content = file.content || "";
    const lines = content.split("\n").length;

    if (lines > 500) {
      insights.push({
        id: `large-${file.path}`,
        type: "warning",
        category: "performance",
        title: `Large file: ${file.name}`,
        description: `${lines} lines — consider splitting into smaller modules for better tree-shaking.`,
        file: file.path,
        fix: "Extract components/functions into separate files",
      });
      breakdown.performance -= 5;
    }

    // Check for missing React.memo / useMemo on large components
    if (file.path.endsWith(".tsx") && lines > 200) {
      if (!content.includes("memo(") && !content.includes("React.memo")) {
        insights.push({
          id: `memo-${file.path}`,
          type: "info",
          category: "performance",
          title: `Consider memoizing ${file.name}`,
          description: `Large component (${lines} lines) without React.memo — may cause unnecessary re-renders.`,
          file: file.path,
          fix: "Wrap with React.memo() if it receives stable props",
        });
      }
    }
  }

  // ─── Dependency Analysis ────────────────────────────────────
  const pkgJson = codeFiles.find((f) => f.name === "package.json");
  if (pkgJson?.content) {
    try {
      const pkg = JSON.parse(pkgJson.content);
      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});

      insights.push({
        id: "dep-count",
        type: deps.length > 25 ? "warning" : "info",
        category: "deps",
        title: `${deps.length} production dependencies`,
        description: deps.length > 25
          ? "Large dependency count increases bundle size and attack surface"
          : "Reasonable number of dependencies",
      });

      if (deps.length > 25) breakdown.deps -= 10;

      // Check for duplicate functionality
      const hasMoment = deps.includes("moment");
      const hasDayjs = deps.includes("dayjs");
      const hasDateFns = deps.includes("date-fns");
      const dateLibs = [hasMoment, hasDayjs, hasDateFns].filter(Boolean).length;
      if (dateLibs > 1) {
        insights.push({
          id: "dup-date",
          type: "warning",
          category: "deps",
          title: "Multiple date libraries",
          description: "Using more than one date library wastes bundle size.",
          fix: "Pick one: date-fns for tree-shaking, dayjs for smallest size",
        });
        breakdown.deps -= 10;
      }
    } catch {
      // invalid json
    }
  }

  // ─── Quality Analysis ───────────────────────────────────────
  const tsxFiles = codeFiles.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts"));
  const withTypes = tsxFiles.filter((f) => {
    const c = f.content || "";
    return c.includes(": ") || c.includes("interface ") || c.includes("type ");
  });

  if (tsxFiles.length > 0) {
    const typeRatio = Math.round((withTypes.length / tsxFiles.length) * 100);
    insights.push({
      id: "type-coverage",
      type: typeRatio > 70 ? "success" : typeRatio > 40 ? "info" : "warning",
      category: "quality",
      title: `TypeScript usage: ${typeRatio}%`,
      description: `${withTypes.length} of ${tsxFiles.length} TS files use explicit types.`,
    });
    if (typeRatio < 50) breakdown.quality -= 15;
  }

  // Check for error handling
  const hasErrorBoundary = codeFiles.some(
    (f) => f.content?.includes("ErrorBoundary") || f.content?.includes("componentDidCatch")
  );
  if (!hasErrorBoundary) {
    insights.push({
      id: "no-error-boundary",
      type: "info",
      category: "quality",
      title: "No error boundary found",
      description: "Add React Error Boundaries to prevent full-app crashes from component errors.",
      fix: "Wrap key routes with <ErrorBoundary> components",
    });
    breakdown.quality -= 5;
  }

  // Clamp and calculate overall score
  for (const key of Object.keys(breakdown)) {
    breakdown[key as keyof typeof breakdown] = Math.max(0, Math.min(100, breakdown[key as keyof typeof breakdown]));
  }
  const score = Math.round(
    Object.values(breakdown).reduce((a, b) => a + b, 0) / Object.keys(breakdown).length
  );

  return { insights, score, breakdown };
}

export function ArchitectureAdvisor({ projectId }: ArchitectureAdvisorProps) {
  const files = useQuery(api.files.listByProject, projectId ? { projectId } : "skip");
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const analysis = useMemo(() => {
    if (!files) return null;
    return analyzeProject(files);
  }, [files]);

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-white/30">
        <p className="text-sm">Select a project</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f]">
        <RefreshCw className="h-5 w-5 text-white/20 animate-spin" />
      </div>
    );
  }

  const filtered = filterCat
    ? analysis.insights.filter((i) => i.category === filterCat)
    : analysis.insights;

  const scoreColor =
    analysis.score >= 80 ? "text-emerald-400" :
    analysis.score >= 60 ? "text-blue-400" :
    analysis.score >= 40 ? "text-amber-400" :
    "text-red-400";

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Building2 className="h-4 w-4 text-purple-400" />
        <span className="text-xs font-semibold text-white/70">Architecture Advisor</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto border-white/10 text-white/40">
          {analysis.insights.length} insights
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Score Card */}
        <div className="p-3 border-b border-white/[0.03]">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <Gauge className={cn("h-10 w-10", scoreColor)} />
              <span className={cn("absolute inset-0 flex items-center justify-center text-xs font-bold", scoreColor)}>
                {analysis.score}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white/70">
                {analysis.score >= 80 ? "Excellent Architecture" :
                 analysis.score >= 60 ? "Good Architecture" :
                 analysis.score >= 40 ? "Needs Improvement" :
                 "Critical Issues"}
              </p>
              <p className="text-[10px] text-white/30">
                Based on {(files || []).filter((f) => f.type === "file").length} files analyzed
              </p>
            </div>
          </div>

          {/* Breakdown bars */}
          <div className="space-y-1.5">
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
              const score = analysis.breakdown[key as keyof typeof analysis.breakdown] || 0;
              return (
                <button
                  key={key}
                  onClick={() => setFilterCat(filterCat === key ? null : key)}
                  className={cn(
                    "w-full flex items-center gap-2 group",
                    filterCat === key && "opacity-100"
                  )}
                >
                  <cfg.icon className={cn("h-3 w-3 shrink-0", cfg.color)} />
                  <span className="text-[10px] text-white/40 w-16 text-left">{cfg.label}</span>
                  <div className="flex-1 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        score >= 80 ? "bg-emerald-500/50" :
                        score >= 60 ? "bg-blue-500/50" :
                        score >= 40 ? "bg-amber-500/50" :
                        "bg-red-500/50"
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-white/20 w-6 text-right">{score}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/[0.03]">
          <button
            onClick={() => setFilterCat(null)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
              !filterCat ? "bg-white/10 text-white/70" : "bg-white/[0.03] text-white/25 hover:text-white/40"
            )}
          >
            All ({analysis.insights.length})
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const count = analysis.insights.filter((i) => i.category === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setFilterCat(filterCat === key ? null : key)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                  filterCat === key ? "bg-white/10 text-white/70" : "bg-white/[0.03] text-white/25 hover:text-white/40"
                )}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Insights */}
        <div className="p-2 space-y-1.5">
          {filtered.map((insight) => {
            const style = TYPE_STYLE[insight.type];
            const Icon = style.icon;
            const isExpanded = expandedInsight === insight.id;

            return (
              <div
                key={insight.id}
                className={cn("rounded-lg border overflow-hidden", style.bg)}
              >
                <button
                  onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                  className="w-full flex items-start gap-2 p-2 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", style.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white/60">{insight.title}</p>
                    {!isExpanded && (
                      <p className="text-[10px] text-white/30 mt-0.5 truncate">{insight.description}</p>
                    )}
                  </div>
                  {(insight.fix || insight.file) && (
                    isExpanded
                      ? <ChevronDown className="h-3 w-3 text-white/20 shrink-0 mt-0.5" />
                      : <ChevronRight className="h-3 w-3 text-white/20 shrink-0 mt-0.5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-2 pb-2 pt-0">
                    <p className="text-[10px] text-white/35 leading-relaxed mb-1.5 ml-5.5">
                      {insight.description}
                    </p>
                    {insight.file && (
                      <p className="text-[9px] text-white/20 ml-5.5 mb-1">
                        📁 {insight.file}
                      </p>
                    )}
                    {insight.fix && (
                      <div className="ml-5.5 rounded bg-emerald-500/[0.05] border border-emerald-500/10 p-1.5">
                        <p className="text-[10px] text-emerald-400/60">
                          💡 {insight.fix}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
