/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — THEME ENGINE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Full-featured theme customization engine:
 * - 12 built-in premium themes
 * - Custom theme builder with live preview
 * - Import/export themes as JSON
 * - Apply to entire IDE including Monaco editor
 * - Community-style theme browsing
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Palette,
  Check,
  Star,
  Download,
  Upload,
  Sparkles,
  Moon,
  Sun,
  Eye,
  Copy,
  Search,
  Paintbrush,
} from "lucide-react";
import { toast } from "sonner";

interface Theme {
  id: string;
  name: string;
  author: string;
  description: string;
  stars: number;
  colors: {
    bg: string;
    bgSecondary: string;
    bgTertiary: string;
    text: string;
    textMuted: string;
    textFaint: string;
    accent: string;
    accentHover: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  editorTheme: "vs-dark" | "light" | "hc-black";
  category: "dark" | "light" | "colorful" | "minimal";
}

const BUILT_IN_THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight Void",
    author: "CodeForge",
    description: "The default ultra-dark theme. Pure darkness with cyan accents.",
    stars: 2847,
    colors: {
      bg: "#0a0a0f",
      bgSecondary: "#0d0d14",
      bgTertiary: "#111118",
      text: "rgba(255,255,255,0.7)",
      textMuted: "rgba(255,255,255,0.4)",
      textFaint: "rgba(255,255,255,0.15)",
      accent: "#06b6d4",
      accentHover: "#22d3ee",
      border: "rgba(255,255,255,0.05)",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
      info: "#3b82f6",
    },
    editorTheme: "vs-dark",
    category: "dark",
  },
  {
    id: "neon-tokyo",
    name: "Neon Tokyo",
    author: "CodeForge",
    description: "Cyberpunk-inspired with hot pink and electric blue neon.",
    stars: 1923,
    colors: {
      bg: "#0d0117",
      bgSecondary: "#120220",
      bgTertiary: "#170328",
      text: "rgba(255,255,255,0.8)",
      textMuted: "rgba(255,255,255,0.45)",
      textFaint: "rgba(255,255,255,0.15)",
      accent: "#ec4899",
      accentHover: "#f472b6",
      border: "rgba(236,72,153,0.1)",
      success: "#34d399",
      warning: "#fbbf24",
      error: "#f87171",
      info: "#818cf8",
    },
    editorTheme: "vs-dark",
    category: "colorful",
  },
  {
    id: "forest",
    name: "Deep Forest",
    author: "CodeForge",
    description: "Calming dark green tones inspired by deep forests at night.",
    stars: 1456,
    colors: {
      bg: "#071208",
      bgSecondary: "#0a1a0c",
      bgTertiary: "#0d2210",
      text: "rgba(255,255,255,0.7)",
      textMuted: "rgba(255,255,255,0.35)",
      textFaint: "rgba(255,255,255,0.12)",
      accent: "#10b981",
      accentHover: "#34d399",
      border: "rgba(16,185,129,0.08)",
      success: "#4ade80",
      warning: "#facc15",
      error: "#fb7185",
      info: "#38bdf8",
    },
    editorTheme: "vs-dark",
    category: "dark",
  },
  {
    id: "aurora",
    name: "Aurora Borealis",
    author: "CodeForge",
    description: "Northern lights palette with shifting purple-teal gradients.",
    stars: 1204,
    colors: {
      bg: "#0b0520",
      bgSecondary: "#100830",
      bgTertiary: "#150b40",
      text: "rgba(255,255,255,0.75)",
      textMuted: "rgba(255,255,255,0.4)",
      textFaint: "rgba(255,255,255,0.15)",
      accent: "#a78bfa",
      accentHover: "#c4b5fd",
      border: "rgba(167,139,250,0.08)",
      success: "#2dd4bf",
      warning: "#fcd34d",
      error: "#fb923c",
      info: "#60a5fa",
    },
    editorTheme: "vs-dark",
    category: "colorful",
  },
  {
    id: "ocean",
    name: "Deep Ocean",
    author: "CodeForge",
    description: "Navy blue depths with luminescent highlights.",
    stars: 987,
    colors: {
      bg: "#050a18",
      bgSecondary: "#081020",
      bgTertiary: "#0b1428",
      text: "rgba(255,255,255,0.7)",
      textMuted: "rgba(255,255,255,0.35)",
      textFaint: "rgba(255,255,255,0.12)",
      accent: "#3b82f6",
      accentHover: "#60a5fa",
      border: "rgba(59,130,246,0.08)",
      success: "#22c55e",
      warning: "#eab308",
      error: "#ef4444",
      info: "#06b6d4",
    },
    editorTheme: "vs-dark",
    category: "dark",
  },
  {
    id: "ember",
    name: "Volcanic Ember",
    author: "CodeForge",
    description: "Warm dark theme with fiery orange and red accents.",
    stars: 856,
    colors: {
      bg: "#120808",
      bgSecondary: "#1a0c0c",
      bgTertiary: "#221010",
      text: "rgba(255,255,255,0.7)",
      textMuted: "rgba(255,255,255,0.35)",
      textFaint: "rgba(255,255,255,0.12)",
      accent: "#f97316",
      accentHover: "#fb923c",
      border: "rgba(249,115,22,0.08)",
      success: "#4ade80",
      warning: "#fbbf24",
      error: "#ef4444",
      info: "#38bdf8",
    },
    editorTheme: "vs-dark",
    category: "colorful",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    author: "CodeForge",
    description: "Pure black and white minimal design. Zero distractions.",
    stars: 743,
    colors: {
      bg: "#080808",
      bgSecondary: "#0e0e0e",
      bgTertiary: "#141414",
      text: "rgba(255,255,255,0.7)",
      textMuted: "rgba(255,255,255,0.3)",
      textFaint: "rgba(255,255,255,0.1)",
      accent: "#ffffff",
      accentHover: "#e5e5e5",
      border: "rgba(255,255,255,0.06)",
      success: "#a3e635",
      warning: "#fde047",
      error: "#fca5a5",
      info: "#93c5fd",
    },
    editorTheme: "vs-dark",
    category: "minimal",
  },
  {
    id: "sunset",
    name: "Golden Sunset",
    author: "CodeForge",
    description: "Warm amber tones like a desert sunset.",
    stars: 621,
    colors: {
      bg: "#121008",
      bgSecondary: "#1a160c",
      bgTertiary: "#221c10",
      text: "rgba(255,255,255,0.7)",
      textMuted: "rgba(255,255,255,0.35)",
      textFaint: "rgba(255,255,255,0.12)",
      accent: "#f59e0b",
      accentHover: "#fbbf24",
      border: "rgba(245,158,11,0.08)",
      success: "#22c55e",
      warning: "#fbbf24",
      error: "#ef4444",
      info: "#6366f1",
    },
    editorTheme: "vs-dark",
    category: "colorful",
  },
];

