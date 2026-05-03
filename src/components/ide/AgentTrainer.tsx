/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — AGENT SPECIALIZATION TRAINER
 * ═══════════════════════════════════════════════════════════════════
 *
 * Train and customize your coding agents:
 * - Set role preferences (coding style, framework expertise)
 * - Give thumbs up/down on past agent outputs
 * - Adjust temperature, creativity, verbosity
 * - Choose model assignments per role
 * - View agent performance stats
 */
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Crown,
  Code,
  Wrench,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Sliders,
  Brain,
  Zap,
  Target,
  Award,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AgentTrainerProps {
  projectId: Id<"projects"> | null;
}

interface AgentConfig {
  role: "orchestrator" | "coder" | "worker";
  label: string;
  icon: typeof Crown;
  color: string;
  avatar: string;
  model: string;
  temperature: number;
  maxTokens: number;
  specialties: string[];
  instructions: string;
  stats: {
    tasksCompleted: number;
    avgScore: number;
    avgTime: string;
  };
}

const DEFAULT_CONFIGS: AgentConfig[] = [
  {
    role: "orchestrator",
    label: "Orchestrator",
    icon: Crown,
    color: "text-purple-400",
    avatar: "🧠",
    model: "grok-4.1-fast-reasoning",
    temperature: 0.3,
    maxTokens: 4096,
    specialties: ["Architecture", "Planning", "Task Decomposition"],
    instructions: "Break complex tasks into clear, sequential steps. Always consider edge cases. Prefer tested patterns over novel approaches.",
    stats: { tasksCompleted: 0, avgScore: 0, avgTime: "—" },
  },
  {
    role: "coder",
    label: "Coder",
    icon: Code,
    color: "text-blue-400",
    avatar: "💻",
    model: "deepseek-v3.2",
    temperature: 0.2,
    maxTokens: 8192,
    specialties: ["TypeScript", "React", "API Design"],
    instructions: "Write clean, typed, well-documented code. Prefer composition over inheritance. Use modern patterns (hooks, async/await). Always handle errors.",
    stats: { tasksCompleted: 0, avgScore: 0, avgTime: "—" },
  },
  {
    role: "worker",
    label: "Worker",
    icon: Wrench,
    color: "text-amber-400",
    avatar: "⚙️",
    model: "kimi-2.6",
    temperature: 0.1,
    maxTokens: 4096,
    specialties: ["Testing", "Optimization", "Bug Fixes"],
    instructions: "Focus on reliability and correctness. Write tests alongside code. Optimize for performance. Fix root causes, not symptoms.",
    stats: { tasksCompleted: 0, avgScore: 0, avgTime: "—" },
  },
];

const SPECIALTY_OPTIONS = [
  "TypeScript", "JavaScript", "Python", "React", "Vue", "Svelte", "Next.js",
  "API Design", "Database", "Testing", "DevOps", "Security", "Performance",
  "Architecture", "Planning", "Task Decomposition", "CSS/Tailwind",
  "Mobile", "AI/ML", "GraphQL", "REST", "WebSocket", "Auth",
  "Bug Fixes", "Optimization", "Documentation", "Refactoring",
];

