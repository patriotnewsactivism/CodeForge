/**
 * CompanyOrgChart.tsx — Hierarchical org chart for AI Company Mode.
 *
 * Renders the virtual company structure as a tree with the CEO at the top,
 * department leads below, and team members under each lead.
 * Each node shows live status, role icon, and pulsing activity indicator.
 *
 * Reuses the design language from MissionControl (oklch dark theme, agent
 * colors, status dots).  Pure frontend — no Convex schema changes.
 */

import {
  BarChart3,
  Brain,
  ChevronDown,
  ChevronRight,
  Code2,
  Crown,
  Database,
  Layout,
  Megaphone,
  Palette,
  Shield,
  Target,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Role Definitions ────────────────────────────────────────────────────────

export interface CompanyRole {
  id: string;
  title: string;
  shortTitle: string;
  icon: React.ReactNode;
  emoji: string;
  color: string;      // tailwind text-* class
  dotColor: string;    // tailwind bg-* class
  bgColor: string;     // muted background
  borderColor: string; // border accent
  description: string;
  deliverables: string[];
  department: string;
}

export const COMPANY_ROLES: CompanyRole[] = [
  {
    id: "ceo",
    title: "Chief Executive Officer",
    shortTitle: "CEO",
    icon: <Crown className="h-4 w-4" />,
    emoji: "👔",
    color: "text-amber-400",
    dotColor: "bg-amber-400",
    bgColor: "bg-amber-400/8",
    borderColor: "border-amber-500/20",
    description: "Sets vision, strategy, and company direction",
    deliverables: ["Vision doc", "Strategy roadmap", "OKRs"],
    department: "executive",
  },
  {
    id: "product-manager",
    title: "Product Manager",
    shortTitle: "PM",
    icon: <Target className="h-4 w-4" />,
    emoji: "📋",
    color: "text-blue-400",
    dotColor: "bg-blue-400",
    bgColor: "bg-blue-400/8",
    borderColor: "border-blue-500/20",
    description: "Defines requirements, user stories, and priorities",
    deliverables: ["PRD", "User stories", "Acceptance criteria", "Sprint plan"],
    department: "product",
  },
  {
    id: "ux-designer",
    title: "UX Designer",
    shortTitle: "UX",
    icon: <Palette className="h-4 w-4" />,
    emoji: "🎨",
    color: "text-pink-400",
    dotColor: "bg-pink-400",
    bgColor: "bg-pink-400/8",
    borderColor: "border-pink-500/20",
    description: "Creates wireframes, design system, and user flows",
    deliverables: ["Wireframes", "Design specs", "Component library", "User flows"],
    department: "design",
  },
  {
    id: "architect",
    title: "Software Architect",
    shortTitle: "Architect",
    icon: <Brain className="h-4 w-4" />,
    emoji: "🏗️",
    color: "text-violet-400",
    dotColor: "bg-violet-400",
    bgColor: "bg-violet-400/8",
    borderColor: "border-violet-500/20",
    description: "Designs system architecture and makes tech decisions",
    deliverables: ["Architecture diagram", "Tech stack decision", "API design", "Data model"],
    department: "engineering",
  },
  {
    id: "frontend-lead",
    title: "Frontend Lead",
    shortTitle: "FE Lead",
    icon: <Layout className="h-4 w-4" />,
    emoji: "⚛️",
    color: "text-cyan-400",
    dotColor: "bg-cyan-400",
    bgColor: "bg-cyan-400/8",
    borderColor: "border-cyan-500/20",
    description: "Leads React/UI implementation",
    deliverables: ["React components", "UI implementation", "Responsive layout"],
    department: "engineering",
  },
  {
    id: "frontend-dev",
    title: "Frontend Developer",
    shortTitle: "FE Dev",
    icon: <Code2 className="h-4 w-4" />,
    emoji: "💻",
    color: "text-sky-400",
    dotColor: "bg-sky-400",
    bgColor: "bg-sky-400/8",
    borderColor: "border-sky-500/20",
    description: "Builds UI components and interactive features",
    deliverables: ["Feature code", "Styled components", "State management"],
    department: "engineering",
  },
  {
    id: "backend-lead",
    title: "Backend Lead",
    shortTitle: "BE Lead",
    icon: <Database className="h-4 w-4" />,
    emoji: "🔧",
    color: "text-green-400",
    dotColor: "bg-green-400",
    bgColor: "bg-green-400/8",
    borderColor: "border-green-500/20",
    description: "Leads API and database development",
    deliverables: ["API endpoints", "Database schema", "Server logic"],
    department: "engineering",
  },
  {
    id: "backend-dev",
    title: "Backend Developer",
    shortTitle: "BE Dev",
    icon: <Database className="h-4 w-4" />,
    emoji: "⚙️",
    color: "text-emerald-400",
    dotColor: "bg-emerald-400",
    bgColor: "bg-emerald-400/8",
    borderColor: "border-emerald-500/20",
    description: "Implements APIs, data models, and integrations",
    deliverables: ["Mutations/queries", "Business logic", "Integration code"],
    department: "engineering",
  },
  {
    id: "qa-lead",
    title: "QA Lead",
    shortTitle: "QA",
    icon: <Shield className="h-4 w-4" />,
    emoji: "🧪",
    color: "text-orange-400",
    dotColor: "bg-orange-400",
    bgColor: "bg-orange-400/8",
    borderColor: "border-orange-500/20",
    description: "Plans and executes testing and security audits",
    deliverables: ["Test plan", "Test cases", "Security audit", "Bug reports"],
    department: "quality",
  },
  {
    id: "marketing",
    title: "Marketing Agent",
    shortTitle: "Marketing",
    icon: <Megaphone className="h-4 w-4" />,
    emoji: "📣",
    color: "text-rose-400",
    dotColor: "bg-rose-400",
    bgColor: "bg-rose-400/8",
    borderColor: "border-rose-500/20",
    description: "Creates landing page, copy, and social content",
    deliverables: ["Landing page", "Marketing copy", "Social posts", "Launch plan"],
    department: "marketing",
  },
];

// ─── Department Grouping ─────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  roles: CompanyRole[];
}

