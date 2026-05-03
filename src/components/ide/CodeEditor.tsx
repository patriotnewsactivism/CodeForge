/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — MONACO CODE EDITOR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Full VS Code editing experience powered by Monaco Editor.
 * Features: syntax highlighting, autocomplete, minimap, diff view,
 * multi-cursor, bracket matching, keyboard shortcuts.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useCallback, useRef } from "react";
import Editor, { DiffEditor, loader } from "@monaco-editor/react";
import type { editor as monacoEditor } from "monaco-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  X,
  Save,
  Copy,
  Check,
  WrapText,
  GitCompareArrows,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

// Configure Monaco to load from CDN
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs",
  },
});

interface FileContent {
  _id: Id<"files">;
  path: string;
  name: string;
  content: string | null;
  language: string | null;
}

interface Tab {
  id: Id<"files">;
  name: string;
  path: string;
}

interface CodeEditorProps {
  file: FileContent;
  openTabs: Tab[];
  activeFileId: Id<"files">;
  onSelectTab: (id: Id<"files">) => void;
  onCloseTab: (id: Id<"files">) => void;
  onSave: (content: string) => Promise<void>;
  /** Previous content for diff view (from agent edits) */
  previousContent?: string | null;
}

// ─── Language detection ──────────────────────────────────────────
function getMonacoLanguage(path: string, lang: string | null): string {
  if (lang) {
    const map: Record<string, string> = {
      typescript: "typescript",
      javascript: "javascript",
      python: "python",
      html: "html",
      css: "css",
      json: "json",
      markdown: "markdown",
      yaml: "yaml",
      rust: "rust",
      go: "go",
      java: "java",
      cpp: "cpp",
      c: "c",
      shell: "shell",
      sql: "sql",
      xml: "xml",
      tsx: "typescript",
      jsx: "javascript",
    };
    if (map[lang]) return map[lang];
  }
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const extMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    json: "json",
    jsonc: "json",
    md: "markdown",
    mdx: "markdown",
    yaml: "yaml",
    yml: "yaml",
    toml: "ini",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    sql: "sql",
    xml: "xml",
    svg: "xml",
    graphql: "graphql",
    gql: "graphql",
    dockerfile: "dockerfile",
    env: "ini",
    gitignore: "ini",
    lock: "json",
  };
  return extMap[ext] || "plaintext";
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export function CodeEditor({
  file,
  openTabs,
  activeFileId,
  onSelectTab,
  onCloseTab,
  onSave,
  previousContent,
}: CodeEditorProps) {
  const [editedContent, setEditedContent] = useState(file.content || "");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);

  // Sync content when file changes
  useEffect(() => {
    setEditedContent(file.content || "");
    setHasChanges(false);
    setShowDiff(false);
  }, [file._id, file.content]);

  // Auto-show diff when previousContent is provided
  useEffect(() => {
    if (previousContent != null && previousContent !== file.content) {
      setShowDiff(true);
    }
  }, [previousContent, file.content]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newVal = value || "";
      setEditedContent(newVal);
      setHasChanges(newVal !== (file.content || ""));
    },
    [file.content]
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(editedContent);
      setHasChanges(false);
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    }
    setIsSaving(false);
  }, [editedContent, onSave]);

  const handleEditorMount = useCallback(
    (editor: monacoEditor.IStandaloneCodeEditor) => {
      editorRef.current = editor;
      // Ctrl+S / Cmd+S to save
      editor.addCommand(
        // Monaco KeyMod.CtrlCmd | Monaco KeyCode.KeyS
        2048 | 49, // CtrlCmd + S
        () => {
          if (hasChanges) handleSave();
        }
      );
      // Focus the editor
      editor.focus();
    },
    [hasChanges, handleSave]
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const language = getMonacoLanguage(file.path, file.language);
  const hasDiff = previousContent != null && previousContent !== file.content;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f]">
      {/* Tabs */}
      <div className="flex items-center border-b border-white/5 bg-[#0d0d14]">
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <div className="flex">
            {openTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-white/5 group transition-colors",
                  tab.id === activeFileId
                    ? "bg-[#0a0a0f] text-white border-b-2 border-b-emerald-500"
                    : "bg-[#0d0d14] text-white/40 hover:text-white/60 hover:bg-white/5"
                )}
              >
                <span className="truncate max-w-32">{tab.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 px-2">
          {hasDiff && (
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-6 w-6 p-0", showDiff && "text-emerald-400")}
              onClick={() => setShowDiff(!showDiff)}
              title="Toggle diff view"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
            </Button>
          )}
          {showDiff && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowDiff(false)}
              title="Exit diff view"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-6 w-6 p-0", wordWrap && "text-emerald-400")}
            onClick={() => setWordWrap(!wordWrap)}
          >
            <WrapText className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {hasChanges && (
            <Button
              variant="default"
              size="sm"
              className="h-6 text-[10px] px-2 gap-1 bg-emerald-600 hover:bg-emerald-500"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-3 w-3" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden">
        {showDiff && previousContent != null ? (
          <DiffEditor
            original={previousContent}
            modified={editedContent}
            language={language}
            theme="cf-dark"
            beforeMount={(monaco) => {
              defineTheme(monaco);
            }}
            options={{
              readOnly: false,
              renderSideBySide: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 20,
              scrollBeyondLastLine: false,
              wordWrap: wordWrap ? "on" : "off",
              renderIndicators: true,
              originalEditable: false,
            }}
          />
        ) : (
          <Editor
            value={editedContent}
            language={language}
            theme="cf-dark"
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            beforeMount={(monaco) => {
              defineTheme(monaco);
            }}
            options={{
              fontSize: 13,
              lineHeight: 20,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
              fontLigatures: true,
              minimap: {
                enabled: true,
                maxColumn: 80,
                renderCharacters: false,
              },
              wordWrap: wordWrap ? "on" : "off",
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              renderLineHighlight: "all",
              renderWhitespace: "selection",
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true,
              },
              suggest: {
                showKeywords: true,
                showSnippets: true,
              },
              tabSize: 2,
              insertSpaces: true,
              automaticLayout: true,
              padding: { top: 8, bottom: 8 },
            }}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 border-t border-white/5 bg-[#0d0d14] px-3 py-0.5 text-[10px] text-white/30">
        <span className="text-white/50">{file.path}</span>
        <span className="text-emerald-400">{language}</span>
        <span>{editedContent.length.toLocaleString()} chars</span>
        <span>{editedContent.split("\n").length} lines</span>
        {hasChanges && (
          <Badge
            variant="secondary"
            className="text-[9px] h-3.5 px-1 bg-amber-500/20 text-amber-400 border-amber-500/30"
          >
            Modified
          </Badge>
        )}
        {showDiff && (
          <Badge
            variant="secondary"
            className="text-[9px] h-3.5 px-1 bg-purple-500/20 text-purple-400 border-purple-500/30"
          >
            Diff View
          </Badge>
        )}
        <div className="flex-1" />
        <span>UTF-8</span>
        <span>Spaces: 2</span>
      </div>
    </div>
  );
}

// ─── Custom Dark Theme ──────────────────────────────────────────
function defineTheme(monaco: typeof import("monaco-editor")) {
  monaco.editor.defineTheme("cf-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "4a5568", fontStyle: "italic" },
      { token: "keyword", foreground: "c084fc" },
      { token: "string", foreground: "6ee7b7" },
      { token: "number", foreground: "f9a8d4" },
      { token: "type", foreground: "67e8f9" },
      { token: "function", foreground: "fbbf24" },
      { token: "variable", foreground: "e2e8f0" },
      { token: "operator", foreground: "94a3b8" },
      { token: "delimiter", foreground: "64748b" },
      { token: "tag", foreground: "f87171" },
      { token: "attribute.name", foreground: "67e8f9" },
      { token: "attribute.value", foreground: "6ee7b7" },
    ],
    colors: {
      "editor.background": "#0a0a0f",
      "editor.foreground": "#e2e8f0",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.selectionBackground": "#10b98133",
      "editor.inactiveSelectionBackground": "#10b98118",
      "editorLineNumber.foreground": "#334155",
      "editorLineNumber.activeForeground": "#10b981",
      "editorCursor.foreground": "#10b981",
      "editorBracketMatch.background": "#10b98120",
      "editorBracketMatch.border": "#10b98140",
      "editorIndentGuide.background": "#1e293b",
      "editorIndentGuide.activeBackground": "#334155",
      "editorGutter.background": "#0a0a0f",
      "editor.selectionHighlightBackground": "#10b98118",
      "editorOverviewRuler.border": "#0a0a0f",
      "scrollbarSlider.background": "#ffffff10",
      "scrollbarSlider.hoverBackground": "#ffffff20",
      "scrollbarSlider.activeBackground": "#ffffff30",
      "minimap.background": "#0a0a0f",
      "editorWidget.background": "#0d0d14",
      "editorWidget.border": "#1e293b",
      "editorSuggestWidget.background": "#0d0d14",
      "editorSuggestWidget.border": "#1e293b",
      "editorSuggestWidget.selectedBackground": "#10b98120",
      "input.background": "#0a0a0f",
      "input.border": "#1e293b",
      "focusBorder": "#10b981",
      "list.hoverBackground": "#ffffff08",
      "list.activeSelectionBackground": "#10b98120",
      "diffEditor.insertedTextBackground": "#10b98120",
      "diffEditor.removedTextBackground": "#f8717120",
    },
  });
}
