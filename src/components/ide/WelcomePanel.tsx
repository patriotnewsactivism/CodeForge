import { Button } from "@/components/ui/button";
import { Code2, FolderGit2, Github, MessageSquare, Zap } from "lucide-react";

export function WelcomePanel({
  projectCount,
  onCreateProject,
}: {
  projectCount: number;
  onCreateProject: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-background p-4 overflow-auto">
      <div className="max-w-md text-center w-full">
        <div className="mb-4 sm:mb-6 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-chart-3/20 blur-2xl rounded-full" />
            <Code2 className="h-12 w-12 sm:h-16 sm:w-16 text-chart-3 relative" />
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold mb-2">Welcome to CodeForge</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mb-6 sm:mb-8 px-2">
          Your AI-powered coding platform. Import repos from GitHub, edit code
          with an intelligent assistant, and track your costs.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8 text-left">
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <Github className="h-5 w-5 text-chart-1 mb-1.5" />
            <h3 className="text-xs font-semibold mb-0.5">GitHub Sync</h3>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Import repos, browse files, commit changes back
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <MessageSquare className="h-5 w-5 text-chart-3 mb-1.5" />
            <h3 className="text-xs font-semibold mb-0.5">AI Coding</h3>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Multi-model AI: DeepSeek, Grok, GPT-5 Mini
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <FolderGit2 className="h-5 w-5 text-chart-2 mb-1.5" />
            <h3 className="text-xs font-semibold mb-0.5">File Management</h3>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Full file tree, create, edit, rename, delete
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <Zap className="h-5 w-5 text-chart-5 mb-1.5" />
            <h3 className="text-xs font-semibold mb-0.5">Cost Tracking</h3>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Real-time token usage and $ spent per session
            </p>
          </div>
        </div>

        {projectCount === 0 && (
          <Button onClick={onCreateProject} className="gap-2 w-full sm:w-auto">
            <FolderGit2 className="h-4 w-4" />
            Create Your First Project
          </Button>
        )}
        {projectCount > 0 && (
          <p className="text-xs text-muted-foreground">
            ← Select a file from the tree to start editing
          </p>
        )}
      </div>
    </div>
  );
}
