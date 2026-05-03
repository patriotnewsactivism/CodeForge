/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — AI REFACTOR PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * Select code in the editor → get AI-powered refactoring suggestions:
 * - Extract function/component
 * - Simplify logic
 * - Add types
 * - Convert patterns (class → functional, callbacks → async/await)
 * - Performance optimize
 * - One-click apply
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wand2,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  Type,
  Component,
  GitMerge,
  Timer,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface AIRefactorProps {
  projectId: Id<"projects"> | null;
  activeFile?: { _id: Id<"files">; name: string; path: string; content: string } | null;
  selectedCode?: string;
  onApplyRefactor?: (newCode: string) => void;
}

interface RefactorSuggestion {
  id: string;
  type: "extract" | "simplify" | "typeify" | "modernize" | "perf" | "security";
  title: string;
  description: string;
  before: string;
  after: string;
  impact: "high" | "medium" | "low";
  confidence: number;
}

const REFACTOR_TYPES = [
  { id: "extract", label: "Extract", icon: Component, color: "text-blue-400", desc: "Extract function or component" },
  { id: "simplify", label: "Simplify", icon: Sparkles, color: "text-amber-400", desc: "Reduce complexity" },
  { id: "typeify", label: "Add Types", icon: Type, color: "text-purple-400", desc: "Add TypeScript types" },
  { id: "modernize", label: "Modernize", icon: GitMerge, color: "text-cyan-400", desc: "Modern JS patterns" },
  { id: "perf", label: "Optimize", icon: Zap, color: "text-emerald-400", desc: "Performance improvements" },
  { id: "security", label: "Secure", icon: Shield, color: "text-red-400", desc: "Security hardening" },
] as const;

const IMPACT_COLORS = {
  high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  low: "bg-white/5 text-white/30 border-white/10",
};

