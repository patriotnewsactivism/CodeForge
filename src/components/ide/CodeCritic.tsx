/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — CODE CRITIC MODE
 * ═══════════════════════════════════════════════════════════════════
 *
 * AI-powered code review that grades your code and suggests improvements:
 * - Line-by-line analysis of the active file
 * - Detects anti-patterns, code smells, complexity issues
 * - Assigns a code quality score (A-F)
 * - Provides specific fix suggestions with before/after
 * - Categories: Readability, Performance, Security, Maintainability
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Code,
  Copy,
  Check,
  Gauge,
  BookOpen,
  Zap,
  Shield,
  Wrench,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CodeCriticProps {
  projectId: Id<"projects"> | null;
  activeFile?: {
    _id: Id<"files">;
    path: string;
    name: string;
    content: string | null;
    language: string | null;
  } | null;
}

type Severity = "error" | "warning" | "info" | "good";
type Category = "readability" | "performance" | "security" | "maintainability";

interface CriticIssue {
  id: string;
  severity: Severity;
  category: Category;
  line: number;
  title: string;
  description: string;
  before?: string;
  after?: string;
}

const SEVERITY_CONFIG = {
  error: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Critical" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Warning" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "Suggestion" },
  good: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Good" },
};

const CATEGORY_CONFIG = {
  readability: { icon: BookOpen, color: "text-blue-400", label: "Readability" },
  performance: { icon: Zap, color: "text-amber-400", label: "Performance" },
  security: { icon: Shield, color: "text-red-400", label: "Security" },
  maintainability: { icon: Wrench, color: "text-purple-400", label: "Maintainability" },
};

