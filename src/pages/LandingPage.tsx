/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — LANDING PAGE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Stunning, high-conversion landing page.
 * Dark theme, animated, shows the platform's power.
 */
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Brain,
  Zap,
  GitBranch,
  Terminal,
  Eye,
  ShieldCheck,
  Mic,
  Layers,
  Search,
  Keyboard,
  Rocket,
  Users,
  BarChart3,
  BookOpen,
  Palette,
  Upload,
  Code2,
  ChevronRight,
  Star,
  Check,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "Autonomous AI Agents",
    description:
      "Exponential agent swarm. Orchestrator decomposes tasks, spawns specialist coders that work in parallel. Watch it all happen live.",
    color: "from-emerald-500 to-cyan-500",
  },
  {
    icon: Eye,
    title: "Live Preview",
    description:
      "See your code rendered in real-time. Sandboxed iframe with viewport switching, hot reload, and error capture that auto-fixes bugs.",
    color: "from-blue-500 to-purple-500",
  },
  {
    icon: Terminal,
    title: "Full IDE Experience",
    description:
      "Monaco Editor (same engine as VS Code), 30+ languages, minimap, diff view, multi-cursor, bracket matching, themes.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: GitBranch,
    title: "GitHub Two-Way Sync",
    description:
      "Push all files to GitHub with one click. Pull from any repo. Import entire projects. Full commit history.",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Mic,
    title: "Voice-to-Code",
    description:
      "Just speak. Web Speech API converts your voice instructions into code. Dictate features, describe bugs, talk to your AI team.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: ShieldCheck,
    title: "AI Code Review",
    description:
      "One-click code review for bugs, security vulnerabilities, and performance issues. Fix with AI button for instant remediation.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Search,
    title: "Workspace Search",
    description:
      "Search across all project files instantly. Regex support, case sensitivity, match highlighting with file expansion.",
    color: "from-cyan-500 to-blue-500",
  },
  {
    icon: Keyboard,
    title: "Command Palette",
    description:
      "Ctrl+K opens everything. File search, panel toggles, AI actions (review, optimize, a11y, tests, docs, refactor).",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: Rocket,
    title: "One-Click Deploy",
    description:
      "Deploy to instant preview, GitHub Pages, or download as ZIP. Share link generation. Your code goes live in seconds.",
    color: "from-emerald-500 to-green-500",
  },
  {
    icon: Layers,
    title: "Template Marketplace",
    description:
      "Landing pages, dashboards, games, blogs — start from curated templates or build from scratch. One-click scaffolding.",
    color: "from-indigo-500 to-blue-500",
  },
  {
    icon: BarChart3,
    title: "Cost Dashboard",
    description:
      "Track spending by model, view token counts, monitor API calls. Full transparency on what your AI agents cost.",
    color: "from-teal-500 to-emerald-500",
  },
  {
    icon: BookOpen,
    title: "Prompt Library",
    description:
      "12 curated AI prompt templates plus save your own. Code review, optimization, a11y audit, test generation, and more.",
    color: "from-rose-500 to-pink-500",
  },
];

const STATS = [
  { value: "36", label: "IDE Components" },
  { value: "3", label: "AI Models" },
  { value: "30+", label: "Languages" },
  { value: "∞", label: "Agent Spawning" },
];

