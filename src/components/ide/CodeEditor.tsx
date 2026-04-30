import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, Save, Copy, Check, WrapText } from "lucide-react";
import { toast } from "sonner";

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
}

export function CodeEditor({
  file,
  openTabs,
  activeFileId,
  onSelectTab,
  onCloseTab,
  onSave,
}: CodeEditorProps) {
  const [editedContent, setEditedContent] = useState(file.content || "");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditedContent(file.content || "");
    setHasChanges(false);
  }, [file._id, file.content]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditedContent(e.target.value);
      setHasChanges(e.target.value !== (file.content || ""));
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasChanges, handleSave]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sync scroll between textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Tab key handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const value = editedContent;
      setEditedContent(value.substring(0, start) + "  " + value.substring(end));
      setHasChanges(true);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const lines = editedContent.split("\n");
  const lineCount = lines.length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Tabs */}
      <div className="flex items-center border-b border-border bg-card/30">
        <div className="flex-1 overflow-x-auto">
          <div className="flex">
            {openTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border group transition-colors",
                  tab.id === activeFileId
                    ? "bg-background text-foreground border-b-2 border-b-chart-3"
                    : "bg-card/30 text-muted-foreground hover:bg-card/60"
                )}
              >
                <span className="truncate max-w-32">{tab.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-accent rounded p-0.5 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 px-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setWordWrap(!wordWrap)}
          >
            <WrapText
              className={cn(
                "h-3.5 w-3.5",
                wordWrap && "text-chart-3"
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {hasChanges && (
            <Button
              variant="default"
              size="sm"
              className="h-6 text-[10px] px-2 gap-1"
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
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 flex">
          {/* Line numbers */}
          <div
            ref={lineNumbersRef}
            className="overflow-hidden select-none bg-card/20 border-r border-border py-2"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div
                key={i}
                className="px-3 text-right text-[11px] leading-[1.4rem] text-muted-foreground/50 font-mono"
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={handleChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className={cn(
              "flex-1 resize-none bg-transparent p-2 font-mono text-[13px] leading-[1.4rem] outline-none",
              "text-foreground caret-chart-3",
              wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
            )}
            style={{ tabSize: 2 }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 border-t border-border bg-card/30 px-3 py-0.5 text-[10px] text-muted-foreground">
        <span>{file.path}</span>
        <span className="text-chart-3">{file.language || "plaintext"}</span>
        <span>
          Ln {lines.length}, Col{" "}
          {textareaRef.current?.selectionStart
            ? editedContent
                .substring(0, textareaRef.current.selectionStart)
                .split("\n")
                .pop()?.length || 0
            : 0}
        </span>
        <span>{editedContent.length} chars</span>
        {hasChanges && <Badge variant="secondary" className="text-[9px] h-3.5 px-1">Modified</Badge>}
        <div className="flex-1" />
        <span>UTF-8</span>
        <span>Spaces: 2</span>
      </div>
    </div>
  );
}
