/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — TEMPLATE MARKETPLACE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Browse and start from pre-built templates.
 * Templates are defined in-code and scaffold full projects.
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Layout,
  Gamepad2,
  BookOpen,
  ShoppingCart,
  BarChart3,
  FileCode,
  Globe,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: typeof Layout;
  color: string;
  tags: string[];
  files: Array<{ path: string; content: string; language: string }>;
}

const TEMPLATES: Template[] = [
  {
    id: "landing-page",
    name: "Landing Page",
    description: "Modern, responsive landing page with hero, features, pricing, and CTA sections.",
    icon: Globe,
    color: "text-blue-400",
    tags: ["HTML", "CSS", "Responsive"],
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav class="nav">
    <div class="container">
      <a href="#" class="logo">🚀 MyApp</a>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#" class="btn btn-primary btn-sm">Get Started</a>
      </div>
    </div>
  </nav>
  <section class="hero">
    <div class="container">
      <h1>Build Something<br><span class="gradient-text">Amazing</span></h1>
      <p class="hero-sub">The modern platform for creating beautiful web experiences.</p>
      <div class="hero-cta">
        <a href="#" class="btn btn-primary btn-lg">Start Free</a>
        <a href="#" class="btn btn-outline btn-lg">Learn More</a>
      </div>
    </div>
  </section>
  <section id="features" class="features">
    <div class="container">
      <h2>Features</h2>
      <div class="feature-grid">
        <div class="feature-card"><span class="emoji">⚡</span><h3>Fast</h3><p>Blazing fast performance out of the box.</p></div>
        <div class="feature-card"><span class="emoji">🔒</span><h3>Secure</h3><p>Enterprise-grade security built in.</p></div>
        <div class="feature-card"><span class="emoji">📱</span><h3>Responsive</h3><p>Looks great on every device.</p></div>
      </div>
    </div>
  </section>
  <footer class="footer">
    <div class="container"><p>&copy; 2026 MyApp. All rights reserved.</p></div>
  </footer>
</body>
</html>`,
        language: "html",
      },
      {
        path: "style.css",
        content: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e2e8f0;line-height:1.6}
.container{max-width:1200px;margin:0 auto;padding:0 24px}
.nav{padding:16px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.nav .container{display:flex;justify-content:space-between;align-items:center}
.logo{font-size:20px;font-weight:700;text-decoration:none;color:#fff}
.nav-links{display:flex;gap:24px;align-items:center}
.nav-links a{text-decoration:none;color:rgba(255,255,255,.6);font-size:14px;transition:color .2s}
.nav-links a:hover{color:#fff}
.btn{padding:8px 20px;border-radius:8px;font-weight:600;text-decoration:none;display:inline-block;transition:all .2s;font-size:14px;cursor:pointer;border:none}
.btn-primary{background:linear-gradient(135deg,#10b981,#059669);color:#fff}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(16,185,129,.3)}
.btn-outline{border:1px solid rgba(255,255,255,.15);color:#fff;background:transparent}
.btn-outline:hover{border-color:rgba(255,255,255,.3)}
.btn-sm{padding:6px 16px;font-size:13px}
.btn-lg{padding:12px 32px;font-size:16px}
.hero{padding:120px 0 80px;text-align:center}
h1{font-size:clamp(2.5rem,6vw,4.5rem);font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin-bottom:24px}
.gradient-text{background:linear-gradient(135deg,#10b981,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-sub{font-size:20px;color:rgba(255,255,255,.5);max-width:500px;margin:0 auto 40px}
.hero-cta{display:flex;gap:16px;justify-content:center}
.features{padding:80px 0}
.features h2{text-align:center;font-size:32px;margin-bottom:48px}
.feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}
.feature-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:16px;padding:32px;transition:border-color .2s}
.feature-card:hover{border-color:rgba(16,185,129,.3)}
.emoji{font-size:32px;display:block;margin-bottom:16px}
.feature-card h3{font-size:18px;margin-bottom:8px}
.feature-card p{color:rgba(255,255,255,.5);font-size:14px}
.footer{padding:32px 0;border-top:1px solid rgba(255,255,255,.05);text-align:center;color:rgba(255,255,255,.3);font-size:13px}
@media(max-width:768px){.hero{padding:80px 0 40px}.hero-cta{flex-direction:column;align-items:center}}`,
        language: "css",
      },
    ],
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Admin dashboard with sidebar, stats cards, and chart placeholders.",
    icon: BarChart3,
    color: "text-purple-400",
    tags: ["HTML", "CSS", "Dashboard"],
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Dashboard</title><link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="logo">📊 Dashboard</div>
      <nav><a href="#" class="active">Overview</a><a href="#">Analytics</a><a href="#">Users</a><a href="#">Settings</a></nav>
    </aside>
    <main class="main">
      <header><h1>Overview</h1><span class="date">May 2026</span></header>
      <div class="stats">
        <div class="card"><span class="label">Revenue</span><span class="value">$12,450</span><span class="change up">+12%</span></div>
        <div class="card"><span class="label">Users</span><span class="value">1,234</span><span class="change up">+8%</span></div>
        <div class="card"><span class="label">Orders</span><span class="value">342</span><span class="change down">-3%</span></div>
        <div class="card"><span class="label">Conversion</span><span class="value">3.2%</span><span class="change up">+0.5%</span></div>
      </div>
      <div class="chart-placeholder"><p>📈 Chart goes here</p></div>
    </main>
  </div>