export const DEPARTMENTS: Department[] = [
  {
    id: "executive",
    name: "Executive",
    icon: <Crown className="h-3.5 w-3.5" />,
    color: "text-amber-400",
    roles: COMPANY_ROLES.filter(r => r.department === "executive"),
  },
  {
    id: "product",
    name: "Product",
    icon: <Target className="h-3.5 w-3.5" />,
    color: "text-blue-400",
    roles: COMPANY_ROLES.filter(r => r.department === "product"),
  },
  {
    id: "design",
    name: "Design",
    icon: <Palette className="h-3.5 w-3.5" />,
    color: "text-pink-400",
    roles: COMPANY_ROLES.filter(r => r.department === "design"),
  },
  {
    id: "engineering",
    name: "Engineering",
    icon: <Code2 className="h-3.5 w-3.5" />,
    color: "text-cyan-400",
    roles: COMPANY_ROLES.filter(r => r.department === "engineering"),
  },
  {
    id: "quality",
    name: "Quality",
    icon: <Shield className="h-3.5 w-3.5" />,
    color: "text-orange-400",
    roles: COMPANY_ROLES.filter(r => r.department === "quality"),
  },
  {
    id: "marketing",
    name: "Marketing",
    icon: <Megaphone className="h-3.5 w-3.5" />,
    color: "text-rose-400",
    roles: COMPANY_ROLES.filter(r => r.department === "marketing"),
  },
];

// ─── Simulated Status (frontend-only, derived from existing data) ────────────

export type AgentStatus = "idle" | "working" | "done" | "error" | "waiting";

export interface CompanyAgent {
  role: CompanyRole;
  status: AgentStatus;
  currentTask: string;
  progress: number; // 0-100
  deliveredCount: number;
}

// ─── OrgChart Node Component ─────────────────────────────────────────────────

