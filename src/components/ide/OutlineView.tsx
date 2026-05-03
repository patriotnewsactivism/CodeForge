/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — CODE OUTLINE / SYMBOL VIEW
 * ═══════════════════════════════════════════════════════════════════
 *
 * Shows functions, classes, and exports in the current file.
 * Click to jump to that section.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ListTree,
  Braces,
  Variable,
  FunctionSquare,
  Box,
  Type,
  Hash,
} from "lucide-react";

interface OutlineItem {
  name: string;
  kind: "function" | "class" | "variable" | "interface" | "type" | "export" | "import";
  line: number;
  indent: number;
}

interface OutlineViewProps {
  content: string | null;
  language: string | null;
  onJumpToLine?: (line: number) => void;
}

const KIND_CONFIG: Record<
  OutlineItem["kind"],
  { icon: typeof Braces; color: string }
> = {
  function: { icon: FunctionSquare, color: "text-blue-400/60" },
  class: { icon: Box, color: "text-yellow-400/60" },
  variable: { icon: Variable, color: "text-emerald-400/60" },
  interface: { icon: Type, color: "text-purple-400/60" },
  type: { icon: Type, color: "text-purple-400/60" },
  export: { icon: Braces, color: "text-orange-400/60" },
  import: { icon: Hash, color: "text-white/20" },
};

function parseOutline(content: string, language: string | null): OutlineItem[] {
  const items: OutlineItem[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    // Functions
    if (/^(export\s+)?(async\s+)?function\s+(\w+)/.test(trimmed)) {
      const match = trimmed.match(/function\s+(\w+)/);
      if (match) {
        items.push({ name: match[1], kind: "function", line: i + 1, indent: Math.floor(indent / 2) });
      }
    }
    // Arrow functions assigned to const/let/var
    else if (/^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/.test(trimmed)) {
      const match = trimmed.match(/(const|let|var)\s+(\w+)\s*=/);
      if (match) {
        items.push({ name: match[2], kind: "function", line: i + 1, indent: Math.floor(indent / 2) });
      }
    }
    // Classes
    else if (/^(export\s+)?(abstract\s+)?class\s+(\w+)/.test(trimmed)) {
      const match = trimmed.match(/class\s+(\w+)/);
      if (match) {
        items.push({ name: match[1], kind: "class", line: i + 1, indent: Math.floor(indent / 2) });
      }
    }
    // Interfaces
    else if (/^(export\s+)?interface\s+(\w+)/.test(trimmed)) {
      const match = trimmed.match(/interface\s+(\w+)/);
      if (match) {
        items.push({ name: match[1], kind: "interface", line: i + 1, indent: Math.floor(indent / 2) });
      }
    }
    // Type aliases
    else if (/^(export\s+)?type\s+(\w+)\s*=/.test(trimmed)) {
      const match = trimmed.match(/type\s+(\w+)/);
      if (match) {
        items.push({ name: match[1], kind: "type", line: i + 1, indent: Math.floor(indent / 2) });
      }
    }
    // Python: def, class
    else if (language === "python") {
      if (/^(async\s+)?def\s+(\w+)/.test(trimmed)) {
        const match = trimmed.match(/def\s+(\w+)/);
        if (match) {
          items.push({ name: match[1], kind: "function", line: i + 1, indent: Math.floor(indent / 4) });
        }
      }
      if (/^class\s+(\w+)/.test(trimmed)) {
        const match = trimmed.match(/class\s+(\w+)/);
        if (match) {
          items.push({ name: match[1], kind: "class", line: i + 1, indent: 0 });
        }
      }
    }
  }

  return items;
}

export function OutlineView({ content, language, onJumpToLine }: OutlineViewProps) {
  const items = useMemo(
    () => (content ? parseOutline(content, language) : []),
    [content, language]
  );

  if (!content) {
    return (
      <div className="text-center py-8 text-white/15 text-xs">
        <ListTree className="h-6 w-6 mx-auto mb-2 opacity-20" />
        <p>No file open</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-white/15 text-xs">
        <p>No symbols found</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-0.5">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-white/20 uppercase tracking-wider font-semibold">
        <ListTree className="h-3 w-3" />
        Outline ({items.length})
      </div>
      {items.map((item, idx) => {
        const config = KIND_CONFIG[item.kind];
        const Icon = config.icon;

        return (
          <button
            key={idx}
            onClick={() => onJumpToLine?.(item.line)}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-white/5 rounded transition-colors"
            style={{ paddingLeft: `${8 + item.indent * 12}px` }}
          >
            <Icon className={cn("h-3 w-3 shrink-0", config.color)} />
            <span className="text-[11px] text-white/50 truncate">
              {item.name}
            </span>
            <span className="text-[9px] text-white/10 ml-auto shrink-0">
              L{item.line}
            </span>
          </button>
        );
      })}
    </div>
  );
}
