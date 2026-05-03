/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — IDE PAGE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Main IDE layout with Monaco editor, live preview, diff view,
 * agent activity, mission replay, auto-fix loop, command palette,
 * workspace search, cost dashboard, deploy, env manager.
 *
 * Desktop: FileTree | Editor(+Preview) | Suggestions | Chat | AgentActivity/Git
 * Mobile: Bottom tab navigation between panels.
 */
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useCallback, useRef } from "react";
import { FileTree } from "@/components/ide/FileTree";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { ChatPanel } from "@/components/ide/ChatPanel";
import { PreviewPanel } from "@/components/ide/PreviewPanel";
import type { ConsoleError } from "@/components/ide/PreviewPanel";
import { TopBar } from "@/components/ide/TopBar";
import { CostBar } from "@/components/ide/CostBar";
import { WelcomePanel } from "@/components/ide/WelcomePanel";
import { SuggestionsPanel } from "@/components/ide/SuggestionsPanel";
import { AgentActivityPanel } from "@/components/ide/AgentActivityPanel";
import { GitPanel } from "@/components/ide/GitPanel";
import { MissionReplay } from "@/components/ide/MissionReplay";
import { CommandPalette } from "@/components/ide/CommandPalette";
import { SearchPanel } from "@/components/ide/SearchPanel";
import { CostDashboard } from "@/components/ide/CostDashboard";
import { KeyboardShortcuts } from "@/components/ide/KeyboardShortcuts";
import { TerminalPanel } from "@/components/ide/TerminalPanel";
import { FileUpload } from "@/components/ide/FileUpload";
import { Breadcrumb } from "@/components/ide/Breadcrumb";
import { SettingsPanel, useEditorSettings } from "@/components/ide/SettingsPanel";
import { AIReviewPanel } from "@/components/ide/AIReviewPanel";
import { CollaborationBar } from "@/components/ide/CollaborationBar";
import { NotificationCenter } from "@/components/ide/NotificationCenter";
import { ProjectStats } from "@/components/ide/ProjectStats";
import { MemoryDashboard } from "@/components/ide/MemoryDashboard";
import { MissionTimeline } from "@/components/ide/MissionTimeline";
import { ContextWindow } from "@/components/ide/ContextWindow";
import { ActivityLog } from "@/components/ide/ActivityLog";
import { PerfMonitor } from "@/components/ide/PerfMonitor";
import { ArchitectureAdvisor } from "@/components/ide/ArchitectureAdvisor";
import { TestGenerator } from "@/components/ide/TestGenerator";
import { AgentDebatePanel } from "@/components/ide/AgentDebatePanel";
import { DependencyScanner } from "@/components/ide/DependencyScanner";
import { CodeCritic } from "@/components/ide/CodeCritic";
import { PromptMarketplace } from "@/components/ide/PromptMarketplace";
import { AgentTrainer } from "@/components/ide/AgentTrainer";
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
  Search,
  DollarSign,
  Terminal,
  Settings,
  MoreHorizontal,
  X,
  Eye,
  Brain,
  Clock,
  Building2,
  FlaskConical,
  Scale,
  Package,
  Store,
  ScanEye,
  GraduationCap,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
