/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — QUICK ACTIONS BAR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Context-aware quick action buttons that appear above the chat input.
 * Suggests relevant AI actions based on current file/context.
 */
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
  GitBranch,
  RefreshCw,
} from "lucide-react";

interface QuickAction {
  icon: typeof Wand2;
  label: string;
  prompt: string;
  color: string;
}

const ACTIONS: QuickAction[] = [
  {
    icon: Bug,
    label: "Fix Bugs",
    prompt: "Find and fix all bugs in the current file. Explain each fix.",
    color: "text-red-400/60 hover:text-red-400",
  },
  {
    icon: Zap,
    label: "Optimize",
    prompt: "Optimize this code for performance. Reduce unnecessary operations and improve efficiency.",
    color: "text-yellow-400/60 hover:text-yellow-400",
  },
  {
    icon: Wand2,
    label: "Improve",
    prompt: "Improve this code: better naming, cleaner structure, modern patterns. Keep the same functionality.",
    color: "text-emerald-400/60 hover:text-emerald-400",
  },
  {
    icon: TestTube2,
    label: "Tests",
    prompt: "Write comprehensive unit tests for this code with edge cases.",
    color: "text-blue-400/60 hover:text-blue-400",
  },
  {
    icon: FileText,
    label: "Docs",
    prompt: "Add JSDoc documentation to all functions, interfaces, and exported members.",
    color: "text-purple-400/60 hover:text-purple-400",
  },
  {
    icon: Shield,
    label: "Security",
    prompt: "Audit this code for security vulnerabilities and fix them all.",
    color: "text-orange-400/60 hover:text-orange-400",
  },
  {
    icon: Accessibility,
    label: "A11y",
    prompt: "Add full accessibility support: ARIA labels, keyboard nav, screen reader support.",
    color: "text-cyan-400/60 hover:text-cyan-400",
  },
  {
    icon: Smartphone,
    label: "Responsive",
    prompt: "Make this component fully responsive for mobile, tablet, and desktop.",
    color: "text-pink-400/60 hover:text-pink-400",
  },
  {
    icon: Palette,
    label: "Dark Mode",
    prompt: "Add dark mode support with proper contrast and theme variables.",
    color: "text-indigo-400/60 hover:text-indigo-400",
  },
  {
    icon: RefreshCw,
    label: "Refactor",
    prompt: "Refactor this code: extract helpers, remove duplication, improve readability.",
    color: "text-teal-400/60 hover:text-teal-400",
  },
];

interface QuickActionsProps {
  onAction: (prompt: string) => void;
  className?: string;
}

export function QuickActions({ onAction, className }: QuickActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar",
        className
      )}
    >
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => onAction(action.prompt)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap",
              "bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04]",
              "transition-all duration-150",
              action.color
            )}
            title={action.prompt}
          >
            <Icon className="h-3 w-3" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
