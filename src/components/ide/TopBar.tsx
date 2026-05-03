/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — TOP BAR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Clean navigation bar with:
 *  - Logo + project selector
 *  - Panel toggle buttons
 *  - Command palette, Deploy, Env, Templates, GitHub, Export
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Code2,
  FolderGit2,
  Github,
  Lightbulb,
  MessageSquare,
  Plus,
  LogOut,
  Play,
  Menu,
  GitBranch,
  Activity,
  Sparkles,
  Search,
  DollarSign,
  Rocket,
  Key,
  Command,
  Keyboard,
  Terminal,
  Settings,
  BookOpen,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { GitHubConnectDialog } from "./GitHubConnectDialog";
import { ImportRepoDialog } from "./ImportRepoDialog";
import { ExportButton } from "./ExportButton";
import { TemplateMarketplace } from "./TemplateMarketplace";
import { NotificationCenter } from "./NotificationCenter";
import { CollaborationBar } from "./CollaborationBar";
import { PromptLibrary } from "./PromptLibrary";
import { DeployPanel } from "./DeployPanel";
import { EnvManager } from "./EnvManager";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";


interface TopBarProps {
  projects: Array<{
    _id: Id<"projects">;
    name: string;
    githubRepo?: string;
  }>;
  activeProjectId: Id<"projects"> | null;
  onSelectProject: (id: Id<"projects"> | null) => void;
  activeProject?: {
    name: string;
    githubRepo?: string;
  } | null;
  showChat: boolean;
  onToggleChat: () => void;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  showSuggestions?: boolean;
  onToggleSuggestions?: () => void;
  showAgents?: boolean;
  onToggleAgents?: () => void;
  showGit?: boolean;
  onToggleGit?: () => void;
  showSearch?: boolean;
  onToggleSearch?: () => void;
  showCosts?: boolean;
  onToggleCosts?: () => void;
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
  githubConnected: boolean;
  isMobile?: boolean;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onSendPrompt?: (prompt: string) => void;
}