type MobileTab = "files" | "editor" | "preview" | "chat" | "agents" | "suggestions" | "git" | "search" | "costs" | "terminal" | "memory" | "timeline" | "context" | "activity" | "architect" | "tests" | "debate" | "deps" | "critic" | "prompts" | "trainer";

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
  const [showSearch, setShowSearch] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);
  const [activeMissionId, setActiveMissionId] = useState<Id<"missions"> | null>(null);
  const [showReplay, setShowReplay] = useState(false);

  // Command palette, shortcuts, terminal, settings, memory, timeline
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showArchitect, setShowArchitect] = useState(false);
  const [showTests, setShowTests] = useState(false);
  const [showDebate, setShowDebate] = useState(false);
  const [showDeps, setShowDeps] = useState(false);
  const [showCritic, setShowCritic] = useState(false);
  const [showPromptMarket, setShowPromptMarket] = useState(false);
  const [showTrainer, setShowTrainer] = useState(false);
  const { settings: editorSettings, updateSettings } = useEditorSettings();

  // Auto-fix loop state
  const autoFixTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoFixEnabled] = useState(true);
  const lastErrorRef = useRef<string>("");

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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+F → Search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
      // ? → Shortcuts (only when not focused on input)
      if (e.key === "?" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ─── Auto-Fix Loop ─────────────────────────────────────────────
  const handlePreviewErrors = useCallback(
    (errors: ConsoleError[]) => {
      if (!autoFixEnabled || !activeProjectId || !activeSession) return;
      if (errors.length === 0) return;

      const errKey = errors.map((e) => e.message).join("|");
      if (errKey === lastErrorRef.current) return;
      lastErrorRef.current = errKey;

      if (autoFixTimeoutRef.current) {
        clearTimeout(autoFixTimeoutRef.current);
      }
      autoFixTimeoutRef.current = setTimeout(() => {
        const errorSummary = errors
          .slice(0, 5)
          .map((e) => `• ${e.message}${e.line ? ` (line ${e.line})` : ""}`)
          .join("\n");

        const fixPrompt = `🔧 AUTO-FIX: The live preview is showing these errors:\n\n${errorSummary}\n\nPlease analyze and fix these errors in the project files. Make the minimal changes needed to resolve them.`;

        setExternalPrompt(fixPrompt);
      }, 3000);
    },
    [autoFixEnabled, activeProjectId, activeSession]
  );

  // ─── Handlers ─────────────────────────────────────────────────
  const handleFileSelect = useCallback(
    (fileId: Id<"files"> | string, name: string, path: string) => {
      const typedId = fileId as Id<"files">;
      setActiveFileId(typedId);
      setOpenTabs((prev) => {
        if (prev.find((t) => t.id === typedId)) return prev;
        return [...prev, { id: typedId, name, path }];
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

  const handleSendPrompt = useCallback((prompt: string) => {
    setExternalPrompt(prompt);
    setShowChat(true);
    if (window.innerWidth < 768) setMobileTab("chat");
  }, []);

  const handleReplayMission = useCallback((missionId: Id<"missions">) => {
    setActiveMissionId(missionId);
    setShowReplay(true);
    setShowAgents(true);
    if (window.innerWidth < 768) setMobileTab("agents");
  }, []);

  const handleViewAgents = useCallback((missionId: Id<"missions">) => {
    setActiveMissionId(missionId);
    setShowReplay(false);
    setShowAgents(true);
    if (window.innerWidth < 768) setMobileTab("agents");
  }, []);

  // ─── Mobile Tabs ──────────────────────────────────────────────
  // Primary: 4 most-used tabs always visible
  // Secondary: accessible from "More" drawer
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);

  const PRIMARY_TABS: { id: MobileTab; label: string; icon: typeof FolderTree }[] = [
    { id: "chat", label: "AI", icon: MessageSquare },
    { id: "editor", label: "Code", icon: FileCode },
    { id: "files", label: "Files", icon: FolderTree },
    { id: "agents", label: "Agents", icon: Activity },
  ];

  const SECONDARY_TABS: { id: MobileTab; label: string; icon: typeof FolderTree; desc: string }[] = [
    { id: "preview", label: "Preview", icon: Play, desc: "Live preview of your project" },
    { id: "search", label: "Search", icon: Search, desc: "Search across all project files" },
    { id: "suggestions", label: "Ideas", icon: Lightbulb, desc: "AI improvement suggestions" },
    { id: "memory", label: "Memory", icon: Brain, desc: "Agent learnings and intelligence" },
    { id: "timeline", label: "History", icon: Clock, desc: "Mission history timeline" },
    { id: "context", label: "Context", icon: Eye, desc: "What the AI sees right now" },
    { id: "architect", label: "Advisor", icon: Building2, desc: "Architecture analysis & insights" },
    { id: "tests", label: "Tests", icon: FlaskConical, desc: "Auto-generate unit tests" },
    { id: "debate", label: "Debate", icon: Scale, desc: "Watch agents discuss approach" },
    { id: "deps", label: "Deps", icon: Package, desc: "Dependency scanner & optimization" },
    { id: "critic", label: "Critic", icon: ScanEye, desc: "AI code review with grades" },
    { id: "prompts", label: "Prompts", icon: Store, desc: "Browse prompt marketplace" },
    { id: "trainer", label: "Trainer", icon: GraduationCap, desc: "Train & customize your agents" },
    { id: "activity", label: "Activity", icon: Activity, desc: "Global activity log" },
    { id: "git", label: "Git", icon: GitBranch, desc: "GitHub sync and version control" },
    { id: "costs", label: "Costs", icon: DollarSign, desc: "AI usage and cost tracking" },
    { id: "terminal", label: "Terminal", icon: Terminal, desc: "Agent output and logs" },
  ];

  // Check if current tab is a secondary one (show it in nav bar instead of "More")
  const isSecondaryActive = SECONDARY_TABS.some((t) => t.id === mobileTab);

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
            <PreviewPanel
              files={allFilesForPreview || []}
              onErrors={handlePreviewErrors}
            />
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
            showReplay ? (
              <MissionReplay
                missionId={activeMissionId}
                onClose={() => setShowReplay(false)}
              />
            ) : (
              <AgentActivityPanel
                missionId={activeMissionId}
                projectId={activeProjectId}
              />
            )
          )}
          {mobileTab === "suggestions" && (
            <SuggestionsPanel
              projectId={activeProjectId}
              onExecuteSuggestion={handleExecuteSuggestion}
            />
          )}
          {mobileTab === "search" && (
            <SearchPanel
              projectId={activeProjectId}
              onFileSelect={handleFileSelect}
            />
          )}
          {mobileTab === "git" && (
            <GitPanel projectId={activeProjectId} />
          )}
          {mobileTab === "costs" && (
            <CostDashboard projectId={activeProjectId} />
          )}
          {mobileTab === "terminal" && (
            <TerminalPanel projectId={activeProjectId} missionId={activeMissionId} />
          )}
          {mobileTab === "memory" && (
            <MemoryDashboard projectId={activeProjectId} />
          )}
          {mobileTab === "timeline" && (
            <MissionTimeline
              projectId={activeProjectId}
              onReplayMission={handleReplayMission}
              onViewAgents={handleViewAgents}
            />
          )}
          {mobileTab === "context" && (
            <ContextWindow
              projectId={activeProjectId}
              activeFileId={activeFileId}
              sessionId={activeSession?._id}
            />
          )}
          {mobileTab === "architect" && (
            <ArchitectureAdvisor projectId={activeProjectId} />
          )}
          {mobileTab === "tests" && (
            <TestGenerator projectId={activeProjectId} activeFile={activeFileContent} />
          )}
          {mobileTab === "debate" && (
            <AgentDebatePanel projectId={activeProjectId} missionId={activeMissionId} />
          )}
          {mobileTab === "deps" && (
            <DependencyScanner projectId={activeProjectId} />
          )}
          {mobileTab === "critic" && (
            <CodeCritic projectId={activeProjectId} activeFile={activeFileContent} />
          )}
          {mobileTab === "prompts" && (
            <PromptMarketplace onUsePrompt={handleSendPrompt} />
          )}
          {mobileTab === "trainer" && (
            <AgentTrainer projectId={activeProjectId} />
          )}
          {mobileTab === "activity" && (
            <ActivityLog />
          )}
        </div>

        {/* "More" drawer overlay */}
        {showMoreDrawer && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="flex-1 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowMoreDrawer(false)}
            />
            {/* Drawer */}
            <div className="bg-[#0d0d14] border-t border-white/10 rounded-t-2xl p-4 pb-6 animate-in slide-in-from-bottom">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/70">Tools & Panels</h3>
                <button
                  onClick={() => setShowMoreDrawer(false)}
                  className="h-7 w-7 flex items-center justify-center rounded-full bg-white/5 text-white/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SECONDARY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setMobileTab(tab.id);
                      setShowMoreDrawer(false);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                      "border border-white/5 hover:border-white/10",
                      mobileTab === tab.id
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-white/[0.02] text-white/40 hover:text-white/60"
                    )}
                  >
                    <tab.icon className="h-5 w-5" />
                    <span className="text-[11px] font-medium">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile bottom nav — clean 5-button layout */}
        <div className="flex items-center justify-around border-t border-white/5 bg-[#0a0a0f]/95 backdrop-blur-md safe-bottom">
          {PRIMARY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setMobileTab(tab.id);
                setShowMoreDrawer(false);
              }}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors",
                mobileTab === tab.id
                  ? "text-emerald-400"
                  : "text-white/30 active:text-white/50"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[9px] font-semibold tracking-wide uppercase">
                {tab.label}
              </span>
              {/* Active indicator dot */}
              {mobileTab === tab.id && (
                <div className="h-1 w-1 rounded-full bg-emerald-400 mt-0.5" />
              )}
            </button>
          ))}

          {/* "More" button — or shows current secondary tab */}
          <button
            onClick={() => setShowMoreDrawer(!showMoreDrawer)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors",
              isSecondaryActive
                ? "text-emerald-400"
                : showMoreDrawer
                ? "text-emerald-400"
                : "text-white/30 active:text-white/50"
            )}
          >
            {isSecondaryActive ? (
              <>
                {(() => {
                  const activeTab = SECONDARY_TABS.find((t) => t.id === mobileTab);
                  if (!activeTab) return <MoreHorizontal className="h-5 w-5" />;
                  return <activeTab.icon className="h-5 w-5" />;
                })()}
                <span className="text-[9px] font-semibold tracking-wide uppercase">
                  {SECONDARY_TABS.find((t) => t.id === mobileTab)?.label || "More"}
                </span>
                <div className="h-1 w-1 rounded-full bg-emerald-400 mt-0.5" />
              </>
            ) : (
              <>
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[9px] font-semibold tracking-wide uppercase">
                  More
                </span>
                {showMoreDrawer && (
                  <div className="h-1 w-1 rounded-full bg-emerald-400 mt-0.5" />
                )}
              </>
            )}
          </button>
        </div>

        {/* Command Palette */}
        <CommandPalette
          open={showCommandPalette}
          onOpenChange={setShowCommandPalette}
          files={(files || []).map((f) => ({ _id: f._id as string, name: f.name, path: f.path }))}
          onFileSelect={handleFileSelect}
          onToggleChat={() => setShowChat(!showChat)}
          onTogglePreview={() => setShowPreview(!showPreview)}
          onNewProject={handleCreateProject}
          onSendPrompt={handleSendPrompt}
        />
        <KeyboardShortcuts open={showShortcuts} onOpenChange={setShowShortcuts} />
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
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(!showSearch)}
        showCosts={showCosts}
        onToggleCosts={() => setShowCosts(!showCosts)}
        showTerminal={showTerminal}
        onToggleTerminal={() => setShowTerminal(!showTerminal)}
        showMemory={showMemory}
        onToggleMemory={() => setShowMemory(!showMemory)}
        showTimeline={showTimeline}
        onToggleTimeline={() => setShowTimeline(!showTimeline)}
        showContext={showContext}
        onToggleContext={() => setShowContext(!showContext)}
        showActivity={showActivity}
        onToggleActivity={() => setShowActivity(!showActivity)}
        showArchitect={showArchitect}
        onToggleArchitect={() => setShowArchitect(!showArchitect)}
        showTests={showTests}
        onToggleTests={() => setShowTests(!showTests)}
        showDebate={showDebate}
        onToggleDebate={() => setShowDebate(!showDebate)}
        showDeps={showDeps}
        onToggleDeps={() => setShowDeps(!showDeps)}
        showCritic={showCritic}
        onToggleCritic={() => setShowCritic(!showCritic)}
        showPromptMarket={showPromptMarket}
        onTogglePromptMarket={() => setShowPromptMarket(!showPromptMarket)}
        showTrainer={showTrainer}
        onToggleTrainer={() => setShowTrainer(!showTrainer)}
        githubConnected={githubSettings?.connected || false}
        isMobile={false}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenSettings={() => setShowSettings(true)}
        onSendPrompt={handleSendPrompt}
      />

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* File Tree or Search */}
          <ResizablePanel defaultSize={16} minSize={12} maxSize={25}>
            {showSearch ? (
              <SearchPanel
                projectId={activeProjectId}
                onFileSelect={handleFileSelect}
              />
            ) : (
              <FileTree
                files={files || []}
                activeFileId={activeFileId}
                onFileSelect={handleFileSelect}
                projectId={activeProjectId}
              />
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Editor (+ optional Preview/Terminal below) */}
          <ResizablePanel defaultSize={showChat ? 44 : 64}>
            <FileUpload projectId={activeProjectId} className="h-full">
              {showPreview || showTerminal ? (
                <ResizablePanelGroup direction="vertical">
                  <ResizablePanel defaultSize={showPreview && showTerminal ? 45 : 55}>
                    <div className="flex flex-col h-full">
                      {activeFileId && activeFileContent && (
                        <Breadcrumb
                          path={activeFileContent.path}
                          projectName={activeProject?.name}
                        />
                      )}
                      <div className="flex-1">
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
                      </div>
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  {showPreview && showTerminal ? (
                    <>
                      <ResizablePanel defaultSize={30}>
                        <PreviewPanel
                          files={allFilesForPreview || []}
                          onErrors={handlePreviewErrors}
                        />
                      </ResizablePanel>
                      <ResizableHandle withHandle />
                      <ResizablePanel defaultSize={25}>
                        <TerminalPanel projectId={activeProjectId} missionId={activeMissionId} />
                      </ResizablePanel>
                    </>
                  ) : showPreview ? (
                    <ResizablePanel defaultSize={45}>
                      <PreviewPanel
                        files={allFilesForPreview || []}
                        onErrors={handlePreviewErrors}
                      />
                    </ResizablePanel>
                  ) : (
                    <ResizablePanel defaultSize={35}>
                      <TerminalPanel projectId={activeProjectId} missionId={activeMissionId} />
                    </ResizablePanel>
                  )}
                </ResizablePanelGroup>
              ) : (
                <div className="flex flex-col h-full">
                  {activeFileId && activeFileContent && (
                    <Breadcrumb
                      path={activeFileContent.path}
                      projectName={activeProject?.name}
                    />
                  )}
                  <div className="flex-1">
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
                  </div>
                </div>
              )}
            </FileUpload>
          </ResizablePanel>

          {/* Suggestions + AI Review + Stats panel */}
          {showSuggestions && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={16} minSize={12} maxSize={26}>
                <ResizablePanelGroup direction="vertical">
                  <ResizablePanel defaultSize={40}>
                    <SuggestionsPanel
                      projectId={activeProjectId}
                      onExecuteSuggestion={handleExecuteSuggestion}
                    />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={40}>
                    <AIReviewPanel
                      projectId={activeProjectId}
                      activeFile={activeFileContent}
                      onSendPrompt={handleSendPrompt}
                    />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={20}>
                    <div className="h-full overflow-y-auto bg-[#0a0a0f]">
                      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
                        <span className="text-[11px] font-semibold text-white/40">📊 Stats</span>
                      </div>
                      <ProjectStats projectId={activeProjectId} />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
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

          {/* Agent Activity / Git / Costs / Memory / Timeline / Context / Activity / Architect / Tests / Debate / Replay panel */}
          {(showAgents || showGit || showCosts || showMemory || showTimeline || showContext || showActivity || showArchitect || showTests || showDebate || showDeps || showCritic || showPromptMarket || showTrainer) && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={18} minSize={14} maxSize={30}>
                {showReplay ? (
                  <MissionReplay
                    missionId={activeMissionId}
                    onClose={() => setShowReplay(false)}
                  />
                ) : showCosts ? (
                  <CostDashboard
                    projectId={activeProjectId}
                    sessionId={activeSession?._id}
                  />
                ) : showArchitect ? (
                  <ArchitectureAdvisor projectId={activeProjectId} />
                ) : showTests ? (
                  <TestGenerator projectId={activeProjectId} activeFile={activeFileContent} />
                ) : showDebate ? (
                  <AgentDebatePanel projectId={activeProjectId} missionId={activeMissionId} />
                ) : showDeps ? (
                  <DependencyScanner projectId={activeProjectId} />
                ) : showCritic ? (
                  <CodeCritic projectId={activeProjectId} activeFile={activeFileContent} />
                ) : showPromptMarket ? (
                  <PromptMarketplace onUsePrompt={handleSendPrompt} />
                ) : showTrainer ? (
                  <AgentTrainer projectId={activeProjectId} />
                ) : showContext ? (
                  <ContextWindow
                    projectId={activeProjectId}
                    activeFileId={activeFileId}
                    sessionId={activeSession?._id}
                  />
                ) : showActivity ? (
                  <ActivityLog />
                ) : showMemory && showTimeline ? (
                  <ResizablePanelGroup direction="vertical">
                    <ResizablePanel defaultSize={50}>
                      <MemoryDashboard projectId={activeProjectId} />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={50}>
                      <MissionTimeline
                        projectId={activeProjectId}
                        onReplayMission={handleReplayMission}
                        onViewAgents={handleViewAgents}
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : showMemory ? (
                  <MemoryDashboard projectId={activeProjectId} />
                ) : showTimeline ? (
                  <MissionTimeline
                    projectId={activeProjectId}
                    onReplayMission={handleReplayMission}
                    onViewAgents={handleViewAgents}
                  />
                ) : showAgents && showGit ? (
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

      {/* Settings */}
      <SettingsPanel
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={editorSettings}
        onUpdateSettings={updateSettings}
      />

      {/* Overlays */}
      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
        files={(files || []).map((f) => ({ _id: f._id as string, name: f.name, path: f.path }))}
        onFileSelect={handleFileSelect}
        onToggleChat={() => setShowChat(!showChat)}
        onTogglePreview={() => setShowPreview(!showPreview)}
        onToggleAgents={() => setShowAgents(!showAgents)}
        onToggleGit={() => setShowGit(!showGit)}
        onToggleSuggestions={() => setShowSuggestions(!showSuggestions)}
        onNewProject={handleCreateProject}
        onSendPrompt={handleSendPrompt}
      />
      <KeyboardShortcuts open={showShortcuts} onOpenChange={setShowShortcuts} />
    </div>
  );
}