export function AgentTrainer({ projectId }: AgentTrainerProps) {
  const [configs, setConfigs] = useState<AgentConfig[]>(DEFAULT_CONFIGS);
  const [activeRole, setActiveRole] = useState<string>("orchestrator");
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false);
  const [saved, setSaved] = useState(false);

  // Get agent run stats from backend
  const agentRuns = useQuery(
    api.intelligence.listAgentRuns,
    projectId ? { projectId } : "skip"
  );

  // Compute stats per role
  const enrichedConfigs = useMemo(() => {
    if (!agentRuns) return configs;
    return configs.map((cfg) => {
      const roleRuns = agentRuns.filter((r) => r.role === cfg.role);
      const completed = roleRuns.filter((r) => r.status === "completed");
      return {
        ...cfg,
        stats: {
          tasksCompleted: completed.length,
          avgScore: completed.length > 0
            ? Math.round(completed.reduce((sum, r) => sum + (r.toolCalls || 0), 0) / completed.length)
            : 0,
          avgTime: completed.length > 0 ? `~${Math.round(completed.reduce((sum, r) => {
            const duration = (r.completedAt || r._creationTime) - r._creationTime;
            return sum + duration / 1000;
          }, 0) / completed.length)}s` : "—",
        },
      };
    });
  }, [configs, agentRuns]);

  const active = enrichedConfigs.find((c) => c.role === activeRole) || enrichedConfigs[0];

  const updateConfig = (role: string, updates: Partial<AgentConfig>) => {
    setConfigs((prev) =>
      prev.map((c) => (c.role === role ? { ...c, ...updates } : c))
    );
    setSaved(false);
  };

  const handleSave = () => {
    // In a real implementation, this would save to Convex
    // For now, save to localStorage
    try {
      localStorage.setItem("codeforge-agent-configs", JSON.stringify(configs));
      setSaved(true);
      toast.success("Agent configuration saved!");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error("Failed to save configuration");
    }
  };

  const handleReset = () => {
    setConfigs(DEFAULT_CONFIGS);
    localStorage.removeItem("codeforge-agent-configs");
    toast.info("Reset to defaults");
  };

  const toggleSpecialty = (specialty: string) => {
    const current = active.specialties;
    const updated = current.includes(specialty)
      ? current.filter((s) => s !== specialty)
      : [...current, specialty];
    updateConfig(active.role, { specialties: updated });
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <GraduationCap className="h-4 w-4 text-teal-400" />
        <span className="text-xs font-semibold text-white/70">Agent Trainer</span>
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-5 text-[9px] px-2 text-white/25 hover:text-white/50"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
          <Button
            size="sm"
            className={cn(
              "h-5 text-[9px] px-2 gap-1",
              saved ? "bg-emerald-600 text-white" : "bg-teal-600 hover:bg-teal-500 text-white"
            )}
            onClick={handleSave}
          >
            <Save className="h-3 w-3" /> {saved ? "Saved!" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Role Selector */}
        <div className="flex border-b border-white/[0.03]">
          {enrichedConfigs.map((cfg) => {
            const Icon = cfg.icon;
            return (
              <button
                key={cfg.role}
                onClick={() => setActiveRole(cfg.role)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 transition-colors border-b-2",
                  activeRole === cfg.role
                    ? "bg-white/[0.02] border-teal-500 text-white/60"
                    : "border-transparent text-white/20 hover:text-white/40"
                )}
              >
                <span className="text-lg">{cfg.avatar}</span>
                <span className="text-[10px] font-medium">{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5 p-3 border-b border-white/[0.03]">
          <div className="text-center p-2 rounded-lg bg-white/[0.01] border border-white/[0.04]">
            <p className="text-lg font-bold text-white/60">{active.stats.tasksCompleted}</p>
            <p className="text-[9px] text-white/20">Tasks Done</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/[0.01] border border-white/[0.04]">
            <p className="text-lg font-bold text-teal-400">{active.stats.avgScore || "—"}</p>
            <p className="text-[9px] text-white/20">Avg Tools</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/[0.01] border border-white/[0.04]">
            <p className="text-lg font-bold text-white/60">{active.stats.avgTime}</p>
            <p className="text-[9px] text-white/20">Avg Time</p>
          </div>
        </div>

        {/* Model */}
        <div className="px-3 py-2 border-b border-white/[0.03]">
          <label className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">
            Model
          </label>
          <select
            value={active.model}
            onChange={(e) => updateConfig(active.role, { model: e.target.value })}
            className="w-full mt-1 h-7 rounded bg-white/[0.03] border border-white/5 text-[11px] text-white/50 px-2"
          >
            <option value="grok-4.1-fast-reasoning">Grok 4.1 Fast Reasoning</option>
            <option value="deepseek-v3.2">DeepSeek v3.2</option>
            <option value="kimi-2.6">Kimi 2.6</option>
          </select>
        </div>

        {/* Temperature Slider */}
        <div className="px-3 py-2 border-b border-white/[0.03]">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">
              Temperature
            </label>
            <span className="text-[10px] text-white/30">{active.temperature}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={active.temperature}
            onChange={(e) => updateConfig(active.role, { temperature: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-white/[0.05] rounded-full appearance-none cursor-pointer accent-teal-500"
          />
          <div className="flex justify-between text-[8px] text-white/15 mt-0.5">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="px-3 py-2 border-b border-white/[0.03]">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">
              Max Output Tokens
            </label>
            <span className="text-[10px] text-white/30">{active.maxTokens}</span>
          </div>
          <input
            type="range"
            min="1024"
            max="16384"
            step="1024"
            value={active.maxTokens}
            onChange={(e) => updateConfig(active.role, { maxTokens: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-white/[0.05] rounded-full appearance-none cursor-pointer accent-teal-500"
          />
          <div className="flex justify-between text-[8px] text-white/15 mt-0.5">
            <span>1K</span>
            <span>16K</span>
          </div>
        </div>

        {/* Specialties */}
        <div className="px-3 py-2 border-b border-white/[0.03]">
          <button
            onClick={() => setShowSpecialtyPicker(!showSpecialtyPicker)}
            className="flex items-center gap-1 w-full text-left"
          >
            <label className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">
              Specialties
            </label>
            {showSpecialtyPicker ? (
              <ChevronDown className="h-3 w-3 text-white/15 ml-auto" />
            ) : (
              <ChevronRight className="h-3 w-3 text-white/15 ml-auto" />
            )}
          </button>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {active.specialties.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="text-[9px] px-1.5 py-0 border-teal-500/20 text-teal-400 cursor-pointer hover:bg-teal-500/10"
                onClick={() => toggleSpecialty(s)}
              >
                {s} ✕
              </Badge>
            ))}
          </div>
          {showSpecialtyPicker && (
            <div className="flex flex-wrap gap-1 mt-2 p-2 rounded-lg bg-white/[0.01] border border-white/[0.04]">
              {SPECIALTY_OPTIONS.filter((s) => !active.specialties.includes(s)).map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSpecialty(s)}
                  className="px-1.5 py-0.5 rounded text-[9px] text-white/25 bg-white/[0.02] hover:bg-white/[0.05] hover:text-white/40 transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom Instructions */}
        <div className="px-3 py-2">
          <label className="text-[10px] font-semibold text-white/25 uppercase tracking-wider block mb-1">
            Custom Instructions
          </label>
          <textarea
            value={active.instructions}
            onChange={(e) => updateConfig(active.role, { instructions: e.target.value })}
            rows={4}
            className="w-full rounded-lg bg-white/[0.02] border border-white/5 text-[11px] text-white/45 p-2 resize-none focus:outline-none focus:border-teal-500/30"
            placeholder="Tell this agent how to behave..."
          />
          <p className="text-[9px] text-white/15 mt-1">
            These instructions are prepended to every prompt sent to this agent.
          </p>
        </div>
      </div>
    </div>
  );
}
