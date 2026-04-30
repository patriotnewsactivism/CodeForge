import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  Github,
  MessageSquare,
  DollarSign,
  FileCode,
  ArrowRight,
  Terminal,
  Brain,
} from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Code2 className="h-5 w-5 text-chart-3" />
          <span className="font-bold text-sm">CodeForge</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => navigate("/login")}
          >
            Sign In
          </Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={() => navigate("/signup")}
          >
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-chart-3/5 to-transparent" />
        <div className="relative container mx-auto px-4 pt-12 sm:pt-20 pb-10 sm:pb-16 text-center">
          <Badge variant="secondary" className="mb-4 text-[10px] sm:text-xs">
            Multi-Model AI · GitHub Sync · Cost Tracking
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-3 sm:mb-4 tracking-tight leading-tight">
            Code smarter with{" "}
            <span className="text-chart-3">CodeForge</span>
          </h1>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
            Your AI-powered coding platform. Import GitHub repos, write code
            with intelligent AI assistants, and keep full control of costs.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
            <Button
              size="lg"
              className="gap-2 w-full sm:w-auto"
              onClick={() => navigate("/signup")}
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-10 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
          <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
            <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center mb-3 sm:mb-4">
              <Brain className="h-5 w-5 text-chart-3" />
            </div>
            <h3 className="font-semibold mb-1.5 sm:mb-2">Multi-Model AI</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              DeepSeek V3.2, Grok 4.1 Fast, GPT-5 Mini — switch models
              per-message. Automatic fallback if one fails.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
            <div className="h-10 w-10 rounded-lg bg-chart-1/10 flex items-center justify-center mb-3 sm:mb-4">
              <Github className="h-5 w-5 text-chart-1" />
            </div>
            <h3 className="font-semibold mb-1.5 sm:mb-2">GitHub Integration</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Import any repo, browse the full file tree, edit files, and
              commit changes back to GitHub.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
            <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center mb-3 sm:mb-4">
              <DollarSign className="h-5 w-5 text-chart-2" />
            </div>
            <h3 className="font-semibold mb-1.5 sm:mb-2">Cost Tracking</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Real-time token usage and dollar amounts. Know exactly what
              each AI interaction costs, per session.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
            <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center mb-3 sm:mb-4">
              <FileCode className="h-5 w-5 text-chart-4" />
            </div>
            <h3 className="font-semibold mb-1.5 sm:mb-2">Full IDE Experience</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              File tree explorer, tabbed code editor with syntax
              highlighting, keyboard shortcuts (Ctrl+S to save).
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
            <div className="h-10 w-10 rounded-lg bg-chart-5/10 flex items-center justify-center mb-3 sm:mb-4">
              <MessageSquare className="h-5 w-5 text-chart-5" />
            </div>
            <h3 className="font-semibold mb-1.5 sm:mb-2">Live Preview</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Built-in sandbox previews your HTML/CSS/JS in real-time.
              See what the AI builds instantly.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
              <Terminal className="h-5 w-5 text-foreground" />
            </div>
            <h3 className="font-semibold mb-1.5 sm:mb-2">Your Platform</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Not a wrapper around another tool. A standalone platform
              you own and control, built for your workflow.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-1.5">
          <Code2 className="h-4 w-4 text-chart-3" />
          <span className="font-semibold">CodeForge</span>
          <span>— Built by Don Matthews</span>
        </div>
      </div>
    </div>
  );
}
