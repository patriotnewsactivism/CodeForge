import { Button } from "@/components/ui/button";
import { Code2, FolderGit2, Github, MessageSquare, Zap, Camera, Rocket, RotateCcw, Globe, Brain, Sliders } from "lucide-react";

export function WelcomePanel({
  projectCount,
  onCreateProject,
  onOpenTemplates,
  onOpenScreenshot,
}: {
  projectCount: number;
  onCreateProject: () => void;
  onOpenTemplates?: () => void;
  onOpenScreenshot?: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-[#0a0a0f] p-4 overflow-auto">
      <div className="max-w-lg text-center w-full">
        {/* Logo */}
        <div className="mb-5 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
            <Code2 className="h-14 w-14 text-red-400 relative" />
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-1 text-white">Welcome to CodeForge</h1>
        <p className="text-white/40 text-sm mb-6 px-4">
          AI agent swarm that builds real apps. Describe anything. Watch it happen.
        </p>

        {/* Quick Start Actions */}
        <div className="flex flex-col sm:flex-row gap-2 mb-6 justify-center">
          {onOpenTemplates && (
            <button
              onClick={onOpenTemplates}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 rounded-xl text-sm font-semibold text-amber-400 transition-all"
            >
              <Rocket className="w-4 h-4" /> Start from Template
            </button>
          )}
          {onOpenScreenshot && (
            <button
              onClick={onOpenScreenshot}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/25 rounded-xl text-sm font-semibold text-purple-400 transition-all"
            >
              <Camera className="w-4 h-4" /> Screenshot → Code
            </button>
          )}
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6 text-left">
          {[
            { icon: Github, color: "text-white/60", title: "GitHub Sync", desc: "Import repos, push changes" },
            { icon: MessageSquare, color: "text-emerald-400", title: "Multi-Agent AI", desc: "DeepSeek, Grok, Kimi in parallel" },
            { icon: Brain, color: "text-blue-400", title: "Agent Memory", desc: "Learns your project style" },
            { icon: Globe, color: "text-cyan-400", title: "Share Previews", desc: "Public link in one click" },
            { icon: RotateCcw, color: "text-amber-400", title: "Rollback Timeline", desc: "Revert to any past state" },
            { icon: Sliders, color: "text-pink-400", title: "Personalities", desc: "Scrappy, Enterprise, WTP News" },
          ].map(f => (
            <div key={f.title} className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
              <f.icon className={`h-4 w-4 ${f.color} mb-1.5`} />
              <h3 className="text-xs font-semibold text-white mb-0.5">{f.title}</h3>
              <p className="text-[11px] text-white/30 leading-snug">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="flex items-center justify-center gap-3 text-xs text-white/20 mb-5">
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-white/30">Ctrl+Shift+S</kbd> Screenshot</span>
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-white/30">Ctrl+Shift+T</kbd> Templates</span>
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-white/30">Ctrl+K</kbd> Command</span>
        </div>

        {projectCount === 0 ? (
          <Button onClick={onCreateProject} className="gap-2 w-full sm:w-auto bg-red-600 hover:bg-red-500">
            <FolderGit2 className="h-4 w-4" />
            Create Your First Project
          </Button>
        ) : (
          <p className="text-xs text-white/25">
            {projectCount} project{projectCount !== 1 ? "s" : ""} — select one from the file tree or chat to start coding
          </p>
        )}
      </div>
    </div>
  );
}