export function TopBar({
  projects,
  activeProjectId,
  onSelectProject,
  activeProject,
  showChat,
  onToggleChat,
  showPreview,
  onTogglePreview,
  showSuggestions,
  onToggleSuggestions,
  showAgents,
  onToggleAgents,
  showGit,
  onToggleGit,
  showSearch,
  onToggleSearch,
  showCosts,
  onToggleCosts,
  showTerminal,
  onToggleTerminal,
  githubConnected,
  isMobile = false,
  onOpenCommandPalette,
  onOpenSettings,
  onSendPrompt,
}: TopBarProps) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showEnv, setShowEnv] = useState(false);
  const [showPromptLib, setShowPromptLib] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const createProject = useMutation(api.projects.create);
  const { signOut } = useAuthActions();

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const id = await createProject({ name: newProjectName.trim() });
      onSelectProject(id);
      setNewProjectName("");
      setShowNewProject(false);
      toast.success("Project created");
    } catch {
      toast.error("Failed to create project");
    }
  };

  // Toggle button helper
  const ToggleBtn = ({
    active,
    onClick,
    icon: Icon,
    label,
  }: {
    active?: boolean;
    onClick?: () => void;
    icon: typeof Play;
    label: string;
  }) => {
    if (!onClick) return null;
    return (
      <Button
        variant={active ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "h-7 text-xs gap-1.5 transition-colors",
          active
            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
            : "text-white/40 hover:text-white/60 hover:bg-white/5"
        )}
        onClick={onClick}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Button>
    );
  };

  // ─── MOBILE TOPBAR ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#0a0a0f] px-3 py-2 min-h-[44px]">
        <div className="flex items-center gap-1.5">
          <Code2 className="h-5 w-5 text-emerald-400" />
          <span className="font-bold text-sm tracking-tight text-white">CodeForge</span>
        </div>

        <Select
          value={activeProjectId || ""}
          onValueChange={(v) => onSelectProject(v as Id<"projects">)}
        >
          <SelectTrigger className="flex-1 h-8 text-xs min-w-0 border-white/10 bg-white/5 text-white/80">
            <SelectValue placeholder="Project..." />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p._id} value={p._id}>
                <div className="flex items-center gap-1.5">
                  <FolderGit2 className="h-3 w-3" />
                  {p.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-white/40">
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setShowNewProject(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowTemplates(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Templates
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowDeploy(true)}>
              <Rocket className="h-4 w-4 mr-2" /> Deploy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowEnv(true)}>
              <Key className="h-4 w-4 mr-2" /> Environment Variables
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                githubConnected ? setShowImport(true) : setShowGitHub(true)
              }
            >
              <Github className="h-4 w-4 mr-2" />
              {githubConnected ? "Import Repo" : "Connect GitHub"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
            <div className="flex gap-2">
              <Input
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              />
              <Button onClick={handleCreateProject}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>

        <GitHubConnectDialog open={showGitHub} onOpenChange={setShowGitHub} />
        <ImportRepoDialog open={showImport} onOpenChange={setShowImport} activeProjectId={activeProjectId} onSelectProject={onSelectProject} />
        <TemplateMarketplace open={showTemplates} onOpenChange={setShowTemplates} onSelectProject={onSelectProject} />
        <DeployPanel open={showDeploy} onOpenChange={setShowDeploy} projectId={activeProjectId} projectName={activeProject?.name} />
        <EnvManager open={showEnv} onOpenChange={setShowEnv} projectId={activeProjectId} />
      </div>
    );
  }

  // ─── DESKTOP TOPBAR ─────────────────────────────────────────────
  return (
    <div className="flex items-center gap-1.5 border-b border-white/5 bg-[#0a0a0f] px-3 py-1.5 h-11">
      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-2">
        <Code2 className="h-5 w-5 text-emerald-400" />
        <span className="font-bold text-sm tracking-tight text-white">CodeForge</span>
      </div>

      {/* Project selector */}
      <Select
        value={activeProjectId || ""}
        onValueChange={(v) => onSelectProject(v as Id<"projects">)}
      >
        <SelectTrigger className="w-44 h-7 text-xs border-white/10 bg-white/5 text-white/80">
          <SelectValue placeholder="Select project..." />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p._id} value={p._id}>
              <div className="flex items-center gap-1.5">
                <FolderGit2 className="h-3 w-3" />
                {p.name}
                {p.githubRepo && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1 h-4">
                    {p.githubRepo.split("/")[1]}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* New project */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/30 hover:text-white/60">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            />
            <Button onClick={handleCreateProject}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates */}
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-white/40 hover:text-white/60" onClick={() => setShowTemplates(true)}>
        <Sparkles className="h-3.5 w-3.5" /> Templates
      </Button>

      {/* Command Palette trigger */}
      {onOpenCommandPalette && (
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-white/30 hover:text-white/60" onClick={onOpenCommandPalette}>
          <Command className="h-3 w-3" />
          <span className="text-[10px] text-white/20 bg-white/5 px-1 rounded">⌘K</span>
        </Button>
      )}

      <div className="flex-1" />

      {/* GitHub */}
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-white/40 hover:text-white/60"
        onClick={() => (githubConnected ? setShowImport(true) : setShowGitHub(true))}>
        <Github className="h-3.5 w-3.5" />
        {githubConnected ? "Import" : "GitHub"}
      </Button>

      {/* Deploy */}
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-white/40 hover:text-white/60"
        onClick={() => setShowDeploy(true)}>
        <Rocket className="h-3.5 w-3.5" /> Deploy
      </Button>

      {/* Prompt Library */}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/30 hover:text-white/60"
        onClick={() => setShowPromptLib(true)} title="Prompt Library">
        <BookOpen className="h-3.5 w-3.5" />
      </Button>

      {/* Env */}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/30 hover:text-white/60"
        onClick={() => setShowEnv(true)} title="Environment Variables">
        <Key className="h-3.5 w-3.5" />
      </Button>

      {/* Export */}
      <ExportButton
        projectId={activeProjectId}
        projectName={activeProject?.name}
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-white/40 hover:text-white/60"
        showLabel={false}
      />

      {/* Separator */}
      <div className="h-4 w-px bg-white/10 mx-0.5" />

      {/* Panel toggles */}
      <ToggleBtn active={showSearch} onClick={onToggleSearch} icon={Search} label="Search" />
      <ToggleBtn active={showPreview} onClick={onTogglePreview} icon={Play} label="Preview" />
      <ToggleBtn active={showSuggestions} onClick={onToggleSuggestions} icon={Lightbulb} label="Ideas" />
      <ToggleBtn active={showChat} onClick={onToggleChat} icon={MessageSquare} label="AI" />
      <ToggleBtn active={showAgents} onClick={onToggleAgents} icon={Activity} label="Agents" />
      <ToggleBtn active={showGit} onClick={onToggleGit} icon={GitBranch} label="Git" />
      <ToggleBtn active={showCosts} onClick={onToggleCosts} icon={DollarSign} label="Costs" />
      <ToggleBtn active={showTerminal} onClick={onToggleTerminal} icon={Terminal} label="Terminal" />

      {/* Separator */}
      <div className="h-4 w-px bg-white/10 mx-0.5" />

      {/* Collaboration */}
      <CollaborationBar projectId={activeProjectId} projectName={activeProject?.name} />

      {/* Notifications */}
      <NotificationCenter />

      {/* Settings */}
      {onOpenSettings && (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/30 hover:text-white/60" onClick={onOpenSettings}>
          <Settings className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Sign out */}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/30 hover:text-white/60" onClick={() => signOut()}>
        <LogOut className="h-3.5 w-3.5" />
      </Button>

      {/* Dialogs */}
      <GitHubConnectDialog open={showGitHub} onOpenChange={setShowGitHub} />
      <ImportRepoDialog open={showImport} onOpenChange={setShowImport} activeProjectId={activeProjectId} onSelectProject={onSelectProject} />
      <TemplateMarketplace open={showTemplates} onOpenChange={setShowTemplates} onSelectProject={onSelectProject} />
      <DeployPanel open={showDeploy} onOpenChange={setShowDeploy} projectId={activeProjectId} projectName={activeProject?.name} />
      <EnvManager open={showEnv} onOpenChange={setShowEnv} projectId={activeProjectId} />
      <PromptLibrary open={showPromptLib} onOpenChange={setShowPromptLib} onSelectPrompt={(p) => onSendPrompt?.(p)} />
    </div>
  );
}