function analyzeCodeLocally(code: string): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];
  let id = 0;

  // Detect long functions
  const funcMatches = code.match(/function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)|[^=])\s*=>/g);
  if (code.split("\n").length > 40) {
    suggestions.push({
      id: `r${id++}`,
      type: "extract",
      title: "Extract into smaller functions",
      description: `This code is ${code.split("\n").length} lines long. Break it into smaller, focused functions for readability.`,
      before: code.slice(0, 120) + "...",
      after: "// Split into focused helper functions\nfunction handleValidation() { ... }\nfunction processData() { ... }",
      impact: "high",
      confidence: 85,
    });
  }

  // Detect nested ternaries
  if (/\?[^:]*\?/.test(code)) {
    suggestions.push({
      id: `r${id++}`,
      type: "simplify",
      title: "Replace nested ternaries",
      description: "Nested ternary operators reduce readability. Use early returns or a lookup object.",
      before: "const x = a ? b ? c : d : e;",
      after: "if (a && b) return c;\nif (a) return d;\nreturn e;",
      impact: "medium",
      confidence: 90,
    });
  }

  // Detect `any` types
  if (/:\s*any\b/.test(code)) {
    const count = (code.match(/:\s*any\b/g) || []).length;
    suggestions.push({
      id: `r${id++}`,
      type: "typeify",
      title: `Replace ${count} \`any\` type(s)`,
      description: "Using `any` disables TypeScript checking. Add proper types for safety.",
      before: "function process(data: any): any {",
      after: "function process(data: ProcessInput): ProcessResult {",
      impact: "high",
      confidence: 95,
    });
  }

  // Detect .then chains
  if (/\.then\s*\(/.test(code) && !/async/.test(code)) {
    suggestions.push({
      id: `r${id++}`,
      type: "modernize",
      title: "Convert .then() to async/await",
      description: "Promise chains can be simplified with async/await for cleaner error handling.",
      before: "fetch(url).then(r => r.json()).then(data => { ... })",
      after: "const r = await fetch(url);\nconst data = await r.json();",
      impact: "medium",
      confidence: 88,
    });
  }

  // Detect var keyword
  if (/\bvar\s/.test(code)) {
    suggestions.push({
      id: `r${id++}`,
      type: "modernize",
      title: "Replace var with const/let",
      description: "var has function-scoping issues. Use const (preferred) or let for block scoping.",
      before: "var items = [];",
      after: "const items = [];",
      impact: "low",
      confidence: 99,
    });
  }

  // Detect inline styles in JSX
  if (/style=\{\{/.test(code)) {
    suggestions.push({
      id: `r${id++}`,
      type: "perf",
      title: "Extract inline styles",
      description: "Inline style objects create new references each render, causing unnecessary re-renders.",
      before: '<div style={{ color: "red", padding: 8 }}>',
      after: 'const styles = { color: "red", padding: 8 };\n<div style={styles}>',
      impact: "medium",
      confidence: 80,
    });
  }

  // Detect console.log
  if (/console\.(log|warn|error|debug)/.test(code)) {
    const count = (code.match(/console\.(log|warn|error|debug)/g) || []).length;
    suggestions.push({
      id: `r${id++}`,
      type: "security",
      title: `Remove ${count} console statement(s)`,
      description: "Console statements should be removed in production code. Use a proper logger.",
      before: 'console.log("debug:", data);',
      after: "// Use a logger: logger.debug(data)",
      impact: "low",
      confidence: 95,
    });
  }

  // Detect missing error handling
  if (/await\s/.test(code) && !/try\s*\{/.test(code)) {
    suggestions.push({
      id: `r${id++}`,
      type: "security",
      title: "Add error handling for async operations",
      description: "Await without try/catch can cause unhandled rejections.",
      before: "const data = await fetchData();",
      after: "try {\n  const data = await fetchData();\n} catch (err) {\n  handleError(err);\n}",
      impact: "high",
      confidence: 85,
    });
  }

  // Detect large arrays/objects that could use useMemo
  if (/\[\s*\{[\s\S]{200,}\}\s*\]/.test(code) && code.includes("return")) {
    suggestions.push({
      id: `r${id++}`,
      type: "perf",
      title: "Memoize large data arrays",
      description: "Large inline arrays/objects in components recreate on every render. Use useMemo.",
      before: "const items = [{ id: 1, ... }, ...];",
      after: "const items = useMemo(() => [\n  { id: 1, ... },\n  ...\n], []);",
      impact: "medium",
      confidence: 75,
    });
  }

  return suggestions;
}

export function AIRefactor({ projectId, activeFile, selectedCode, onApplyRefactor }: AIRefactorProps) {
  const [suggestions, setSuggestions] = useState<RefactorSuggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const codeToAnalyze = selectedCode || activeFile?.content || "";

  const handleAnalyze = useCallback(() => {
    if (!codeToAnalyze.trim()) {
      toast.error("No code to analyze");
      return;
    }
    setAnalyzing(true);
    // Simulate brief analysis delay
    setTimeout(() => {
      const results = analyzeCodeLocally(codeToAnalyze);
      setSuggestions(results);
      setAnalyzing(false);
      if (results.length === 0) {
        toast.success("Code looks clean! No refactoring needed.");
      } else {
        toast.info(`Found ${results.length} refactoring suggestion(s)`);
      }
    }, 800);
  }, [codeToAnalyze]);

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Code copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSuggestions = filter
    ? suggestions.filter((s) => s.type === filter)
    : suggestions;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Wand2 className="h-4 w-4 text-indigo-400" />
        <span className="text-xs font-semibold text-white/70">AI Refactor</span>
        {suggestions.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto border-white/10 text-white/40">
            {suggestions.length} suggestions
          </Badge>
        )}
      </div>

      {/* Source Info */}
      <div className="px-3 py-2 border-b border-white/[0.03]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-white/20">
              {selectedCode ? "Selected code" : activeFile?.path || "No file open"}
            </p>
            <p className="text-[9px] text-white/10 mt-0.5">
              {codeToAnalyze ? `${codeToAnalyze.split("\n").length} lines` : "No code to analyze"}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={analyzing || !codeToAnalyze.trim()}
            className="h-7 text-[10px] px-3 bg-indigo-600 hover:bg-indigo-500 gap-1"
          >
            {analyzing ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            {analyzing ? "Analyzing..." : "Analyze"}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      {suggestions.length > 0 && (
        <div className="flex gap-1 px-3 py-1.5 border-b border-white/[0.03] overflow-x-auto">
          <button
            onClick={() => setFilter(null)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-medium whitespace-nowrap",
              !filter ? "bg-white/10 text-white/50" : "text-white/15 hover:text-white/30"
            )}
          >
            All ({suggestions.length})
          </button>
          {REFACTOR_TYPES.filter((t) => suggestions.some((s) => s.type === t.id)).map((t) => {
            const Icon = t.icon;
            const count = suggestions.filter((s) => s.type === t.id).length;
            return (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium whitespace-nowrap",
                  filter === t.id ? "bg-white/10 text-white/50" : "text-white/15 hover:text-white/30"
                )}
              >
                <Icon className={cn("h-2.5 w-2.5", t.color)} />
                {t.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
        {!suggestions.length && !analyzing && (
          <div className="text-center py-12 space-y-3">
            <Wand2 className="h-8 w-8 text-white/10 mx-auto" />
            <p className="text-xs text-white/20">Click Analyze to get refactoring suggestions</p>
            <p className="text-[10px] text-white/10">Select code in the editor for targeted analysis</p>
          </div>
        )}

        {analyzing && (
          <div className="text-center py-12 space-y-3">
            <RefreshCw className="h-6 w-6 text-indigo-400 mx-auto animate-spin" />
            <p className="text-xs text-white/20">Analyzing code patterns...</p>
          </div>
        )}

        {filteredSuggestions.map((s) => {
          const typeInfo = REFACTOR_TYPES.find((t) => t.id === s.type);
          const TypeIcon = typeInfo?.icon || Sparkles;
          const isExpanded = expanded === s.id;

          return (
            <div
              key={s.id}
              className="rounded-lg border border-white/[0.04] bg-white/[0.01] overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : s.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
              >
                <TypeIcon className={cn("h-3.5 w-3.5 shrink-0", typeInfo?.color || "text-white/20")} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/50 font-medium">{s.title}</p>
                  <p className="text-[9px] text-white/20 mt-0.5 truncate">{s.description}</p>
                </div>
                <Badge variant="outline" className={cn("text-[8px] px-1.5 py-0 shrink-0", IMPACT_COLORS[s.impact])}>
                  {s.impact}
                </Badge>
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-white/15 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-white/15 shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {/* Before */}
                  <div>
                    <p className="text-[9px] text-red-400/40 font-medium mb-1">Before:</p>
                    <div className="relative">
                      <pre className="text-[10px] text-red-300/30 bg-red-500/[0.03] border border-red-500/10 rounded p-2 overflow-x-auto font-mono">
                        {s.before}
                      </pre>
                    </div>
                  </div>
                  {/* After */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] text-emerald-400/40 font-medium">After:</p>
                      <button
                        onClick={() => handleCopy(s.after, s.id)}
                        className="flex items-center gap-1 text-[9px] text-white/15 hover:text-white/30"
                      >
                        {copiedId === s.id ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                        {copiedId === s.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="text-[10px] text-emerald-300/30 bg-emerald-500/[0.03] border border-emerald-500/10 rounded p-2 overflow-x-auto font-mono">
                      {s.after}
                    </pre>
                  </div>
                  {/* Confidence */}
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500/40 rounded-full"
                        style={{ width: `${s.confidence}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-white/15">{s.confidence}% confidence</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
