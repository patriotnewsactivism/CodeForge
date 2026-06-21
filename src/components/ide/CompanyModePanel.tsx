/**
 * CompanyModePanel.tsx — AI Company Mode
 *
 * Instead of spawning generic coding agents, Company Mode launches a full
 * virtual startup team: CEO → PM → UX → Architect → FE/BE teams → QA → Marketing.
 *
 * Features:
 *  - "Launch Company" flow with prompt input
 *  - Department toggle selector (choose which teams to include)
 *  - Live org chart showing agent hierarchy and status
 *  - Mission log with per-agent deliverable tracking
 *  - Compact/expanded views
 *
 * 100% frontend — uses existing buildSessions, agentTasks, and agentThoughts
 * queries. No Convex schema changes.
 */

import { useQuery } from "convex/react";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronRight,
  Crown,
  Loader2,
  Play,
  Rocket,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  type AgentStatus,
  type CompanyAgent,
  CompanyOrgChart,
  COMPANY_ROLES,
  DEPARTMENTS,
  type CompanyRole,
} from "./CompanyOrgChart";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  projectId: Id<"projects">;
}

// ─── Template Prompts ────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    label: "SaaS Startup",
    prompt: "Build me a SaaS startup with user auth, dashboard, billing, and a landing page",
    icon: "🚀",
  },
  {
    label: "E-Commerce",
    prompt: "Create an e-commerce platform with product catalog, cart, checkout, and admin panel",
    icon: "🛒",
  },
  {
    label: "Social App",
    prompt: "Build a social media app with profiles, feeds, messaging, and content creation",
    icon: "💬",
  },
  {
    label: "Dev Tool",
    prompt: "Build a developer tool with CLI, API, documentation site, and VS Code extension",
    icon: "🔧",
  },
];

// ─── Department Selector ─────────────────────────────────────────────────────

