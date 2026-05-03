/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — SNIPPET MANAGER
 * ═══════════════════════════════════════════════════════════════════
 *
 * Reusable code snippets with categories and quick insert.
 * Built-in snippets + user-saved custom snippets.
 */
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Scissors,
  Plus,
  Search,
  Trash2,
  Copy,
  Code2,
  ChevronRight,
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

interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  category: string;
  builtin?: boolean;
}

const BUILTIN_SNIPPETS: Snippet[] = [
  {
    id: "react-fc",
    title: "React Functional Component",
    code: `interface Props {
  // props
}

export function ComponentName({ }: Props) {
  return (
    <div>
      
    </div>
  );
}`,
    language: "typescriptreact",
    category: "React",
    builtin: true,
  },
  {
    id: "react-hook",
    title: "Custom React Hook",
    code: `import { useState, useEffect } from "react";

export function useCustomHook() {
  const [state, setState] = useState(null);

  useEffect(() => {
    // effect logic
    return () => {
      // cleanup
    };
  }, []);

  return { state };
}`,
    language: "typescriptreact",
    category: "React",
    builtin: true,
  },
  {
    id: "convex-query",
    title: "Convex Query",
    code: `import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tableName")
      .order("desc")
      .take(args.limit ?? 50);
  },
});`,
    language: "typescript",
    category: "Convex",
    builtin: true,
  },
  {
    id: "convex-mutation",
    title: "Convex Mutation",
    code: `import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("tableName", {
      name: args.name,
      createdAt: Date.now(),
    });
    return id;
  },
});`,
    language: "typescript",
    category: "Convex",
    builtin: true,
  },
  {
    id: "convex-action",
    title: "Convex Action (External API)",
    code: `import { action } from "./_generated/server";
import { v } from "convex/values";

export const fetchExternal = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch(args.url);
    const data = await response.json();
    return data;
  },
});`,
    language: "typescript",
    category: "Convex",
    builtin: true,
  },
  {
    id: "tailwind-card",
    title: "Tailwind Card Component",
    code: `<div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
  <h3 className="text-sm font-semibold text-white/80 mb-2">Card Title</h3>
  <p className="text-xs text-white/40 leading-relaxed">
    Card description goes here.
  </p>
</div>`,
    language: "typescriptreact",
    category: "UI",
    builtin: true,
  },
  {
    id: "fetch-api",
    title: "Fetch with Error Handling",
    code: `async function fetchData(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }
    return await response.json();
  } catch (error) {
    console.error("Fetch failed:", error);
    throw error;
  }
}`,
    language: "typescript",
    category: "Utility",
    builtin: true,
  },
  {
    id: "debounce",
    title: "Debounce Function",
    code: `function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}`,
    language: "typescript",
    category: "Utility",
    builtin: true,
  },
  {
    id: "zustand-store",
    title: "Zustand Store",
    code: `import { create } from "zustand";

interface StoreState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useStore = create<StoreState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: s.count - 1 })),
  reset: () => set({ count: 0 }),
}));`,
    language: "typescript",
    category: "State",
    builtin: true,
  },
  {
    id: "express-route",
    title: "Express Route Handler",
    code: `import { Router, Request, Response } from "express";

const router = Router();

router.get("/api/items", async (req: Request, res: Response) => {
  try {
    const items = []; // fetch from db
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;`,
    language: "typescript",
    category: "Backend",
    builtin: true,
  },
];

const STORAGE_KEY = "codeforge-snippets";

function getCustomSnippets(): Snippet[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCustomSnippets(snippets: Snippet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
}

interface SnippetManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (code: string) => void;
}

export function SnippetManager({
  open,
  onOpenChange,
  onInsert,
}: SnippetManagerProps) {
  const [search, setSearch] = useState("");
  const [customSnippets, setCustomSnippets] = useState(getCustomSnippets);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allSnippets = [...BUILTIN_SNIPPETS, ...customSnippets];

  const categories = useMemo(() => {
    const cats = new Set(allSnippets.map((s) => s.category));
    return Array.from(cats).sort();
  }, [allSnippets]);

  const filtered = search
    ? allSnippets.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.category.toLowerCase().includes(search.toLowerCase()) ||
          s.code.toLowerCase().includes(search.toLowerCase())
      )
    : allSnippets;

  const handleInsert = (snippet: Snippet) => {
    onInsert(snippet.code);
    onOpenChange(false);
    toast.success(`Inserted: ${snippet.title}`);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  const handleAdd = () => {
    if (!newTitle.trim() || !newCode.trim()) return;
    const custom: Snippet = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      code: newCode.trim(),
      language: "typescript",
      category: newCategory.trim() || "Custom",
    };
    const updated = [...customSnippets, custom];
    setCustomSnippets(updated);
    saveCustomSnippets(updated);
    setNewTitle("");
    setNewCode("");
    setNewCategory("Custom");
    setShowAddForm(false);
    toast.success("Snippet saved!");
  };

  const handleDelete = (id: string) => {
    const updated = customSnippets.filter((s) => s.id !== id);
    setCustomSnippets(updated);
    saveCustomSnippets(updated);
    toast.success("Snippet deleted");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-emerald-400" />
            Code Snippets
            <span className="text-[10px] text-white/20 font-normal">
              {allSnippets.length} snippets
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Search + Add */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
            <Input
              placeholder="Search snippets..."
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
            <div className="flex gap-2">
              <Input
                placeholder="Snippet title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-7 text-xs flex-1"
              />
              <Input
                placeholder="Category..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="h-7 text-xs w-28"
              />
            </div>
            <Textarea
              placeholder="Paste your code here..."
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="text-xs min-h-[80px] font-mono"
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
                disabled={!newTitle.trim() || !newCode.trim()}
              >
                Save Snippet
              </Button>
            </div>
          </div>
        )}

        {/* Snippet list */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {categories
            .filter((cat) =>
              filtered.some((s) => s.category === cat)
            )
            .map((category) => (
              <div key={category}>
                <div className="text-[9px] text-white/15 uppercase tracking-wider font-semibold px-2 py-1.5 sticky top-0 bg-[#0d0d14]/90 backdrop-blur-sm z-10">
                  {category}
                </div>
                {filtered
                  .filter((s) => s.category === category)
                  .map((snippet) => (
                    <div
                      key={snippet.id}
                      className="border border-white/5 rounded-lg mb-1 overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedId(
                            expandedId === snippet.id ? null : snippet.id
                          )
                        }
                        className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 text-white/15 transition-transform shrink-0",
                            expandedId === snippet.id && "rotate-90"
                          )}
                        />
                        <Code2 className="h-3 w-3 text-emerald-400/40 shrink-0" />
                        <span className="text-xs text-white/60 truncate">
                          {snippet.title}
                        </span>
                        <div className="ml-auto flex items-center gap-1 shrink-0">
                          {!snippet.builtin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-white/10 hover:text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(snippet.id);
                              }}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-white/10 hover:text-white/40"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(snippet.code);
                            }}
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </button>

                      {expandedId === snippet.id && (
                        <div className="border-t border-white/5 bg-[#06060a]">
                          <pre className="text-[10px] text-white/30 p-3 overflow-x-auto font-mono leading-relaxed max-h-48">
                            {snippet.code}
                          </pre>
                          <div className="flex justify-end px-3 py-1.5 border-t border-white/5">
                            <Button
                              size="sm"
                              className="h-6 text-[10px] px-3 gap-1 bg-emerald-600 hover:bg-emerald-500"
                              onClick={() => handleInsert(snippet)}
                            >
                              Insert at Cursor
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-white/15 text-xs">
              No snippets found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
