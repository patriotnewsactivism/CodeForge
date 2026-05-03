/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — THEME SELECTOR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Multiple editor themes. Persisted in localStorage.
 */
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export interface EditorTheme {
  id: string;
  name: string;
  monacoTheme: string; // Monaco built-in theme name
  preview: { bg: string; accent: string };
}

export const EDITOR_THEMES: EditorTheme[] = [
  {
    id: "cf-dark",
    name: "CodeForge Dark",
    monacoTheme: "cf-dark",
    preview: { bg: "#0a0a0f", accent: "#10b981" },
  },
  {
    id: "vs-dark",
    name: "VS Code Dark",
    monacoTheme: "vs-dark",
    preview: { bg: "#1e1e1e", accent: "#569cd6" },
  },
  {
    id: "hc-black",
    name: "High Contrast",
    monacoTheme: "hc-black",
    preview: { bg: "#000000", accent: "#ffffff" },
  },
  {
    id: "vs",
    name: "Light",
    monacoTheme: "vs",
    preview: { bg: "#ffffff", accent: "#0000ff" },
  },
];

const STORAGE_KEY = "codeforge-editor-theme";

export function useEditorTheme() {
  const [theme, setTheme] = useState<EditorTheme>(() => {
    if (typeof window === "undefined") return EDITOR_THEMES[0];
    const saved = localStorage.getItem(STORAGE_KEY);
    return EDITOR_THEMES.find((t) => t.id === saved) || EDITOR_THEMES[0];
  });

  const selectTheme = (themeId: string) => {
    const found = EDITOR_THEMES.find((t) => t.id === themeId);
    if (found) {
      setTheme(found);
      localStorage.setItem(STORAGE_KEY, themeId);
    }
  };

  return { theme, selectTheme };
}

interface ThemeSelectorProps {
  currentTheme: EditorTheme;
  onSelect: (themeId: string) => void;
}

export function ThemeSelector({ currentTheme, onSelect }: ThemeSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 gap-1 text-[10px] text-white/20 hover:text-white/40"
          title="Editor Theme"
        >
          <Palette className="h-3 w-3" />
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: currentTheme.preview.accent }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {EDITOR_THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(currentTheme.id === t.id && "bg-emerald-500/10")}
          >
            <div className="flex items-center gap-2 w-full">
              <div
                className="h-4 w-4 rounded border border-white/10 flex items-center justify-center"
                style={{ backgroundColor: t.preview.bg }}
              >
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: t.preview.accent }}
                />
              </div>
              <span className="text-xs">{t.name}</span>
              {currentTheme.id === t.id && (
                <span className="ml-auto text-emerald-400 text-[10px]">✓</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
