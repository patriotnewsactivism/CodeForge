/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — SPLIT EDITOR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Multiple files side by side in a resizable split view.
 * Each pane is a full Monaco editor.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback } from "react";
import { CodeEditor } from "./CodeEditor";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Columns2,
  X,
  Plus,
  FileCode,
} from "lucide-react";

interface SplitPane {
  id: string;
  fileId: Id<"files"> | null;
  fileName: string;
  filePath: string;
}

interface SplitEditorProps {
  openTabs: Array<{ id: Id<"files">; name: string; path: string }>;
  activeFileId: Id<"files"> | null;
  onSelectTab: (id: Id<"files">) => void;
  onCloseTab: (id: Id<"files">) => void;
  onSave: (content: string) => Promise<void>;
}

export function SplitEditor({
  openTabs,
  activeFileId,
  onSelectTab,
  onCloseTab,
  onSave,
}: SplitEditorProps) {
  const [panes, setPanes] = useState<SplitPane[]>([
    {
      id: "left",
      fileId: activeFileId,
      fileName: openTabs.find((t) => t.id === activeFileId)?.name || "",
      filePath: openTabs.find((t) => t.id === activeFileId)?.path || "",
    },
  ]);

  // Get file content for each pane
  const leftFile = useQuery(
    api.files.getContent,
    panes[0]?.fileId ? { fileId: panes[0].fileId } : "skip"
  );
  const rightFile = useQuery(
    api.files.getContent,
    panes[1]?.fileId ? { fileId: panes[1].fileId } : "skip"
  );
  const updateFile = useMutation(api.files.updateContent);

  const addPane = useCallback(() => {
    if (panes.length >= 3) return; // max 3 panes
    const otherFile = openTabs.find((t) => !panes.some((p) => p.fileId === t.id));
    setPanes([
      ...panes,
      {
        id: `pane-${Date.now()}`,
        fileId: otherFile?.id || null,
        fileName: otherFile?.name || "",
        filePath: otherFile?.path || "",
      },
    ]);
  }, [panes, openTabs]);

  const removePane = useCallback(
    (paneId: string) => {
      if (panes.length <= 1) return;
      setPanes(panes.filter((p) => p.id !== paneId));
    },
    [panes]
  );

  const setPaneFile = useCallback(
    (paneId: string, fileId: Id<"files">) => {
      const tab = openTabs.find((t) => t.id === fileId);
      if (!tab) return;
      setPanes(
        panes.map((p) =>
          p.id === paneId
            ? { ...p, fileId, fileName: tab.name, filePath: tab.path }
            : p
        )
      );
      onSelectTab(fileId);
    },
    [panes, openTabs, onSelectTab]
  );

  const handleSavePane = useCallback(
    async (paneIndex: number, content: string) => {
      const pane = panes[paneIndex];
      if (!pane?.fileId) return;
      await updateFile({ fileId: pane.fileId, content });
    },
    [panes, updateFile]
  );

  if (panes.length === 1) {
    // Single pane — just render the standard editor with an add split button
    return (
      <div className="relative h-full">
        {leftFile ? (
          <CodeEditor
            file={leftFile}
            openTabs={openTabs}
            activeFileId={activeFileId}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            onSave={onSave}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/20 text-xs">
            Select a file to edit
          </div>
        )}
        {openTabs.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 h-6 px-1.5 text-[10px] text-white/20 hover:text-white/40 gap-1 z-10"
            onClick={addPane}
            title="Split Editor"
          >
            <Columns2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // Multi-pane split view
  return (
    <ResizablePanelGroup direction="horizontal">
      {panes.map((pane, index) => {
        const fileContent = index === 0 ? leftFile : rightFile;
        return (
          <div key={pane.id} className="contents">
            {index > 0 && <ResizableHandle withHandle />}
            <ResizablePanel defaultSize={100 / panes.length} minSize={20}>
              <div className="flex flex-col h-full border-r border-white/5 last:border-r-0">
                {/* Pane header with file selector */}
                <div className="flex items-center gap-1 px-2 py-1 bg-[#0d0d14] border-b border-white/5">
                  {/* Quick file tabs for this pane */}
                  <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
                    {openTabs.map((tab) => (
                      <button
                        key={tab.id}
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded transition-colors whitespace-nowrap",
                          pane.fileId === tab.id
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "text-white/25 hover:text-white/40"
                        )}
                        onClick={() => setPaneFile(pane.id, tab.id)}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </div>
                  {panes.length > 1 && (
                    <button
                      className="text-white/15 hover:text-white/40 p-0.5"
                      onClick={() => removePane(pane.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {index === panes.length - 1 && panes.length < 3 && (
                    <button
                      className="text-white/15 hover:text-white/40 p-0.5"
                      onClick={addPane}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Editor */}
                {fileContent ? (
                  <div className="flex-1">
                    <CodeEditor
                      file={fileContent}
                      openTabs={[]}
                      activeFileId={pane.fileId}
                      onSelectTab={() => {}}
                      onCloseTab={() => {}}
                      onSave={(content) => handleSavePane(index, content)}
                      hideTabBar
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-white/15 text-xs">
                    <FileCode className="h-5 w-5 mr-2 opacity-30" />
                    Select a file above
                  </div>
                )}
              </div>
            </ResizablePanel>
          </div>
        );
      })}
    </ResizablePanelGroup>
  );
}