const COMPARED_TO = [
  { name: "Replit", has: ["Editor", "Preview"], missing: ["Agent Swarm", "Voice Input", "AI Review", "Prompt Library"] },
  { name: "Cursor", has: ["AI Autocomplete", "Editor"], missing: ["Live Preview", "Agent Swarm", "Deploy", "Cost Dashboard"] },
  { name: "Lovable", has: ["AI Generation"], missing: ["Monaco Editor", "Git Sync", "Voice", "Agent Autonomy", "Terminal"] },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [visibleFeatures, setVisibleFeatures] = useState(new Set<number>());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-index"));
            setVisibleFeatures((prev) => new Set([...prev, idx]));
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll("[data-feature]").forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#06060a] text-white overflow-x-hidden">
      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#06060a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
              <Code2 className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="font-bold text-sm">
              Code<span className="text-emerald-400">Forge</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-white/50 hover:text-white/80"
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
            <Button
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-500 gap-1.5"
              onClick={() => navigate("/signup")}
            >
              Get Started <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-28 overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px]" />

        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(16,185,129,0.4) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(16,185,129,0.4) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <Badge className="mb-6 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] sm:text-xs px-3 py-1">
            ✨ Autonomous AI Agents · Live Preview · Voice Input · 36 Components
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Build anything with{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              autonomous AI
            </span>
          </h1>

          <p className="text-base sm:text-lg text-white/40 max-w-2xl mx-auto mb-10 leading-relaxed">
            CodeForge spawns an exponential swarm of AI coding agents that work
            in parallel — decomposing complex tasks, writing code, reviewing
            each other's work, and deploying. Watch it all happen live.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 px-8 h-12 text-sm w-full sm:w-auto"
              onClick={() => navigate("/signup")}
            >
              Start Building Free <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/10 text-white/60 hover:text-white hover:bg-white/5 gap-2 h-12 text-sm w-full sm:w-auto"
              onClick={() => navigate("/login")}
            >
              <GitBranch className="h-4 w-4" /> Sign In
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 max-w-xl mx-auto">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white/90">
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-xs text-white/20 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DEMO SCREENSHOT ─── */}
      <section className="relative pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="relative rounded-xl border border-white/10 bg-[#0a0a0f] overflow-hidden shadow-2xl shadow-emerald-500/5">
            {/* Fake window chrome */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0d0d14] border-b border-white/5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400/40" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/40" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400/40" />
              <span className="ml-3 text-[10px] text-white/15">
                code.donmatthews.live
              </span>
            </div>
            {/* IDE mockup */}
            <div className="flex h-80 sm:h-96">
              {/* Sidebar */}
              <div className="w-36 sm:w-48 border-r border-white/5 p-3 space-y-1.5">
                <div className="text-[9px] text-white/15 uppercase tracking-wider font-semibold mb-2">
                  Files
                </div>
                {["src/", "├── App.tsx", "├── index.css", "├── main.tsx", "components/", "├── Hero.tsx", "├── Nav.tsx", "└── Footer.tsx"].map(
                  (f, i) => (
                    <div
                      key={i}
                      className={`text-[10px] py-0.5 px-1.5 rounded ${i === 1 ? "bg-emerald-500/10 text-emerald-400/80" : "text-white/20"}`}
                    >
                      {f}
                    </div>
                  )
                )}
              </div>
              {/* Editor */}
              <div className="flex-1 p-4 font-mono text-[10px] sm:text-[11px] leading-relaxed space-y-0.5">
                <div>
                  <span className="text-purple-400/60">import</span>{" "}
                  <span className="text-white/40">{"{"}</span>{" "}
                  <span className="text-cyan-400/60">useState</span>{" "}
                  <span className="text-white/40">{"}"}</span>{" "}
                  <span className="text-purple-400/60">from</span>{" "}
                  <span className="text-emerald-400/60">'react'</span>
                </div>
                <div className="text-white/10">{"// "}</div>
                <div>
                  <span className="text-purple-400/60">export function</span>{" "}
                  <span className="text-yellow-400/60">Hero</span>
                  <span className="text-white/40">() {"{"}</span>
                </div>
                <div className="pl-4">
                  <span className="text-purple-400/60">const</span>{" "}
                  <span className="text-white/40">[</span>
                  <span className="text-cyan-400/60">count</span>
                  <span className="text-white/40">,</span>{" "}
                  <span className="text-cyan-400/60">setCount</span>
                  <span className="text-white/40">] =</span>{" "}
                  <span className="text-yellow-400/60">useState</span>
                  <span className="text-white/40">(</span>
                  <span className="text-orange-400/60">0</span>
                  <span className="text-white/40">)</span>
                </div>
                <div className="text-white/10">{"  // ..."}</div>
                <div className="pl-4">
                  <span className="text-purple-400/60">return</span>{" "}
                  <span className="text-white/40">(</span>
                </div>
                <div className="pl-8">
                  <span className="text-white/20">{"<"}</span>
                  <span className="text-red-400/50">div</span>{" "}
                  <span className="text-cyan-400/40">className</span>
                  <span className="text-white/20">=</span>
                  <span className="text-emerald-400/60">"hero"</span>
                  <span className="text-white/20">{">"}</span>
                </div>
                {/* Blinking cursor */}
                <div className="pl-12 flex items-center">
                  <span className="text-white/10">{"// AI typing..."}</span>
                  <span className="inline-block w-1.5 h-3.5 bg-emerald-400/60 ml-1 animate-pulse" />
                </div>
              </div>
              {/* Chat */}
              <div className="w-48 sm:w-56 border-l border-white/5 p-3 hidden sm:block">
                <div className="text-[9px] text-white/15 uppercase tracking-wider font-semibold mb-3">
                  AI Chat
                </div>
                <div className="space-y-2">
                  <div className="bg-white/5 rounded-lg p-2 text-[10px] text-white/30">
                    Build me a landing page with a hero section, features grid, and pricing table
                  </div>
                  <div className="bg-emerald-500/10 rounded-lg p-2 text-[10px] text-emerald-400/60">
                    🤖 Launching mission with 3 agents...
                    <br />
                    <span className="text-[9px] text-emerald-400/30">
                      ✓ orchestrator → 2 coders spawned
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-white/5 text-white/40 border-white/10 text-xs">
              Everything You Need
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              More features than{" "}
              <span className="text-emerald-400">any competitor</span>
            </h2>
            <p className="text-sm text-white/30 max-w-lg mx-auto">
              36 purpose-built IDE components. Every feature you'd expect from
              Cursor, Replit, and Lovable — plus dozens they don't have.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature, idx) => {
              const Icon = feature.icon;
              const isVisible = visibleFeatures.has(idx);

              return (
                <div
                  key={idx}
                  data-feature
                  data-index={idx}
                  className={`group relative p-5 rounded-xl border border-white/5 hover:border-white/10 bg-white/[0.01] hover:bg-white/[0.02] transition-all duration-700 ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: `${(idx % 3) * 100}ms` }}
                >
                  <div
                    className={`h-9 w-9 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 opacity-80 group-hover:opacity-100 transition-opacity`}
                  >
                    <Icon className="h-4.5 w-4.5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white/80 mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-[11px] text-white/25 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── VS COMPETITORS ─── */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Why CodeForge beats the competition
          </h2>
          <p className="text-sm text-white/30 mb-12 max-w-lg mx-auto">
            Side-by-side comparison with leading AI coding platforms.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {COMPARED_TO.map((comp) => (
              <div
                key={comp.name}
                className="border border-white/5 rounded-xl p-5 text-left"
              >
                <h3 className="text-sm font-semibold text-white/60 mb-3">
                  vs {comp.name}
                </h3>
                <div className="space-y-1.5 mb-3">
                  {comp.has.map((h) => (
                    <div
                      key={h}
                      className="flex items-center gap-2 text-[11px] text-white/25"
                    >
                      <Check className="h-3 w-3 text-white/15" />
                      <span>{h}</span>
                      <span className="text-[9px] text-white/10 ml-auto">
                        both
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/5 pt-2 space-y-1.5">
                  <div className="text-[9px] text-emerald-400/40 font-semibold uppercase tracking-wider mb-1">
                    CodeForge Only
                  </div>
                  {comp.missing.map((m) => (
                    <div
                      key={m}
                      className="flex items-center gap-2 text-[11px] text-emerald-400/50"
                    >
                      <Star className="h-3 w-3" />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-sm text-white/30 mb-12 max-w-lg mx-auto">
            Start free. Upgrade when you need more AI power. Every plan has built-in cost protection.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Free", price: "$0", period: "forever", features: ["25 AI requests/day", "3 missions/day", "2 agents", "3 projects"], accent: "border-white/10" },
              { name: "Weekly", price: "$9.99", period: "/week", features: ["200 AI requests/day", "20 missions/day", "5 agents", "10 projects"], accent: "border-blue-500/20" },
              { name: "Monthly", price: "$29.99", period: "/month", features: ["500 AI requests/day", "50 missions/day", "10 agents", "25 projects"], accent: "border-purple-500/30", popular: true },
              { name: "Lifetime", price: "$299.99", period: "one-time", features: ["1,000 AI requests/day", "100 missions/day", "20 agents", "All future features"], accent: "border-amber-500/20", badge: "FOUNDER" },
            ].map((plan) => (
              <div key={plan.name} className={`relative rounded-xl border ${plan.accent} bg-white/[0.01] p-5 text-left`}>
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                {plan.badge && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full">
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-sm font-bold text-white/60 mb-1">{plan.name}</h3>
                <div className="mb-3">
                  <span className="text-xl font-extrabold text-white/80">{plan.price}</span>
                  <span className="text-xs text-white/20 ml-1">{plan.period}</span>
                </div>
                <div className="space-y-1.5">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-[11px] text-white/25">
                      <Check className="h-3 w-3 text-emerald-400/40" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            className="mt-8 text-xs border-white/10 text-white/30 hover:text-white/50"
            onClick={() => navigate("/pricing")}
          >
            See full comparison →
          </Button>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="relative rounded-2xl border border-emerald-500/10 bg-gradient-to-b from-emerald-500/5 to-transparent p-10 sm:p-16">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full bg-emerald-500/10 blur-[50px]" />

            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4">
              Ready to build the future?
            </h2>
            <p className="text-sm text-white/30 mb-8 max-w-md mx-auto">
              Join CodeForge and let autonomous AI agents build your vision.
              Free to start. No credit card required.
            </p>
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 px-10 h-12"
              onClick={() => navigate("/signup")}
            >
              Start Building Now <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-emerald-400/40" />
            <span className="text-xs text-white/20">
              CodeForge — Autonomous AI Coding Platform
            </span>
          </div>
          <div className="text-[10px] text-white/10">
            Built by Patriot News Activism · {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
