/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — COMMAND PALETTE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Ctrl+K / Cmd+K opens a searchable command palette.
 * Actions: file search, panel toggles, AI prompts, navigation.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  FileCode,
  MessageSquare,
  Play,
  Activity,
  GitBranch,
  Lightbulb,
  Download,
  Sparkles,
  Keyboard,
  DollarSign,
  Sun,
  Github,
  Plus,
  Terminal,
  Mic,
  BarChart3,
  Zap,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  category: string;
  icon: typeof Search;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files?: Array<{ _id: string; name: string; path: string }>;
  onFileSelect?: (fileId: string, name: string, path: string) => void;
  onToggleChat?: () => void;
  onTogglePreview?: () => void;
  onToggleAgents?: () => void;
  onToggleGit?: () => void;
  onToggleSuggestions?: () => void;
  onNewProject?: () => void;
  onOpenTemplates?: () => void;
  onExport?: () => void;
  onSendPrompt?: (prompt: string) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  files = [],
  onFileSelect,
  onToggleChat,
  onTogglePreview,
  onToggleAgents,
  onToggleGit,
  onToggleSuggestions,
  onNewProject,
  onOpenTemplates,
  onExport,
  onSendPrompt,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command list
  const commands: Command[] = useMemo(() => {
    const cmds: Command[] = [];

    // Panel toggles
    if (onToggleChat) cmds.push({ id: "toggle-chat", label: "Toggle AI Chat Panel", category: "Panels", icon: MessageSquare, shortcut: "⌘+B", action: onToggleChat });
    if (onTogglePreview) cmds.push({ id: "toggle-preview", label: "Toggle Live Preview", category: "Panels", icon: Play, shortcut: "⌘+P", action: onTogglePreview });
    if (onToggleAgents) cmds.push({ id: "toggle-agents", label: "Toggle Agent Activity", category: "Panels", icon: Activity, action: onToggleAgents });
    if (onToggleGit) cmds.push({ id: "toggle-git", label: "Toggle Git Panel", category: "Panels", icon: GitBranch, action: onToggleGit });
    if (onToggleSuggestions) cmds.push({ id: "toggle-suggestions", label: "Toggle Smart Suggestions", category: "Panels", icon: Lightbulb, action: onToggleSuggestions });

    // Actions
    if (onNewProject) cmds.push({ id: "new-project", label: "Create New Project", category: "Actions", icon: Plus, action: onNewProject });
    if (onOpenTemplates) cmds.push({ id: "templates", label: "Open Template Marketplace", category: "Actions", icon: Sparkles, action: onOpenTemplates });
    if (onExport) cmds.push({ id: "export", label: "Export Project as ZIP", category: "Actions", icon: Download, action: onExport });

    // AI shortcuts
    if (onSendPrompt) {
      cmds.push(
        { id: "ai-review", label: "AI: Review My Code", category: "AI", icon: Zap, action: () => onSendPrompt("Review all files in the project for bugs, security issues, performance problems, and suggest improvements.") },
        { id: "ai-optimize", label: "AI: Optimize Performance", category: "AI", icon: BarChart3, action: () => onSendPrompt("Analyze all project files and optimize for performance. Reduce bundle size, improve load times, and fix any inefficiencies.") },
        { id: "ai-a11y", label: "AI: Check Accessibility", category: "AI", icon: Sun, action: () => onSendPrompt("Audit all HTML/JSX in the project for accessibility (a11y) issues. Add ARIA labels, fix contrast, ensure keyboard navigation works.") },
        { id: "ai-test", label: "AI: Generate Tests", category: "AI", icon: Terminal, action: () => onSendPrompt("Generate comprehensive tests for all functions and components in the project. Include edge cases.") },
        { id: "ai-docs", label: "AI: Generate Documentation", category: "AI", icon: FileCode, action: () => onSendPrompt("Generate clear documentation for every function, component, and module in the project. Include JSDoc comments and a README.md.") },
        { id: "ai-refactor", label: "AI: Refactor Code", category: "AI", icon: Zap, action: () => onSendPrompt("Refactor the entire project for cleaner architecture. Extract reusable functions, reduce duplication, improve naming.") },
      );
    }

    // File search
    for (const file of files) {
      cmds.push({
        id: `file-${file._id}`,
        label: file.path || file.name,
        category: "Files",
        icon: FileCode,
        action: () => onFileSelect?.(file._id, file.name, file.path),
      });
    }

    return cmds;
  }, [files, onFileSelect, onToggleChat, onTogglePreview, onToggleAgents, onToggleGit, onToggleSuggestions, onNewProject, onOpenTemplates, onExport, onSendPrompt]);

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onOpenChange(false);
        }
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [filtered, selectedIndex, onOpenChange]
  );

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  // Group by category
  const grouped = new Map<string, typeof filtered>();
  for (const cmd of filtered) {
    const list = grouped.get(cmd.category) || [];
    list.push(cmd);
    grouped.set(cmd.category, list);
  }

  let globalIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg bg-[#0d0d14] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Search className="h-4 w-4 text-white/30 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, files, AI actions..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
          />
          <kbd className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-white/20 text-sm">
              No matching commands
            </div>
          )}
          {[...grouped.entries()].map(([category, cmds]) => (
            <div key={category}>
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold text-white/20 uppercase tracking-wider">
                  {category}
                </span>
              </div>
              {cmds.map((cmd) => {
                const idx = globalIdx++;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      idx === selectedIndex
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "text-white/60 hover:bg-white/[0.03]"
                    )}
                    onClick={() => {
                      cmd.action();
                      onOpenChange(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-60" />
                    <span className="text-sm flex-1 truncate">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-3 py-2 border-t border-white/5 text-[10px] text-white/15">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>esc Close</span>
        </div>
      </div>
    </div>
  );
}