function criticizeCode(content: string, path: string): { issues: CriticIssue[]; grade: string; score: number } {
  const issues: CriticIssue[] = [];
  const lines = content.split("\n");
  let score = 100;
  const isTS = path.endsWith(".ts") || path.endsWith(".tsx");
  const isReact = path.endsWith(".tsx") || path.endsWith(".jsx");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // ─── Readability ───────────────────────────────
    if (line.length > 120) {
      issues.push({
        id: `long-${lineNum}`,
        severity: "info",
        category: "readability",
        line: lineNum,
        title: "Long line",
        description: `Line is ${line.length} chars. Keep under 120 for readability.`,
      });
      score -= 1;
    }

    // Nested ternaries
    if (/\?.*\?.*:/.test(line) && /\?/.test(line)) {
      const ternaryCount = (line.match(/\?/g) || []).length;
      if (ternaryCount >= 2) {
        issues.push({
          id: `ternary-${lineNum}`,
          severity: "warning",
          category: "readability",
          line: lineNum,
          title: "Nested ternary",
          description: "Deeply nested ternaries are hard to read. Extract to a function or use if/else.",
          before: "a ? b ? c : d : e",
          after: "// Use if/else or extract to helper function\nconst result = getResult(a, b);",
        });
        score -= 3;
      }
    }

    // Magic numbers
    if (/(?<![a-zA-Z_])\b(?:0\.\d+|\d{2,})\b/.test(line) && !line.includes("const") && !line.includes("=") && !line.includes("//") && !line.includes("px")) {
      // Simplified: just check for standalone numbers in logic
      if (/(?:if|while|for|>|<|===|!==|>=|<=)\s*\d{2,}/.test(line)) {
        issues.push({
          id: `magic-${lineNum}`,
          severity: "info",
          category: "readability",
          line: lineNum,
          title: "Magic number",
          description: "Use a named constant instead of a raw number for clarity.",
          before: "if (items.length > 50) {",
          after: "const MAX_ITEMS = 50;\nif (items.length > MAX_ITEMS) {",
        });
        score -= 1;
      }
    }

    // console.log left in
    if (/console\.(log|debug|info)\(/.test(line) && !line.trim().startsWith("//")) {
      issues.push({
        id: `console-${lineNum}`,
        severity: "warning",
        category: "maintainability",
        line: lineNum,
        title: "Console statement",
        description: "Remove console.log before production. Use a proper logger or remove.",
        before: 'console.log("debug", data);',
        after: "// Use structured logging or remove",
      });
      score -= 2;
    }

    // ─── Performance ──────────────────────────────
    // Creating functions inside render
    if (isReact && /onClick=\{(?:\(\)\s*=>|function)/.test(line)) {
      issues.push({
        id: `inline-handler-${lineNum}`,
        severity: "info",
        category: "performance",
        line: lineNum,
        title: "Inline event handler",
        description: "Creates a new function on every render. Wrap with useCallback for performance.",
        before: "onClick={() => doSomething(id)}",
        after: "const handleClick = useCallback(() => doSomething(id), [id]);\n// then: onClick={handleClick}",
      });
      score -= 1;
    }

    // Array index as React key
    if (isReact && /key=\{(?:i|idx|index)\}/.test(line)) {
      issues.push({
        id: `key-index-${lineNum}`,
        severity: "warning",
        category: "performance",
        line: lineNum,
        title: "Array index as key",
        description: "Using array index as key causes unnecessary re-renders on list changes.",
        before: "key={index}",
        after: "key={item.id}  // Use a stable unique identifier",
      });
      score -= 3;
    }

    // ─── Security ─────────────────────────────────
    if (/innerHTML\s*=/.test(line)) {
      issues.push({
        id: `xss-${lineNum}`,
        severity: "error",
        category: "security",
        line: lineNum,
        title: "XSS risk: innerHTML",
        description: "Direct innerHTML assignment can execute malicious scripts. Sanitize first.",
        before: "el.innerHTML = userInput;",
        after: "import DOMPurify from 'dompurify';\nel.innerHTML = DOMPurify.sanitize(userInput);",
      });
      score -= 10;
    }

    if (/eval\s*\(/.test(line) && !line.trim().startsWith("//")) {
      issues.push({
        id: `eval-${lineNum}`,
        severity: "error",
        category: "security",
        line: lineNum,
        title: "eval() is dangerous",
        description: "eval() executes arbitrary code. Never use it with user input.",
      });
      score -= 10;
    }

    // ─── Maintainability ──────────────────────────
    // TODO comments
    if (/\/\/\s*TODO/i.test(line)) {
      issues.push({
        id: `todo-${lineNum}`,
        severity: "info",
        category: "maintainability",
        line: lineNum,
        title: "TODO found",
        description: line.trim(),
      });
      score -= 1;
    }

    // Any type usage
    if (isTS && /:\s*any\b/.test(line) && !line.trim().startsWith("//")) {
      issues.push({
        id: `any-${lineNum}`,
        severity: "warning",
        category: "maintainability",
        line: lineNum,
        title: "'any' type used",
        description: "Using 'any' defeats TypeScript's type safety. Use a specific type or 'unknown'.",
        before: "function parse(data: any)",
        after: "function parse(data: unknown)",
      });
      score -= 2;
    }
  }

  // File-level checks
  if (lines.length > 400) {
    issues.push({
      id: "file-too-long",
      severity: "warning",
      category: "maintainability",
      line: 1,
      title: `Large file (${lines.length} lines)`,
      description: "Files over 400 lines should be split into smaller modules.",
    });
    score -= 5;
  }

  // Missing error handling in async
  const asyncFuncs = content.match(/async\s+(?:function\s+)?(\w+)/g) || [];
  const tryCatches = (content.match(/try\s*\{/g) || []).length;
  if (asyncFuncs.length > 0 && tryCatches === 0) {
    issues.push({
      id: "no-error-handling",
      severity: "warning",
      category: "maintainability",
      line: 1,
      title: "No error handling in async code",
      description: `${asyncFuncs.length} async function(s) but no try/catch blocks. Handle errors gracefully.`,
    });
    score -= 5;
  }

  // No issues = add a "good" badge
  if (issues.filter((i) => i.severity !== "good" && i.severity !== "info").length === 0) {
    issues.unshift({
      id: "all-good",
      severity: "good",
      category: "readability",
      line: 0,
      title: "Clean code!",
      description: "No major issues found. Great job maintaining quality.",
    });
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  return { issues, grade, score };
}

export function CodeCritic({ projectId, activeFile }: CodeCriticProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<Category | null>(null);

  const analysis = useMemo(() => {
    if (!activeFile?.content) return null;
    return criticizeCode(activeFile.content, activeFile.path);
  }, [activeFile]);

  const handleCopy = useCallback(async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  if (!projectId || !activeFile) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-white/30">
        <p className="text-sm">Open a file for code review</p>
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
    ? analysis.issues.filter((i) => i.category === filterCat)
    : analysis.issues;

  const gradeColor =
    analysis.grade === "A" ? "text-emerald-400" :
    analysis.grade === "B" ? "text-blue-400" :
    analysis.grade === "C" ? "text-amber-400" :
    "text-red-400";

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Eye className="h-4 w-4 text-orange-400" />
        <span className="text-xs font-semibold text-white/70">Code Critic</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto border-white/10 text-white/40">
          {analysis.issues.length} issues
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Grade Card */}
        <div className="p-3 border-b border-white/[0.03] flex items-center gap-4">
          <div className={cn("text-4xl font-black", gradeColor)}>
            {analysis.grade}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-white/50">{activeFile.name}</span>
              <span className="text-[10px] text-white/20">{analysis.score}/100</span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  analysis.score >= 80 ? "bg-emerald-500" :
                  analysis.score >= 60 ? "bg-blue-500" :
                  analysis.score >= 40 ? "bg-amber-500" :
                  "bg-red-500"
                )}
                style={{ width: `${analysis.score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/[0.03]">
          <button
            onClick={() => setFilterCat(null)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
              !filterCat ? "bg-white/10 text-white/60" : "bg-white/[0.03] text-white/25"
            )}
          >
            All
          </button>
          {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG.readability][]).map(
            ([key, cfg]) => {
              const count = analysis.issues.filter((i) => i.category === key).length;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => setFilterCat(filterCat === key ? null : key)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 flex items-center gap-1",
                    filterCat === key ? "bg-white/10 text-white/60" : "bg-white/[0.03] text-white/25"
                  )}
                >
                  <cfg.icon className={cn("h-2.5 w-2.5", cfg.color)} />
                  {cfg.label} ({count})
                </button>
              );
            }
          )}
        </div>

        {/* Issues */}
        <div className="p-2 space-y-1">
          {filtered.map((issue) => {
            const sev = SEVERITY_CONFIG[issue.severity];
            const SevIcon = sev.icon;
            const isExpanded = expanded === issue.id;

            return (
              <div key={issue.id} className={cn("rounded-lg border overflow-hidden", sev.bg)}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : issue.id)}
                  className="w-full flex items-start gap-2 p-2 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <SevIcon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", sev.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-white/60">{issue.title}</span>
                      {issue.line > 0 && (
                        <span className="text-[9px] text-white/15">L{issue.line}</span>
                      )}
                    </div>
                    {!isExpanded && (
                      <p className="text-[10px] text-white/25 mt-0.5 truncate">{issue.description}</p>
                    )}
                  </div>
                  {(issue.before || issue.after) && (
                    isExpanded
                      ? <ChevronDown className="h-3 w-3 text-white/20 shrink-0" />
                      : <ChevronRight className="h-3 w-3 text-white/20 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-2 pb-2 space-y-2 ml-5">
                    <p className="text-[10px] text-white/30">{issue.description}</p>
                    {issue.before && (
                      <div>
                        <p className="text-[9px] text-red-400/50 mb-0.5">Before:</p>
                        <pre className="text-[10px] text-red-300/30 bg-red-500/[0.03] rounded p-1.5 font-mono overflow-x-auto">
                          {issue.before}
                        </pre>
                      </div>
                    )}
                    {issue.after && (
                      <div>
                        <p className="text-[9px] text-emerald-400/50 mb-0.5">After:</p>
                        <div className="relative">
                          <pre className="text-[10px] text-emerald-300/40 bg-emerald-500/[0.03] rounded p-1.5 font-mono overflow-x-auto pr-8">
                            {issue.after}
                          </pre>
                          <button
                            onClick={() => handleCopy(issue.after!, issue.id)}
                            className="absolute top-1 right-1 p-0.5 rounded hover:bg-white/10 text-white/15 hover:text-white/40"
                          >
                            {copied === issue.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
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
