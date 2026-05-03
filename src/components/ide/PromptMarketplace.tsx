/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — PROMPT MARKETPLACE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Community prompt templates organized by category:
 * - Pre-built prompts for common tasks
 * - One-click use to send to chat
 * - Star/save favorites
 * - Categories: Frontend, Backend, Mobile, DevOps, AI/ML, etc.
 */
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Search,
  Star,
  Copy,
  Check,
  Play,
  Code,
  Server,
  Smartphone,
  Cloud,
  Brain,
  Database,
  Layout,
  Palette,
  Shield,
  Zap,
  TestTubes,
  GitBranch,
  Globe,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PromptMarketplaceProps {
  onUsePrompt?: (prompt: string) => void;
}

interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  category: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  stars: number;
}

const CATEGORIES = [
  { id: "all", label: "All", icon: Store },
  { id: "frontend", label: "Frontend", icon: Layout },
  { id: "backend", label: "Backend", icon: Server },
  { id: "fullstack", label: "Full-Stack", icon: Globe },
  { id: "mobile", label: "Mobile", icon: Smartphone },
  { id: "ai", label: "AI/ML", icon: Brain },
  { id: "devops", label: "DevOps", icon: Cloud },
  { id: "database", label: "Database", icon: Database },
  { id: "testing", label: "Testing", icon: TestTubes },
  { id: "security", label: "Security", icon: Shield },
  { id: "design", label: "Design", icon: Palette },
];

const PROMPTS: PromptTemplate[] = [
  // Frontend
  {
    id: "react-dashboard",
    title: "SaaS Dashboard",
    prompt: "Build a modern SaaS admin dashboard with:\n- Sidebar navigation (collapsible)\n- Top bar with search, notifications, user avatar\n- Overview cards (revenue, users, orders, conversion rate)\n- Charts section (line chart for revenue, bar chart for signups)\n- Recent activity feed\n- Responsive for mobile. Use a dark theme with accent colors. Include loading skeletons.",
    category: "frontend",
    tags: ["react", "dashboard", "charts", "responsive"],
    difficulty: "intermediate",
    stars: 342,
  },
  {
    id: "landing-page",
    title: "Product Landing Page",
    prompt: "Create a conversion-optimized landing page with:\n- Hero section with gradient background, headline, subhead, CTA button\n- Social proof bar (logos of companies)\n- 3 feature cards with icons\n- Pricing section (3 tiers: Starter, Pro, Enterprise)\n- Testimonials carousel\n- FAQ accordion\n- Footer with links\nUse smooth scroll, subtle animations, and make it look like a $10M startup.",
    category: "frontend",
    tags: ["landing", "marketing", "conversion"],
    difficulty: "beginner",
    stars: 567,
  },
  {
    id: "auth-flow",
    title: "Authentication Flow",
    prompt: "Build a complete authentication system with:\n- Sign up page (name, email, password with strength meter)\n- Login page (email + password, remember me)\n- OAuth buttons (Google, GitHub)\n- Forgot password flow (email → reset link → new password)\n- Email verification page\n- 2FA setup page (TOTP with QR code)\nInclude form validation, loading states, and error handling.",
    category: "fullstack",
    tags: ["auth", "oauth", "security", "forms"],
    difficulty: "advanced",
    stars: 289,
  },
  // Backend
  {
    id: "rest-api",
    title: "REST API with CRUD",
    prompt: "Build a complete REST API for a task management app:\n- Endpoints: GET /tasks, GET /tasks/:id, POST /tasks, PUT /tasks/:id, DELETE /tasks/:id\n- Validation with Zod schemas\n- Pagination, sorting, filtering\n- Authentication middleware (JWT)\n- Rate limiting\n- Error handling with consistent error format\n- API documentation comments\nMake it production-ready.",
    category: "backend",
    tags: ["api", "rest", "crud", "jwt"],
    difficulty: "intermediate",
    stars: 421,
  },
  {
    id: "realtime-chat",
    title: "Real-time Chat Backend",
    prompt: "Build a real-time chat application backend with:\n- WebSocket connections for live messaging\n- Chat rooms / channels\n- Direct messages\n- Message history with pagination\n- Typing indicators\n- Read receipts\n- File/image upload support\n- User presence (online/offline/away)\nUse efficient data structures for message storage.",
    category: "backend",
    tags: ["websocket", "realtime", "chat", "messaging"],
    difficulty: "advanced",
    stars: 198,
  },
  // AI/ML
  {
    id: "ai-chatbot",
    title: "AI Chatbot with RAG",
    prompt: "Build an AI chatbot that answers questions about uploaded documents:\n- Upload PDF/TXT files\n- Split documents into chunks\n- Generate embeddings\n- Store in vector database\n- Query with semantic search\n- Use retrieved context to generate answers\n- Show source citations\n- Streaming responses\n- Chat history persistence",
    category: "ai",
    tags: ["ai", "rag", "embeddings", "chatbot"],
    difficulty: "advanced",
    stars: 456,
  },
  // Mobile
  {
    id: "mobile-app",
    title: "Social Media App UI",
    prompt: "Build a social media mobile app interface with:\n- Feed page with posts (image, text, likes, comments)\n- Stories bar at top\n- Bottom tab navigation (Home, Search, Create, Reels, Profile)\n- Profile page (avatar, bio, stats, photo grid)\n- Post creation (camera, gallery, text, location)\n- Comment thread UI\nOptimize for touch interactions and mobile gestures.",
    category: "mobile",
    tags: ["mobile", "social", "feed", "ui"],
    difficulty: "intermediate",
    stars: 234,
  },
  // Database
  {
    id: "db-schema",
    title: "E-commerce Database",
    prompt: "Design a complete e-commerce database schema with:\n- Users (profiles, addresses, payment methods)\n- Products (categories, variants, inventory, pricing)\n- Orders (cart → checkout → payment → fulfillment)\n- Reviews and ratings\n- Wishlists\n- Coupons and discounts\n- Shipping tracking\nInclude proper indexes, constraints, and relationships. Add seed data for testing.",
    category: "database",
    tags: ["schema", "ecommerce", "sql"],
    difficulty: "intermediate",
    stars: 312,
  },
  // Testing
  {
    id: "test-suite",
    title: "Complete Test Suite",
    prompt: "Write a comprehensive test suite for the current project:\n- Unit tests for all utility functions\n- Component render tests\n- Integration tests for API routes\n- E2E test for critical user flows (signup → login → create → delete)\n- Mock setup for external services\n- Test coverage report configuration\n- CI-friendly test scripts\nUse Vitest + React Testing Library.",
    category: "testing",
    tags: ["vitest", "testing", "e2e", "ci"],
    difficulty: "intermediate",
    stars: 178,
  },
  // DevOps
  {
    id: "docker-setup",
    title: "Docker + CI/CD Pipeline",
    prompt: "Set up a complete deployment pipeline:\n- Multi-stage Dockerfile (build → production)\n- docker-compose.yml (app + database + redis)\n- GitHub Actions CI pipeline (lint → test → build → deploy)\n- Environment variable management\n- Health check endpoint\n- Auto-scaling configuration\n- Monitoring/alerting setup\nMake it work for both development and production.",
    category: "devops",
    tags: ["docker", "ci", "github-actions", "deploy"],
    difficulty: "advanced",
    stars: 389,
  },
  // Design
  {
    id: "design-system",
    title: "Design System Components",
    prompt: "Build a complete design system with:\n- Button (primary, secondary, outline, ghost, destructive + sizes)\n- Input (text, email, password with toggle, textarea, select)\n- Card (default, interactive, stats)\n- Modal / Dialog\n- Toast notifications\n- Tabs\n- Dropdown menu\n- Avatar with status indicator\n- Badge / Tag\n- Progress bar + Skeleton loaders\nUse CSS variables for theming. Support dark/light mode.",
    category: "design",
    tags: ["components", "design-system", "theme", "ui-kit"],
    difficulty: "intermediate",
    stars: 523,
  },
  // Security
  {
    id: "security-audit",
    title: "Security Hardening",
    prompt: "Audit and harden the current project's security:\n- Input sanitization on all user inputs\n- CSRF protection\n- XSS prevention\n- SQL injection prevention\n- Rate limiting on auth endpoints\n- Content Security Policy headers\n- CORS configuration\n- Secrets management (.env + validation)\n- Dependency audit for known vulnerabilities\nGenerate a security report with findings and fixes.",
    category: "security",
    tags: ["security", "audit", "hardening", "owasp"],
    difficulty: "advanced",
    stars: 267,
  },
];

