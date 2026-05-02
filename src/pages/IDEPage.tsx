import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useCallback } from "react";
import { FileTree } from "@/components/ide/FileTree";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { ChatPanel } from "@/components/ide/ChatPanel";
import { PreviewPanel } from "@/components/ide/PreviewPanel";
import { TopBar } from "@/components/ide/TopBar";
import { CostBar } from "@/components/ide/CostBar";
import { WelcomePanel } from "@/components/ide/WelcomePanel";
import { SuggestionsPanel } from "@/components/ide/SuggestionsPanel";
import { MemoryPanel } from "@/components/ide/MemoryPanel";
import { RetrospectivePanel } from "@/components/ide/RetrospectivePanel";
import { ArchitectPanel } from "@/components/ide/ArchitectPanel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { FolderTree, FileCode, Play, MessageSquare, Lightbulb, Brain, RefreshCw, Hammer } from "lucide-react";

type MobileTab = "files" | "editor" | "preview" | "chat" | "suggestions" | "memory" | "retro" | "architect";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function IDEPage() {
  const isMobile = useIsMobile();
  const projects = useQuery(api.projects.list) || [];
  const activeSession = useQuery(api.sessions.getActive);
  const githubSettings = useQuery(api.github.getSettings);

  const [activeProjectId, setActiveProjectId] =
    useState<Id<"projects"> | null>(null);
  const [activeFileId, setActiveFileId] = useState<Id<"files"> | null>(null);
  const [openTabs, setOpenTabs] = useState<
    Array<{ id: Id<"files">; name: string; path: string }>
  >([]);
  const [showChat, setShowChat] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showRetro, setShowRetro] = useState(false);
  const [showArchitect, setShowArchitect] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);

  const activeProject = useQuery(
    api.projects.get,
    activeProjectId ? { projectId: activeProjectId } : "skip"
  );
  const files = useQuery(
    api.files.listByProject,
    activeProjectId ? { projectId: activeProjectId } : "skip"
  );
  const activeFileContent = useQuery(
    api.files.getContent,
    activeFileId ? { fileId: activeFileId } : "skip"
  );
  const sessionMessages = useQuery(
    api.chatMessages.listBySession,
    activeSession ? { sessionId: activeSession._id } : "skip"
  );

  const createSession = useMutation(api.sessions.create);
  const createProject = useMutation(api.projects.create);
  const updateFileContent = useMutation(api.files.updateContent);

  // Auto-select first project
  useEffect(() => {
    if (projects.length > 0 && !activeProjectId) {
      setActiveProjectId(projects[0]._id);
    }
  }, [projects, activeProjectId]);

  // Ensure there's always an active session
  useEffect(() => {
    if (activeSession === null) {
      createSession({
        name: "Session " + new Date().toLocaleDateString(),
        model: "deepseek-v3.2",
        projectId: activeProjectId || undefined,
      }).catch(console.error);
    }
  }, [activeSession, activeProjectId, createSession]);

  const handleFileSelect = useCallback(
    (fileId: Id<"files">, name: string, path: string) => {
      setActiveFileId(fileId);
      setOpenTabs((prev) => {
        if (prev.find((t) => t.id === fileId)) return prev;
        return [...prev, { id: fileId, name, path }];
      });
      if (window.innerWidth < 768) {
        setMobileTab("editor");
      }
    },
    []
  );

  const handleCloseTab = useCallback(
    (fileId: Id<"files">) => {
      setOpenTabs((prev) => prev.filter((t) => t.id !== fileId));
      if (activeFileId === fileId) {
        setActiveFileId(null);
      }
    },
    [activeFileId]
  );

  const handleSaveFile = useCallback(
    async (content: string) => {
      if (!activeFileId) return;
      await updateFileContent({ fileId: activeFileId, content });
    },
    [activeFileId, updateFileContent]
  );

  const handleExecuteSuggestion = useCallback((prompt: string) => {
    setExternalPrompt(prompt);
    // Switch to chat on mobile
    if (window.innerWidth < 768) {
      setMobileTab("chat");
    }
  }, []);

  // Get full file contents for preview
  const allFilesForPreview = useQuery(
    api.files.listWithContent,
    activeProjectId ? { projectId: activeProjectId } : "skip"
  );

  const MOBILE_TABS: {
    id: MobileTab;
    label: string;
    icon: typeof FolderTree;
  }[] = [
    { id: "files", label: "Files", icon: FolderTree },
    { id: "editor", label: "Editor", icon: FileCode },
    { id: "chat", label: "AI", icon: MessageSquare },
    { id: "memory", label: "Brain", icon: Brain },
    { id: "retro", label: "Learn", icon: RefreshCw },
    { id: "architect", label: "Spec", icon: Hammer },
    { id: "preview", label: "Preview", icon: Play },
    { id: "suggestions", label: "Ideas", icon: Lightbulb },
  ];

  // ─── MOBILE LAYOUT ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex h-[100dvh] flex-col bg-background text-foreground overflow-hidden">
        <TopBar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={setActiveProjectId}
          activeProject={activeProject}
          showChat={showChat}
          onToggleChat={() => setShowChat(!showChat)}
          githubConnected={githubSettings?.connected || false}
          isMobile={true}
        />

        {/* Main content area — full screen, swappable */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === "files" && (
            <FileTree
              files={files || []}
              activeFileId={activeFileId}
              onFileSelect={handleFileSelect}
              projectId={activeProjectId}
            />
          )}
          {mobileTab === "editor" && (
            <>
              {activeFileId && activeFileContent ? (
                <CodeEditor
                  file={activeFileContent}
                  openTabs={openTabs}
                  activeFileId={activeFileId}
                  onSelectTab={setActiveFileId}
                  onCloseTab={handleCloseTab}
                  onSave={handleSaveFile}
                />
              ) : (
                <WelcomePanel
                  projectCount={projects.length}
                  onCreateProject={() => {
                    createProject({ name: "New Project" }).then((id) =>
                      setActiveProjectId(id)
                    );
                  }}
                />
              )}
            </>
          )}
          {mobileTab === "preview" && (
            <PreviewPanel files={allFilesForPreview || []} />
          )}
          {mobileTab === "chat" && (
            <ChatPanel
              session={activeSession}
              messages={sessionMessages || []}
              activeFile={activeFileContent}
              projectId={activeProjectId}
              externalPrompt={externalPrompt}
              onExternalPromptConsumed={() => setExternalPrompt(null)}
            />
          )}
          {mobileTab === "suggestions" && (
            <SuggestionsPanel
              projectId={activeProjectId}
              onExecuteSuggestion={handleExecuteSuggestion}
            />
          )}
          {mobileTab === "memory" && (
            <MemoryPanel projectId={activeProjectId} />
          )}
          {mobileTab === "retro" && (
            <RetrospectivePanel projectId={activeProjectId} />
          )}
          {mobileTab === "architect" && (
            <ArchitectPanel projectId={activeProjectId} />
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <div className="flex items-center border-t border-border bg-card">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors",
                mobileTab === tab.id
                  ? "text-chart-3"
                  : "text-muted-foreground"
              )}
            >
              <tab.icon
                className={cn(
                  "h-5 w-5",
                  mobileTab === tab.id && "text-chart-3"
                )}
              />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {tab.id === "chat" &&
              activeSession?.totalCost &&
              activeSession.totalCost > 0 ? (
                <span className="text-[8px] text-chart-2">
                  ${activeSession.totalCost.toFixed(4)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      <TopBar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        activeProject={activeProject}
        showChat={showChat}
        onToggleChat={() => setShowChat(!showChat)}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(!showPreview)}
        showSuggestions={showSuggestions}
        onToggleSuggestions={() => setShowSuggestions(!showSuggestions)}
        showMemory={showMemory}
        onToggleMemory={() => setShowMemory(!showMemory)}
        showRetro={showRetro}
        onToggleRetro={() => setShowRetro(!showRetro)}
        showArchitect={showArchitect}
        onToggleArchitect={() => setShowArchitect(!showArchitect)}
        githubConnected={githubSettings?.connected || false}
        isMobile={false}
      />

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* File Tree */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
            <FileTree
              files={files || []}
              activeFileId={activeFileId}
              onFileSelect={handleFileSelect}
              projectId={activeProjectId}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Editor + Preview */}
          <ResizablePanel
            defaultSize={showChat ? (showSuggestions ? 37 : 52) : 82}
          >
            {showPreview ? (
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={50}>
                  {activeFileId && activeFileContent ? (
                    <CodeEditor
                      file={activeFileContent}
                      openTabs={openTabs}
                      activeFileId={activeFileId}
                      onSelectTab={setActiveFileId}
                      onCloseTab={handleCloseTab}
                      onSave={handleSaveFile}
                    />
                  ) : (
                    <WelcomePanel
                      projectCount={projects.length}
                      onCreateProject={() => {
                        createProject({ name: "New Project" }).then((id) =>
                          setActiveProjectId(id)
                        );
                      }}
                    />
                  )}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50}>
                  <PreviewPanel files={allFilesForPreview || []} />
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : activeFileId && activeFileContent ? (
              <CodeEditor
                file={activeFileContent}
                openTabs={openTabs}
                activeFileId={activeFileId}
                onSelectTab={setActiveFileId}
                onCloseTab={handleCloseTab}
                onSave={handleSaveFile}
              />
            ) : (
              <WelcomePanel
                projectCount={projects.length}
                onCreateProject={() => {
                  createProject({ name: "New Project" }).then((id) =>
                    setActiveProjectId(id)
                  );
                }}
              />
            )}
          </ResizablePanel>

          {/* Suggestions Panel */}
          {showSuggestions && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={15} minSize={12} maxSize={25}>
                <SuggestionsPanel
                  projectId={activeProjectId}
                  onExecuteSuggestion={handleExecuteSuggestion}
                />
              </ResizablePanel>
            </>
          )}

          {/* Chat Panel */}
          {showChat && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={showMemory || showRetro ? 22 : 30} minSize={18} maxSize={50}>
                <ChatPanel
                  session={activeSession}
                  messages={sessionMessages || []}
                  activeFile={activeFileContent}
                  projectId={activeProjectId}
                  externalPrompt={externalPrompt}
                  onExternalPromptConsumed={() => setExternalPrompt(null)}
                />
              </ResizablePanel>
            </>
          )}

          {/* Intelligence Panels (Memory / Retro / Architect) */}
          {(showMemory || showRetro || showArchitect) && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={18} minSize={14} maxSize={30}>
                {(() => {
                  const panels = [
                    showArchitect && <ArchitectPanel key="arch" projectId={activeProjectId} />,
                    showMemory && <MemoryPanel key="mem" projectId={activeProjectId} />,
                    showRetro && <RetrospectivePanel key="retro" projectId={activeProjectId} />,
                  ].filter(Boolean);

                  if (panels.length === 1) return panels[0];

                  return (
                    <ResizablePanelGroup direction="vertical">
                      {panels.map((panel, i) => (
                        <>{i > 0 && <ResizableHandle withHandle />}<ResizablePanel key={i} defaultSize={Math.floor(100 / panels.length)}>{panel}</ResizablePanel></>
                      ))}
                    </ResizablePanelGroup>
                  );
                })()}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <CostBar session={activeSession} />
    </div>
  );
}