function OrgNode({
  agent,
  isCompact,
}: {
  agent: CompanyAgent;
  isCompact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { role, status, currentTask, progress, deliveredCount } = agent;

  const statusConfig: Record<AgentStatus, { dot: string; label: string; pulse?: boolean }> = {
    idle: { dot: "bg-zinc-500", label: "Idle" },
    waiting: { dot: "bg-yellow-400", label: "Waiting", pulse: true },
    working: { dot: "bg-green-400", label: "Active", pulse: true },
    done: { dot: "bg-emerald-400", label: "Done" },
    error: { dot: "bg-red-400", label: "Error" },
  };

  const s = statusConfig[status];

  if (isCompact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-all",
          role.bgColor,
          role.borderColor,
          status === "working" && "ring-1 ring-green-500/30",
        )}
      >
        <div className="relative shrink-0">
          <span className="text-sm">{role.emoji}</span>
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-black/50",
              s.dot,
              s.pulse && "animate-pulse",
            )}
          />
        </div>
        <span className={cn("text-[10px] font-semibold truncate", role.color)}>
          {role.shortTitle}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        role.bgColor,
        role.borderColor,
        status === "working" && "ring-1 ring-green-500/30 shadow-lg shadow-green-500/5",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className="relative shrink-0">
          <div
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center text-lg",
              "bg-black/20 border",
              role.borderColor,
            )}
          >
            {role.emoji}
          </div>
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[oklch(0.13_0.02_260)]",
              s.dot,
              s.pulse && "animate-pulse",
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-bold", role.color)}>
              {role.shortTitle}
            </span>
            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
              {s.label}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {currentTask || role.description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {deliveredCount > 0 && (
            <span className="text-[9px] text-emerald-400 font-mono">
              {deliveredCount}/{role.deliverables.length}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/20 pt-2 space-y-2">
          <p className="text-[10px] text-muted-foreground">{role.description}</p>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px]">
              <span className="text-muted-foreground">Progress</span>
              <span className={role.color}>{progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-black/30 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", role.dotColor)}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Deliverables */}
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">
              Deliverables
            </span>
            <div className="flex flex-wrap gap-1">
              {role.deliverables.map((d, i) => (
                <span
                  key={d}
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded border",
                    i < deliveredCount
                      ? "bg-emerald-400/10 border-emerald-500/20 text-emerald-400"
                      : "bg-black/20 border-border/20 text-muted-foreground/50",
                  )}
                >
                  {i < deliveredCount ? "✓" : "○"} {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OrgChart Component ──────────────────────────────────────────────────────

interface OrgChartProps {
  agents: CompanyAgent[];
  compact?: boolean;
}

export function CompanyOrgChart({ agents, compact }: OrgChartProps) {
  const ceo = agents.find(a => a.role.id === "ceo");
  const departments = useMemo(() => {
    return DEPARTMENTS.filter(d => d.id !== "executive").map(dept => ({
      ...dept,
      agents: agents.filter(a => a.role.department === dept.id),
    }));
  }, [agents]);

  const activeDepts = departments.filter(d => d.agents.length > 0);

  if (compact) {
    return (
      <div className="space-y-2">
        {/* CEO at top */}
        {ceo && <OrgNode agent={ceo} isCompact />}

        {/* Departments in grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {activeDepts.map(dept =>
            dept.agents.map(a => (
              <OrgNode key={a.role.id} agent={a} isCompact />
            )),
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* CEO Card */}
      {ceo && (
        <div className="relative">
          <OrgNode agent={ceo} />
          {/* Connector line down */}
          {activeDepts.length > 0 && (
            <div className="absolute left-1/2 -bottom-3 w-px h-3 bg-border/30" />
          )}
        </div>
      )}

      {/* Departments */}
      {activeDepts.map(dept => (
        <div key={dept.id} className="space-y-1.5">
          <div className="flex items-center gap-2 px-1">
            <div className={cn("shrink-0", dept.color)}>{dept.icon}</div>
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", dept.color)}>
              {dept.name}
            </span>
            <div className="flex-1 h-px bg-border/20" />
            <span className="text-[9px] text-muted-foreground/50">
              {dept.agents.filter(a => a.status === "done").length}/{dept.agents.length}
            </span>
          </div>
          <div className="space-y-1.5 pl-2 border-l border-border/15 ml-2">
            {dept.agents.map(a => (
              <OrgNode key={a.role.id} agent={a} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