export function PromptMarketplace({ onUsePrompt }: PromptMarketplaceProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = PROMPTS;
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q)) ||
          p.prompt.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.stars - a.stars);
  }, [search, category]);

  const handleCopy = async (prompt: string, id: string) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    toast.success("Prompt copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUse = (prompt: string) => {
    onUsePrompt?.(prompt);
    toast.success("Prompt sent to chat!");
  };

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const diffColor = {
    beginner: "border-emerald-500/20 text-emerald-400",
    intermediate: "border-blue-500/20 text-blue-400",
    advanced: "border-purple-500/20 text-purple-400",
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <Store className="h-4 w-4 text-pink-400" />
        <span className="text-xs font-semibold text-white/70">Prompt Marketplace</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto border-white/10 text-white/40">
          {PROMPTS.length} prompts
        </Badge>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/[0.03]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/15" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts..."
            className="h-7 text-[11px] pl-7 bg-white/[0.02] border-white/5"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/[0.03] scrollbar-thin">
        {CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 flex items-center gap-1 transition-colors",
                category === cat.id
                  ? "bg-white/10 text-white/60"
                  : "bg-white/[0.03] text-white/25 hover:text-white/40"
              )}
            >
              <CatIcon className="h-2.5 w-2.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Prompts */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
        {filtered.map((prompt) => {
          const isExpanded = expanded === prompt.id;
          return (
            <div
              key={prompt.id}
              className="rounded-lg border border-white/[0.05] bg-white/[0.01] overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : prompt.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.015] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white/60">{prompt.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className={cn("text-[8px] px-1 py-0", diffColor[prompt.difficulty])}>
                      {prompt.difficulty}
                    </Badge>
                    <span className="text-[9px] text-white/15 flex items-center gap-0.5">
                      <Star className="h-2 w-2" /> {prompt.stars}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStar(prompt.id); }}
                  className="p-1 hover:bg-white/5 rounded"
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      starred.has(prompt.id) ? "text-yellow-400 fill-yellow-400" : "text-white/10"
                    )}
                  />
                </button>
              </button>

              {isExpanded && (
                <div className="border-t border-white/[0.03] p-3">
                  <pre className="text-[10px] text-white/35 whitespace-pre-wrap leading-relaxed mb-3 font-sans">
                    {prompt.prompt}
                  </pre>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {prompt.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-[8px] px-1.5 py-0 border-white/5 text-white/20"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-6 text-[10px] bg-pink-600 hover:bg-pink-500 gap-1"
                      onClick={() => handleUse(prompt.prompt)}
                    >
                      <Play className="h-3 w-3" /> Use
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-1 border-white/10 text-white/40"
                      onClick={() => handleCopy(prompt.prompt, prompt.id)}
                    >
                      {copiedId === prompt.id ? (
                        <><Check className="h-3 w-3 text-emerald-400" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
