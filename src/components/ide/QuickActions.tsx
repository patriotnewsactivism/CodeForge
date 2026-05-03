/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — QUICK ACTIONS (Mobile-Optimized)
 * ═══════════════════════════════════════════════════════════════════
 *
 * On mobile: collapsible 2-column grid behind a toggle button
 * On desktop: compact horizontal pill bar
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Wand2,
  Bug,
  Zap,
  FileText,
  TestTube2,
  Shield,
  Accessibility,
  Smartphone,
  Palette,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from "lucide-react";

interface QuickAction {
  icon: typeof Wand2;
  label: string;
  prompt: string;
  color: string;
  bg: string;
}

const ACTIONS: QuickAction[] = [
  {
    icon: Bug,
    label: "Fix Bugs",
    prompt: "Find and fix all bugs in the current file. Explain each fix.",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    icon: Zap,
    label: "Optimize",
    prompt:
      "Optimize this code for performance. Reduce unnecessary operations and improve efficiency.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    icon: Wand2,
    label: "Improve",
    prompt:
      "Improve this code: better naming, cleaner structure, modern patterns. Keep the same functionality.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: TestTube2,
    label: "Tests",
    prompt: "Write comprehensive unit tests for this code with edge cases.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: FileText,
    label: "Docs",
    prompt:
      "Add JSDoc documentation to all functions, interfaces, and exported members.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Shield,
    label: "Security",
    prompt:
      "Audit this code for security vulnerabilities and fix them all.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    icon: Accessibility,
    label: "A11y",
    prompt:
      "Add full accessibility support: ARIA labels, keyboard nav, screen reader support.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Smartphone,
    label: "Responsive",
    prompt:
      "Make this component fully responsive for mobile, tablet, and desktop.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    icon: Palette,
    label: "Dark Mode",
    prompt:
      "Add dark mode support with proper contrast and theme variables.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: RefreshCw,
    label: "Refactor",
    prompt:
      "Refactor this code: extract helpers, remove duplication, improve readability.",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
];

interface QuickActionsProps {
  onAction: (prompt: string) => void;
  className?: string;
}

export function QuickActions({ onAction, className }: QuickActionsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("", className)}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium transition-colors",
          expanded
            ? "text-emerald-400 bg-emerald-500/5"
            : "text-white/25 hover:text-white/40"
        )}
      >
        <Sparkles className="h-3 w-3" />
        <span>Quick Actions</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
      </button>

      {/* Expandable grid */}
      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-2 border-t border-white/5 bg-white/[0.01]">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => {
                  onAction(action.prompt);
                  setExpanded(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium",
                  "border border-white/5 hover:border-white/10",
                  "hover:bg-white/[0.04] transition-all duration-150",
                  action.bg
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", action.color)} />
                <span className="text-white/60 truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