</body>
</html>`,
        language: "html",
      },
      {
        path: "style.css",
        content: `*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#e2e8f0}.app{display:flex;min-height:100vh}.sidebar{width:220px;background:#0d0d14;border-right:1px solid rgba(255,255,255,.05);padding:20px}.logo{font-size:16px;font-weight:700;margin-bottom:32px}nav{display:flex;flex-direction:column;gap:4px}nav a{text-decoration:none;color:rgba(255,255,255,.4);padding:10px 12px;border-radius:8px;font-size:14px;transition:all .2s}nav a:hover{color:#fff;background:rgba(255,255,255,.05)}nav a.active{color:#10b981;background:rgba(16,185,129,.1)}.main{flex:1;padding:24px}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}h1{font-size:24px}.date{color:rgba(255,255,255,.3);font-size:14px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}.card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:20px}.label{display:block;color:rgba(255,255,255,.4);font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}.value{display:block;font-size:28px;font-weight:700;margin-bottom:4px}.change{font-size:13px;font-weight:600}.up{color:#10b981}.down{color:#f87171}.chart-placeholder{background:rgba(255,255,255,.02);border:1px dashed rgba(255,255,255,.1);border-radius:12px;padding:80px;text-align:center;color:rgba(255,255,255,.2)}`,
        language: "css",
      },
    ],
  },
  {
    id: "game",
    name: "Simple Game",
    description: "Canvas-based game starter with game loop, player movement, and score tracking.",
    icon: Gamepad2,
    color: "text-amber-400",
    tags: ["JavaScript", "Canvas", "Game"],
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Game</title>
<style>*{margin:0;padding:0}body{background:#0a0a0f;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;color:#fff}canvas{border:1px solid rgba(255,255,255,.1);border-radius:8px}#score{margin-top:16px;font-size:18px;color:rgba(255,255,255,.6)}#info{margin-top:8px;font-size:13px;color:rgba(255,255,255,.3)}</style>
</head>
<body>
  <canvas id="game" width="600" height="400"></canvas>
  <div id="score">Score: 0</div>
  <div id="info">Arrow keys to move · Collect the green dots</div>
  <script src="game.js"></script>
</body>
</html>`,
        language: "html",
      },
      {
        path: "game.js",
        content: `const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");let score=0,player={x:300,y:200,size:16,speed:4,color:"#10b981"},target={x:0,y:0,size:10,color:"#6ee7b7"};const keys={};function spawnTarget(){target.x=Math.random()*(canvas.width-40)+20;target.y=Math.random()*(canvas.height-40)+20}function update(){if(keys.ArrowUp)player.y-=player.speed;if(keys.ArrowDown)player.y+=player.speed;if(keys.ArrowLeft)player.x-=player.speed;if(keys.ArrowRight)player.x+=player.speed;player.x=Math.max(0,Math.min(canvas.width-player.size,player.x));player.y=Math.max(0,Math.min(canvas.height-player.size,player.y));const dx=player.x-target.x,dy=player.y-target.y;if(Math.sqrt(dx*dx+dy*dy)<player.size+target.size){score++;document.getElementById("score").textContent="Score: "+score;spawnTarget()}}function draw(){ctx.fillStyle="#0a0a0f";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.beginPath();ctx.arc(target.x,target.y,target.size,0,Math.PI*2);ctx.fillStyle=target.color;ctx.fill();ctx.beginPath();ctx.arc(player.x,player.y,player.size,0,Math.PI*2);ctx.fillStyle=player.color;ctx.fill();ctx.fillStyle="rgba(16,185,129,0.15)";ctx.beginPath();ctx.arc(player.x,player.y,player.size+6,0,Math.PI*2);ctx.fill()}function loop(){update();draw();requestAnimationFrame(loop)}document.addEventListener("keydown",e=>{keys[e.key]=true;e.preventDefault()});document.addEventListener("keyup",e=>{keys[e.key]=false});spawnTarget();loop();`,
        language: "javascript",
      },
    ],
  },
  {
    id: "blog",
    name: "Blog",
    description: "Clean blog layout with article cards, reading time, and dark theme.",
    icon: BookOpen,
    color: "text-cyan-400",
    tags: ["HTML", "CSS", "Blog"],
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Blog</title><link rel="stylesheet" href="style.css"></head>
<body>
  <header class="header"><div class="container"><h1>📝 My Blog</h1><p>Thoughts on code, design, and everything in between.</p></div></header>
  <main class="container">
    <article class="post"><span class="tag">Tutorial</span><h2>Getting Started with Web Development</h2><p>Learn the fundamentals of HTML, CSS, and JavaScript in this beginner-friendly guide...</p><div class="meta"><span>May 3, 2026</span><span>·</span><span>5 min read</span></div></article>
    <article class="post"><span class="tag">Opinion</span><h2>Why AI Won't Replace Developers</h2><p>AI is a powerful tool, but here's why human creativity remains essential...</p><div class="meta"><span>May 1, 2026</span><span>·</span><span>8 min read</span></div></article>
    <article class="post"><span class="tag">Guide</span><h2>Building Your First API</h2><p>A step-by-step walkthrough of creating a REST API from scratch...</p><div class="meta"><span>Apr 28, 2026</span><span>·</span><span>12 min read</span></div></article>
  </main>
</body>
</html>`,
        language: "html",
      },
      {
        path: "style.css",
        content: `*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#e2e8f0;line-height:1.7}.container{max-width:720px;margin:0 auto;padding:0 24px}.header{padding:60px 0 40px;border-bottom:1px solid rgba(255,255,255,.05);margin-bottom:40px}.header h1{font-size:32px;margin-bottom:8px}.header p{color:rgba(255,255,255,.4);font-size:16px}.post{padding:32px 0;border-bottom:1px solid rgba(255,255,255,.05)}.tag{display:inline-block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#10b981;background:rgba(16,185,129,.1);padding:4px 10px;border-radius:4px;margin-bottom:12px}.post h2{font-size:24px;margin-bottom:12px;letter-spacing:-0.01em}.post p{color:rgba(255,255,255,.5);font-size:15px;margin-bottom:12px}.meta{display:flex;gap:8px;color:rgba(255,255,255,.25);font-size:13px}`,
        language: "css",
      },
    ],
  },
];