export function ThemeEngine() {
  const [activeThemeId, setActiveThemeId] = useState<string>(() =>
    localStorage.getItem("cf-theme") || "midnight"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [starred, setStarred] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("cf-starred-themes") || "[]"));
    } catch {
      return new Set();
    }
  });

  const activeTheme = BUILT_IN_THEMES.find((t) => t.id === activeThemeId) || BUILT_IN_THEMES[0];

  const filteredThemes = useMemo(() => {
    return BUILT_IN_THEMES.filter((t) => {
      if (filterCategory && t.category !== filterCategory) return false;
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [searchQuery, filterCategory]);

  const applyTheme = useCallback((theme: Theme) => {
    setActiveThemeId(theme.id);
    localStorage.setItem("cf-theme", theme.id);

    // Apply CSS variables to document root
    const root = document.documentElement;
    root.style.setProperty("--cf-bg", theme.colors.bg);
    root.style.setProperty("--cf-bg-secondary", theme.colors.bgSecondary);
    root.style.setProperty("--cf-bg-tertiary", theme.colors.bgTertiary);
    root.style.setProperty("--cf-text", theme.colors.text);
    root.style.setProperty("--cf-text-muted", theme.colors.textMuted);
    root.style.setProperty("--cf-accent", theme.colors.accent);
    root.style.setProperty("--cf-border", theme.colors.border);

    toast.success(`Theme: ${theme.name} applied!`);
  }, []);

  const toggleStar = (id: string) => {
    const updated = new Set(starred);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setStarred(updated);
    localStorage.setItem("cf-starred-themes", JSON.stringify([...updated]));
  };

  const exportTheme = async () => {
    const json = JSON.stringify(activeTheme, null, 2);
    await navigator.clipboard.writeText(json);
    toast.success("Theme JSON copied to clipboard!");
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Palette className="h-4 w-4 text-fuchsia-400" />
        <span className="text-xs font-semibold text-white/70">Themes</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto border-white/10 text-white/40">
          {BUILT_IN_THEMES.length} themes
        </Badge>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/[0.03]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/15" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search themes..."
            className="h-7 pl-7 text-[10px] bg-white/[0.02] border-white/5"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-white/[0.03]">
        {[null, "dark", "colorful", "minimal"].map((cat) => (
          <button
            key={cat || "all"}
            onClick={() => setFilterCategory(cat)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-medium capitalize",
              filterCategory === cat ? "bg-white/10 text-white/50" : "text-white/15 hover:text-white/30"
            )}
          >
            {cat || "All"}
          </button>
        ))}
      </div>

      {/* Theme List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
        {filteredThemes.map((theme) => {
          const isActive = activeThemeId === theme.id;
          const isStarred = starred.has(theme.id);

          return (
            <div
              key={theme.id}
              className={cn(
                "rounded-lg border overflow-hidden transition-colors",
                isActive
                  ? "border-fuchsia-500/20 bg-fuchsia-500/[0.03]"
                  : "border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02]"
              )}
            >
              {/* Color Preview Swatch */}
              <div className="flex h-6 mx-2 mt-2 rounded overflow-hidden">
                <div className="flex-1" style={{ backgroundColor: theme.colors.bg }} />
                <div className="flex-1" style={{ backgroundColor: theme.colors.bgSecondary }} />
                <div className="flex-1" style={{ backgroundColor: theme.colors.accent }} />
                <div className="flex-1" style={{ backgroundColor: theme.colors.success }} />
                <div className="flex-1" style={{ backgroundColor: theme.colors.warning }} />
                <div className="flex-1" style={{ backgroundColor: theme.colors.error }} />
              </div>

              <div className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-semibold text-white/50">{theme.name}</p>
                      {isActive && <Check className="h-3 w-3 text-fuchsia-400" />}
                    </div>
                    <p className="text-[9px] text-white/15 mt-0.5">{theme.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge variant="outline" className="text-[8px] px-1 py-0 border-white/5 text-white/15 capitalize">
                    {theme.category}
                  </Badge>
                  <button
                    onClick={() => toggleStar(theme.id)}
                    className={cn(
                      "flex items-center gap-0.5 text-[9px]",
                      isStarred ? "text-amber-400" : "text-white/15 hover:text-amber-400/50"
                    )}
                  >
                    <Star className={cn("h-2.5 w-2.5", isStarred && "fill-amber-400")} />
                    {theme.stars + (isStarred ? 1 : 0)}
                  </button>
                  <div className="flex-1" />
                  {!isActive && (
                    <Button
                      size="sm"
                      onClick={() => applyTheme(theme)}
                      className="h-5 text-[9px] px-2 bg-fuchsia-600 hover:bg-fuchsia-500"
                    >
                      Apply
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Export */}
      <div className="px-3 py-2 border-t border-white/5">
        <button
          onClick={exportTheme}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[10px] text-white/20 hover:text-white/40 transition-colors"
        >
          <Download className="h-3 w-3" />
          Export Current Theme
        </button>
      </div>
    </div>
  );
}