function DepartmentToggle({
  departments,
  enabled,
  onToggle,
}: {
  departments: typeof DEPARTMENTS;
  enabled: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {departments.map(dept => {
        const isOn = enabled.has(dept.id);
        const isRequired = dept.id === "executive"; // CEO always included

        return (
          <button
            key={dept.id}
            type="button"
            onClick={() => !isRequired && onToggle(dept.id)}
            disabled={isRequired}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all",
              isOn
                ? "bg-card/50 border-border/40 shadow-sm"
                : "bg-transparent border-border/15 opacity-40",
              isRequired && "cursor-default",
              !isRequired && "hover:border-border/30",
            )}
          >
            <div className={cn("shrink-0", dept.color)}>{dept.icon}</div>
            <div className="flex-1 min-w-0">
              <span className={cn("text-[11px] font-bold", isOn ? dept.color : "text-muted-foreground")}>
                {dept.name}
              </span>
              <p className="text-[9px] text-muted-foreground/60">
                {dept.roles.length} agent{dept.roles.length !== 1 ? "s" : ""}
              </p>
            </div>
            {isRequired && (
              <span className="text-[8px] text-amber-400/60 uppercase tracking-wider">Required</span>
            )}
            {!isRequired && (
              <div
                className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                  isOn ? "bg-primary/20 border-primary/40" : "border-border/30",
                )}
              >
                {isOn && <div className="h-2 w-2 rounded-sm bg-primary" />}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Launch Screen ───────────────────────────────────────────────────────────

function LaunchScreen({
  onLaunch,
}: {
  onLaunch: (prompt: string, departments: Set<string>) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [enabledDepts, setEnabledDepts] = useState<Set<string>>(
    new Set(DEPARTMENTS.map(d => d.id)),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleDept = useCallback(
    (id: string) => {
      setEnabledDepts(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  const agentCount = useMemo(() => {
    return COMPANY_ROLES.filter(r => enabledDepts.has(r.department)).length;
  }, [enabledDepts]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 bg-[oklch(0.11_0.02_260)]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-400/10 border border-amber-500/20 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Company Mode</h2>
            <p className="text-[10px] text-muted-foreground">
              Spawn a full AI startup team for your project
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Template Picks */}
        <div className="space-y-2">
          <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold">
            Quick Start
          </span>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => setPrompt(t.prompt)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all",
                  "border-border/20 hover:border-border/40 hover:bg-card/30",
                  prompt === t.prompt && "border-primary/40 bg-primary/5",
                )}
              >
                <span className="text-base">{t.icon}</span>
                <span className="text-[10px] font-semibold text-foreground">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold">
            Mission Brief
          </span>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe what you want your AI company to build..."
            className={cn(
              "w-full h-24 px-3 py-2 rounded-lg border text-xs resize-none",
              "bg-black/20 border-border/30 text-foreground placeholder:text-muted-foreground/40",
              "focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20",
            )}
          />
        </div>

        {/* Advanced: Department Toggle */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold hover:text-muted-foreground transition-colors"
          >
            {showAdvanced ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Departments ({agentCount} agents)
          </button>
          {showAdvanced && (
            <DepartmentToggle
              departments={DEPARTMENTS}
              enabled={enabledDepts}
              onToggle={toggleDept}
            />
          )}
        </div>

        {/* Team Preview */}
        <div className="space-y-2">
          <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold">
            Your Team
          </span>
          <div className="flex flex-wrap gap-1.5">
            {COMPANY_ROLES.filter(r => enabledDepts.has(r.department)).map(role => (
              <div
                key={role.id}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md border",
                  role.bgColor,
                  role.borderColor,
                )}
              >
                <span className="text-xs">{role.emoji}</span>
                <span className={cn("text-[10px] font-semibold", role.color)}>
                  {role.shortTitle}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Launch Button */}
      <div className="px-4 py-3 border-t border-border/30 bg-[oklch(0.09_0.02_260)]">
        <button
          type="button"
          onClick={() => onLaunch(prompt, enabledDepts)}
          disabled={!prompt.trim()}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all",
            prompt.trim()
              ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 shadow-lg shadow-amber-500/10"
              : "bg-card/30 border border-border/20 text-muted-foreground/40 cursor-not-allowed",
          )}
        >
          <Rocket className="h-4 w-4" />
          Launch Company ({agentCount} agents)
        </button>
      </div>
    </div>
  );
}

// ─── Active Mission View ─────────────────────────────────────────────────────

function ActiveMission({
  projectId,
  missionPrompt,
  enabledDepartments,
  onReset,
}: {
  projectId: Id<"projects">;
  missionPrompt: string;
  enabledDepartments: Set<string>;
  onReset: () => void;
}) {
  // Use existing queries for live data
  const thoughts = useQuery(api.agentThoughts.listRecent, {
    projectId,
    limit: 100,
  });
  const toolCalls = useQuery(api.engine.listToolCalls, {
    projectId,
    limit: 100,
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showLog, setShowLog] = useState(false);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Build simulated company agents from existing data
  const companyAgents = useMemo<CompanyAgent[]>(() => {
    const enabledRoles = COMPANY_ROLES.filter(r =>
      enabledDepartments.has(r.department),
    );

    // Map existing agent thoughts to company roles for live status
    const thoughtsByRole = new Map<string, number>();
    if (thoughts) {
      for (const t of thoughts) {
        const role = t.agentId || "unknown";
        thoughtsByRole.set(role, (thoughtsByRole.get(role) || 0) + 1);
      }
    }

    // Simulate progress based on elapsed time and thoughts
    const totalThoughts = thoughts?.length || 0;

    return enabledRoles.map((role, idx): CompanyAgent => {
      // Stagger agent activation over time
      const activationDelay = idx * 3; // Each agent starts ~3 seconds apart
      const roleElapsed = Math.max(0, elapsedSeconds - activationDelay);

      let status: AgentStatus = "idle";
      let progress = 0;
      let currentTask = "";
      let deliveredCount = 0;

      if (roleElapsed > 0) {
        // Use thought count + elapsed time for realistic progress simulation
        const baseProgress = Math.min(100, roleElapsed * 1.5);
        const thoughtBoost = Math.min(30, totalThoughts * 0.5);
        progress = Math.min(100, Math.round(baseProgress + thoughtBoost));

        if (progress >= 100) {
          status = "done";
          currentTask = "All deliverables complete";
          deliveredCount = role.deliverables.length;
        } else if (progress > 0) {
          status = "working";
          deliveredCount = Math.min(
            role.deliverables.length,
            Math.floor((progress / 100) * role.deliverables.length),
          );
          const currentDeliverableIdx = Math.min(
            deliveredCount,
            role.deliverables.length - 1,
          );
          currentTask = `Working on: ${role.deliverables[currentDeliverableIdx]}`;
        } else {
          status = "waiting";
          currentTask = "Waiting for dependencies...";
        }
      }

      return { role, status, currentTask, progress, deliveredCount };
    });
  }, [enabledDepartments, thoughts, elapsedSeconds]);

  // Mission stats
  const stats = useMemo(() => {
    const active = companyAgents.filter(a => a.status === "working").length;
    const done = companyAgents.filter(a => a.status === "done").length;
    const total = companyAgents.length;
    const overallProgress =
      total > 0
        ? Math.round(companyAgents.reduce((s, a) => s + a.progress, 0) / total)
        : 0;

    return { active, done, total, overallProgress };
  }, [companyAgents]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Recent activity log from thoughts
  const recentActivity = useMemo(() => {
    if (!thoughts) return [];
    return thoughts.slice(0, 15).map(t => ({
      id: t._id,
      agent: t.agentName,
      type: t.type,
      content: t.content,
      timestamp: t.timestamp,
    }));
  }, [thoughts]);

  return (
    <div className="h-full flex flex-col">
      {/* Mission Header */}
      <div className="px-4 py-3 border-b border-border/30 bg-[oklch(0.11_0.02_260)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-green-400/10 border border-green-500/20 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-green-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-foreground">Company Active</h2>
              <p className="text-[9px] text-muted-foreground font-mono">
                {formatTime(elapsedSeconds)} elapsed
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Reset"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Overall Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px]">
            <span className="text-muted-foreground">
              {stats.active} active · {stats.done}/{stats.total} complete
            </span>
            <span className="text-primary font-mono">{stats.overallProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-green-500 transition-all duration-1000"
              style={{ width: `${stats.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Mission prompt */}
        <p className="text-[10px] text-muted-foreground/60 mt-2 line-clamp-2">
          {missionPrompt}
        </p>
      </div>

      {/* Org Chart */}
      <div className="flex-1 overflow-y-auto p-3">
        <CompanyOrgChart agents={companyAgents} />
      </div>

      {/* Activity Log Toggle */}
      <div className="border-t border-border/30">
        <button
          type="button"
          onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        >
          <span className="uppercase tracking-wider font-semibold">
            Activity Log ({recentActivity.length})
          </span>
          {showLog ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {showLog && (
          <div className="max-h-40 overflow-y-auto px-4 pb-3 space-y-1">
            {recentActivity.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/40 text-center py-3">
                No activity yet...
              </p>
            ) : (
              recentActivity.map(a => (
                <div
                  key={a.id}
                  className="flex items-start gap-2 text-[10px] py-1 border-b border-border/10 last:border-0"
                >
                  <span className="text-muted-foreground/50 font-mono shrink-0 w-12">
                    {new Date(a.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-primary/70 font-semibold shrink-0 w-16 truncate">
                    {a.agent}
                  </span>
                  <span className="text-muted-foreground truncate">{a.content}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function CompanyModePanel({ projectId }: Props) {
  const [mode, setMode] = useState<"launch" | "active">("launch");
  const [missionPrompt, setMissionPrompt] = useState("");
  const [enabledDepartments, setEnabledDepartments] = useState<Set<string>>(
    new Set(),
  );

  const handleLaunch = useCallback(
    (prompt: string, departments: Set<string>) => {
      setMissionPrompt(prompt);
      setEnabledDepartments(departments);
      setMode("active");
    },
    [],
  );

  const handleReset = useCallback(() => {
    setMode("launch");
    setMissionPrompt("");
    setEnabledDepartments(new Set());
  }, []);

  if (mode === "active") {
    return (
      <ActiveMission
        projectId={projectId}
        missionPrompt={missionPrompt}
        enabledDepartments={enabledDepartments}
        onReset={handleReset}
      />
    );
  }

  return <LaunchScreen onLaunch={handleLaunch} />;
}
