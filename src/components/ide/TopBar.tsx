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
import {
  Brain,
  Code2,
  Hammer,
  FolderGit2,
  Github,
  Lightbulb,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  LogOut,
  Play,
  Menu,
  Radio,
  Search,
  GitBranch,
  Rocket,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { GitHubConnectDialog } from "./GitHubConnectDialog";
import { ImportRepoDialog } from "./ImportRepoDialog";
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
  showMemory?: boolean;
  onToggleMemory?: () => void;
  showRetro?: boolean;
  onToggleRetro?: () => void;
  showArchitect?: boolean;
  onToggleArchitect?: () => void;
  showStream?: boolean;
  onToggleStream?: () => void;
  showSearch?: boolean;
  onToggleSearch?: () => void;
  showGit?: boolean;
  onToggleGit?: () => void;
  showDeploy?: boolean;
  onToggleDeploy?: () => void;
  githubConnected: boolean;
  isMobile?: boolean;
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
  showMemory,
  onToggleMemory,
  showRetro,
  onToggleRetro,
  showArchitect,
  onToggleArchitect,
  showStream,
  onToggleStream,
  showSearch,
  onToggleSearch,
  showGit,
  onToggleGit,
  showDeploy,
  onToggleDeploy,
  githubConnected,
  isMobile = false,
}: TopBarProps) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showImport, setShowImport] = useState(false);
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

  // ─── MOBILE TOPBAR ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 min-h-[44px]">
        {/* Logo */}
        <div className="flex items-center gap-1.5">
          <Code2 className="h-5 w-5 text-chart-3" />
          <span className="font-bold text-sm tracking-tight">CodeForge</span>
        </div>

        {/* Project selector — compact */}
        <Select
          value={activeProjectId || ""}
          onValueChange={(v) => onSelectProject(v as Id<"projects">)}
        >
          <SelectTrigger className="flex-1 h-8 text-xs min-w-0">
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

        {/* Hamburger menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setShowNewProject(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                githubConnected ? setShowImport(true) : setShowGitHub(true)
              }
            >
              <Github className="h-4 w-4 mr-2" />
              {githubConnected ? "Import Repo" : "Connect GitHub"}
            </DropdownMenuItem>
            {githubConnected && (
              <DropdownMenuItem onClick={() => setShowGitHub(true)}>
                <Settings className="h-4 w-4 mr-2" />
                GitHub Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dialogs */}
        <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
            </DialogHeader>
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
        <ImportRepoDialog
          open={showImport}
          onOpenChange={setShowImport}
          activeProjectId={activeProjectId}
          onSelectProject={onSelectProject}
        />
      </div>
    );
  }

  // ─── DESKTOP TOPBAR ─────────────────────────────────────────────
  return (
    <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-1.5 h-11">
      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-2">
        <Code2 className="h-5 w-5 text-chart-3" />
        <span className="font-bold text-sm tracking-tight">CodeForge</span>
      </div>

      {/* Project selector */}
      <Select
        value={activeProjectId || ""}
        onValueChange={(v) => onSelectProject(v as Id<"projects">)}
      >
        <SelectTrigger className="w-48 h-7 text-xs">
          <SelectValue placeholder="Select project..." />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p._id} value={p._id}>
              <div className="flex items-center gap-1.5">
                <FolderGit2 className="h-3 w-3" />
                {p.name}
                {p.githubRepo && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] py-0 px-1 h-4"
                  >
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
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
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

      <div className="flex-1" />

      {/* GitHub status */}
      <Button
        variant={githubConnected ? "ghost" : "outline"}
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() =>
          githubConnected ? setShowImport(true) : setShowGitHub(true)
        }
      >
        <Github className="h-3.5 w-3.5" />
        {githubConnected ? "Import Repo" : "Connect GitHub"}
      </Button>

      {!githubConnected && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowGitHub(true)}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      )}

      {githubConnected && activeProject?.githubRepo && (
        <Badge variant="outline" className="text-[10px] h-5">
          <Github className="h-2.5 w-2.5 mr-1" />
          {activeProject.githubRepo}
        </Badge>
      )}

      {/* Preview toggle */}
      {onTogglePreview && (
        <Button
          variant={showPreview ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onTogglePreview}
        >
          <Play className="h-3.5 w-3.5" />
          Preview
        </Button>
      )}

      {/* Suggestions toggle */}
      {onToggleSuggestions && (
        <Button
          variant={showSuggestions ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleSuggestions}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          Ideas
        </Button>
      )}

      {/* Architect toggle */}
      {onToggleArchitect && (
        <Button
          variant={showArchitect ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleArchitect}
        >
          <Hammer className="h-3.5 w-3.5" />
          Spec
        </Button>
      )}

      {/* Memory toggle */}
      {onToggleMemory && (
        <Button
          variant={showMemory ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleMemory}
        >
          <Brain className="h-3.5 w-3.5" />
          Brain
        </Button>
      )}

      {/* Retro toggle */}
      {onToggleRetro && (
        <Button
          variant={showRetro ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleRetro}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Learn
        </Button>
      )}

      {/* Stream toggle */}
      {onToggleStream && (
        <Button
          variant={showStream ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleStream}
        >
          <Radio className="h-3.5 w-3.5" />
          Live
        </Button>
      )}

      {/* Search toggle */}
      {onToggleSearch && (
        <Button
          variant={showSearch ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleSearch}
        >
          <Search className="h-3.5 w-3.5" />
          Code
        </Button>
      )}

      {/* Git toggle */}
      {onToggleGit && (
        <Button
          variant={showGit ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleGit}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Git
        </Button>
      )}

      {/* Deploy toggle */}
      {onToggleDeploy && (
        <Button
          variant={showDeploy ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleDeploy}
        >
          <Rocket className="h-3.5 w-3.5" />
          Ship
        </Button>
      )}

      {/* Chat toggle */}
      <Button
        variant={showChat ? "secondary" : "ghost"}
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={onToggleChat}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        AI
      </Button>

      {/* Sign out */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => signOut()}
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>

      {/* Dialogs */}
      <GitHubConnectDialog open={showGitHub} onOpenChange={setShowGitHub} />
      <ImportRepoDialog
        open={showImport}
        onOpenChange={setShowImport}
        activeProjectId={activeProjectId}
        onSelectProject={onSelectProject}
      />
    </div>
  );
}
