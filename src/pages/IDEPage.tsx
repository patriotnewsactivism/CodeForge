/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — IDE PAGE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Main IDE layout. Three panels:
 *  Left:   File Tree
 *  Center: Code Editor
 *  Right:  Chat + Agent Activity (tabbed)
 *
 * Mobile: Bottom tab navigation between panels.
 */
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
import { AgentActivityPanel } from "@/components/ide/AgentActivityPanel";
import { GitPanel } from "@/components/ide/GitPanel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import {
  FolderTree,
  FileCode,
  Play,
  MessageSquare,
  Lightbulb,
  Activity,
  GitBranch,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
type MobileTab = "files" | "editor" | "preview" | "chat" | "agents" | "suggestions" | "git";

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

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function IDEPage() {
  const isMobile = useIsMobile();

  // ─── Data ───────────────────────────────────────────────────────
  const projects = useQuery(api.projects.list) || [];
  const activeSession = useQuery(api.sessions.getActive);
  const githubSettings = useQuery(api.github.getSettings);

  // ─── State ──────────────────────────────────────────────────────
  const [activeProjectId, setActiveProjectId] = useState<Id<"projects"> | null>(null);
  const [activeFileId, setActiveFileId] = useState<Id<"files"> | null>(null);
  const [openTabs, setOpenTabs] = useState<Array<{ id: Id<"files">; name: string; path: string }>>([]);
  const [showChat, setShowChat] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [showGit, setShowGit] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);
  const [activeMissionId, setActiveMissionId] = useState<Id<"missions"> | null>(null);

  // ─── Queries ────────────────────────────────────────────────────
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
  const allFilesForPreview = useQuery(
    api.files.listWithContent,
    activeProjectId ? { projectId: activeProjectId } : "skip"
  );

  // ─── Mutations ──────────────────────────────────────────────────
  const createSession = useMutation(api.sessions.create);
  const createProject = useMutation(api.projects.create);
  const updateFileContent = useMutation(api.files.updateContent);

  // ─── Effects ────────────────────────────────────────────────────
  // Auto-select first project
  useEffect(() => {
    if (projects.length > 0 && !activeProjectId) {
      setActiveProjectId(projects[0]._id);
    }
  }, [projects, activeProjectId]);

  // Auto-create session
  useEffect(() => {
    if (activeSession === null) {
      createSession({
        name: "Session " + new Date().toLocaleDateString(),
        model: "deepseek-v3.2",
        projectId: activeProjectId || undefined,
      }).catch(console.error);
    }
  }, [activeSession, activeProjectId, createSession]);

  // ─── Handlers ─────────────────────────────────────────────────
  const handleFileSelect = useCallback(
    (fileId: Id<"files">, name: string, path: string) => {
      setActiveFileId(fileId);
      setOpenTabs((prev) => {
        if (prev.find((t) => t.id === fileId)) return prev;
        return [...prev, { id: fileId, name, path }];
      });
      if (window.innerWidth < 768) setMobileTab("editor");
    },
    []
  );

  const handleCloseTab = useCallback(
    (fileId: Id<"files">) => {
      setOpenTabs((prev) => prev.filter((t) => t.id !== fileId));
      if (activeFileId === fileId) setActiveFileId(null);
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
    if (window.innerWidth < 768) setMobileTab("chat");
  }, []);

  const handleMissionStarted = useCallback((missionId: string) => {
    setActiveMissionId(missionId as Id<"missions">);
    setShowAgents(true);
    if (window.innerWidth < 768) setMobileTab("agents");
  }, []);

  const handleCreateProject = useCallback(() => {
    createProject({ name: "New Project" }).then((id) => setActiveProjectId(id));
  }, [createProject]);

  // ─── Mobile Tabs ──────────────────────────────────────────────
  const MOBILE_TABS: { id: MobileTab; label: string; icon: typeof FolderTree }[] = [
    { id: "files", label: "Files", icon: FolderTree },
    { id: "editor", label: "Code", icon: FileCode },
    { id: "chat", label: "AI", icon: MessageSquare },
    { id: "agents", label: "Agents", icon: Activity },
    { id: "preview", label: "Preview", icon: Play },
    { id: "suggestions", label: "Ideas", icon: Lightbulb },
    { id: "git", label: "Git", icon: GitBranch },
  ];

  // ─── MOBILE LAYOUT ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex h-[100dvh] flex-col bg-[#0a0a0f] text-white overflow-hidden">
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
            activeFileId && activeFileContent ? (
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
                onCreateProject={handleCreateProject}
              />
            )
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
              onMissionStarted={handleMissionStarted}
            />
          )}
          {mobileTab === "agents" && (
            <AgentActivityPanel
              missionId={activeMissionId}
              projectId={activeProjectId}
            />
          )}
          {mobileTab === "suggestions" && (
            <SuggestionsPanel
              projectId={activeProjectId}
              onExecuteSuggestion={handleExecuteSuggestion}
            />
          )}
          {mobileTab === "git" && (
            <GitPanel projectId={activeProjectId} />
          )}
        </div>

        {/* Mobile bottom tabs */}
        <div className="flex items-center border-t border-white/5 bg-[#0a0a0f] overflow-x-auto scrollbar-none">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={cn(
                "flex-none min-w-[3.5rem] flex flex-col items-center gap-0.5 py-2 px-1.5 transition-colors",
                mobileTab === tab.id ? "text-emerald-400" : "text-white/30"
              )}
            >
              <tab.icon className={cn("h-5 w-5", mobileTab === tab.id && "text-emerald-400")} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f] text-white overflow-hidden">
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
        showAgents={showAgents}
        onToggleAgents={() => setShowAgents(!showAgents)}
        showGit={showGit}
        onToggleGit={() => setShowGit(!showGit)}
        githubConnected={githubSettings?.connected || false}
        isMobile={false}
      />

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* File Tree */}
          <ResizablePanel defaultSize={16} minSize={12} maxSize={25}>
            <FileTree
              files={files || []}
              activeFileId={activeFileId}
              onFileSelect={handleFileSelect}
              projectId={activeProjectId}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Editor (+ optional Preview below) */}
          <ResizablePanel defaultSize={showChat ? 44 : 64}>
            {showPreview ? (
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={55}>
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
                      onCreateProject={handleCreateProject}
                    />
                  )}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={45}>
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
                onCreateProject={handleCreateProject}
              />
            )}
          </ResizablePanel>

          {/* Suggestions panel */}
          {showSuggestions && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={14} minSize={10} maxSize={22}>
                <SuggestionsPanel
                  projectId={activeProjectId}
                  onExecuteSuggestion={handleExecuteSuggestion}
                />
              </ResizablePanel>
            </>
          )}

          {/* Chat panel */}
          {showChat && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={showAgents ? 20 : 26} minSize={16} maxSize={40}>
                <ChatPanel
                  session={activeSession}
                  messages={sessionMessages || []}
                  activeFile={activeFileContent}
                  projectId={activeProjectId}
                  externalPrompt={externalPrompt}
                  onExternalPromptConsumed={() => setExternalPrompt(null)}
                  onMissionStarted={handleMissionStarted}
                />
              </ResizablePanel>
            </>
          )}

          {/* Agent Activity / Git panel */}
          {(showAgents || showGit) && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={18} minSize={14} maxSize={30}>
                {showAgents && showGit ? (
                  <ResizablePanelGroup direction="vertical">
                    <ResizablePanel defaultSize={60}>
                      <AgentActivityPanel
                        missionId={activeMissionId}
                        projectId={activeProjectId}
                      />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={40}>
                      <GitPanel projectId={activeProjectId} />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : showAgents ? (
                  <AgentActivityPanel
                    missionId={activeMissionId}
                    projectId={activeProjectId}
                  />
                ) : (
                  <GitPanel projectId={activeProjectId} />
                )}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <CostBar session={activeSession} />
    </div>
  );
}