interface TemplateMarketplaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProject: (id: Id<"projects">) => void;
}

export function TemplateMarketplace({
  open,
  onOpenChange,
  onSelectProject,
}: TemplateMarketplaceProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const createProject = useMutation(api.projects.create);
  const createFile = useMutation(api.files.create);

  const handleUseTemplate = useCallback(
    async (template: Template) => {
      setLoadingId(template.id);
      try {
        const projectId = await createProject({ name: template.name });

        // Create all template files
        for (const file of template.files) {
          await createFile({
            projectId,
            name: file.path.split("/").pop() || file.path,
            path: file.path,
            type: "file",
            content: file.content,
            language: file.language,
          });
        }

        onSelectProject(projectId);
        onOpenChange(false);
        toast.success(`Created "${template.name}" from template`);
      } catch (e) {
        toast.error("Failed to create project");
        console.error(e);
      }
      setLoadingId(null);
    },
    [createProject, createFile, onSelectProject, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Template Marketplace
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            const isLoading = loadingId === t.id;

            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] group cursor-pointer"
                )}
                onClick={() => !isLoading && handleUseTemplate(t)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("p-2 rounded-lg bg-white/5", t.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{t.name}</h3>
                    <div className="flex gap-1 mt-0.5">
                      {t.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[8px] h-3.5 px-1"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-white/40 mb-3 leading-relaxed">
                  {t.description}
                </p>
                <Button
                  size="sm"
                  className="w-full h-7 text-xs gap-1"
                  variant="outline"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FileCode className="h-3 w-3" />
                      Use Template
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-white/20 text-center mt-2">
          More templates coming soon! Or ask the AI to build anything from scratch.
        </p>
      </DialogContent>
    </Dialog>
  );
}
