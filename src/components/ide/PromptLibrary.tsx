/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — PROMPT LIBRARY
 * ═══════════════════════════════════════════════════════════════════
 *
 * Curated AI prompt templates for common coding tasks.
 * Users can also save custom prompts.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Plus,
  Search,
  Zap,
  ShieldCheck,
  Accessibility,
  TestTube2,
  FileText,
  Wrench,
  Star,
  Trash2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  category: string;
  icon: string;
  builtin?: boolean;
}

const BUILTIN_PROMPTS: PromptTemplate[] = [
  {
    id: "review",
    title: "Code Review",
    prompt:
      "Review this code for bugs, security issues, and best practices. Suggest improvements.",
    category: "Review",
    icon: "🔍",
    builtin: true,
  },
  {
    id: "optimize",
    title: "Optimize Performance",
    prompt:
      "Optimize this code for better performance. Focus on reducing unnecessary re-renders, memory usage, and improving time complexity.",
    category: "Performance",
    icon: "⚡",
    builtin: true,
  },
  {
    id: "a11y",
    title: "Accessibility Audit",
    prompt:
      "Audit this code for accessibility issues. Check ARIA labels, keyboard navigation, color contrast, and screen reader support. Fix all issues.",
    category: "Accessibility",
    icon: "♿",
    builtin: true,
  },
  {
    id: "tests",
    title: "Generate Tests",
    prompt:
      "Write comprehensive unit tests for this code. Cover happy paths, edge cases, and error scenarios. Use modern testing patterns.",
    category: "Testing",
    icon: "🧪",
    builtin: true,
  },
  {
    id: "docs",
    title: "Generate Documentation",
    prompt:
      "Write clear documentation for this code. Include JSDoc comments, usage examples, parameter descriptions, and return values.",
    category: "Documentation",
    icon: "📝",
    builtin: true,
  },
  {
    id: "refactor",
    title: "Refactor & Clean",
    prompt:
      "Refactor this code for better readability and maintainability. Extract reusable functions, improve naming, remove duplication.",
    category: "Refactor",
    icon: "🔧",
    builtin: true,
  },
  {
    id: "security",
    title: "Security Hardening",
    prompt:
      "Analyze this code for security vulnerabilities. Check for XSS, CSRF, injection attacks, insecure dependencies, and data leaks. Fix all issues.",
    category: "Security",
    icon: "🛡️",
    builtin: true,
  },
  {
    id: "responsive",
    title: "Make Responsive",
    prompt:
      "Make this component fully responsive for mobile, tablet, and desktop. Use Tailwind breakpoints, flexible layouts, and proper touch targets.",
    category: "UI",
    icon: "📱",
    builtin: true,
  },
  {
    id: "dark-mode",
    title: "Add Dark Mode",
    prompt:
      "Add dark mode support to this component. Use CSS variables or Tailwind dark: classes. Ensure proper contrast and readability.",
    category: "UI",
    icon: "🌙",
    builtin: true,
  },
  {
    id: "error-handling",
    title: "Improve Error Handling",
    prompt:
      "Add comprehensive error handling to this code. Include try/catch blocks, user-friendly error messages, fallback states, and error boundaries.",
    category: "Robustness",
    icon: "🚨",
    builtin: true,
  },
  {
    id: "typescript",
    title: "Add TypeScript Types",
    prompt:
      "Add strict TypeScript types to this code. Define interfaces, use generics where appropriate, and eliminate any `any` types.",
    category: "TypeScript",
    icon: "📘",
    builtin: true,
  },
  {
    id: "api-endpoint",
    title: "Build API Endpoint",
    prompt:
      "Create a REST API endpoint for this data model. Include validation, error handling, pagination, and proper HTTP status codes.",
    category: "Backend",
    icon: "🔌",
    builtin: true,
  },
];

const STORAGE_KEY = "codeforge-custom-prompts";

function getCustomPrompts(): PromptTemplate[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCustomPrompts(prompts: PromptTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

interface PromptLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt: (prompt: string) => void;
}

export function PromptLibrary({
  open,
  onOpenChange,
  onSelectPrompt,
}: PromptLibraryProps) {
  const [search, setSearch] = useState("");
  const [customPrompts, setCustomPrompts] = useState(getCustomPrompts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  const allPrompts = [...BUILTIN_PROMPTS, ...customPrompts];
  const filtered = search
    ? allPrompts.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.category.toLowerCase().includes(search.toLowerCase()) ||
          p.prompt.toLowerCase().includes(search.toLowerCase())
      )
    : allPrompts;

  const handleUse = (prompt: PromptTemplate) => {
    onSelectPrompt(prompt.prompt);
    onOpenChange(false);
    toast.success(`Loaded: ${prompt.title}`);
  };

  const handleAdd = () => {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    const custom: PromptTemplate = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      prompt: newPrompt.trim(),
      category: "Custom",
      icon: "⭐",
    };
    const updated = [...customPrompts, custom];
    setCustomPrompts(updated);
    saveCustomPrompts(updated);
    setNewTitle("");
    setNewPrompt("");
    setShowAddForm(false);
    toast.success("Prompt saved!");
  };

  const handleDelete = (id: string) => {
    const updated = customPrompts.filter((p) => p.id !== id);
    setCustomPrompts(updated);
    saveCustomPrompts(updated);
    toast.success("Prompt deleted");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-400" />
            Prompt Library
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
            <Input
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 gap-1 text-xs"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="h-3 w-3" />
            New
          </Button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="border border-white/10 rounded-lg p-3 space-y-2 bg-white/[0.02]">
            <Input
              placeholder="Prompt title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-7 text-xs"
            />
            <Textarea
              placeholder="Your prompt template..."
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              className="text-xs min-h-[60px]"
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px]"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 text-[10px] px-3"
                onClick={handleAdd}
                disabled={!newTitle.trim() || !newPrompt.trim()}
              >
                Save Prompt
              </Button>
            </div>
          </div>
        )}

        {/* Prompt list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filtered.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => handleUse(prompt)}
              className="w-full text-left p-2.5 rounded-lg border border-white/5 hover:border-white/10 hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0">{prompt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white/60 group-hover:text-white/80">
                      {prompt.title}
                    </span>
                    <span className="text-[9px] text-white/15 bg-white/5 px-1.5 py-0.5 rounded">
                      {prompt.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/25 mt-0.5 line-clamp-2">
                    {prompt.prompt}
                  </p>
                </div>
                {!prompt.builtin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(prompt.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-white/15 text-xs">
              No prompts found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
