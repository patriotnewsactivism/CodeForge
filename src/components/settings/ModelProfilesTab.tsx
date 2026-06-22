/**
 * ModelProfilesTab.tsx — AI Model Profiles & Selector
 *
 * Features:
 * - Preset profiles (Viktor's Recommended, Budget Swarm, Premium, etc.)
 * - Full model catalog with reasoning/cost/speed ratings
 * - Custom profile builder
 * - Visual bars for reasoning, cost, and speed
 * - Active profile persisted to Convex userSettings
 */
import { useMutation, useQuery } from "convex/react";
import {
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Crown,
  Flame,
  Layers,
  Rocket,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";

// ─── Model metadata with reasoning / cost / speed ratings ──────────────────

interface ModelMeta {
  id: string;
  name: string;
  provider: string;
  tier: "budget" | "mid" | "premium";
  inputCost: number; // per 1M tokens
  outputCost: number;
  reasoning: number; // 1–5
  speed: number; // 1–5
  codeQuality: number; // 1–5
  description: string;
  icon: string;
  color: string;
  badge?: string;
}

const ALL_MODELS: ModelMeta[] = [
  // ── Budget Tier ──
  {
    id: "kimi-k2",
    name: "Kimi K2",
    provider: "Moonshot",
    tier: "budget",
    inputCost: 0.12,
    outputCost: 0.12,
    reasoning: 3,
    speed: 5,
    codeQuality: 3,
    description: "Absurdly cheap. Good for simple code tasks and scaffolding.",
    icon: "🌙",
    color: "text-yellow-400",
    badge: "Cheapest",
  },
  {
    id: "or/google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "OpenRouter",
    tier: "budget",
    inputCost: 0.15,
    outputCost: 0.6,
    reasoning: 3,
    speed: 5,
    codeQuality: 4,
    description: "Google's speed demon. Great code quality for the price.",
    icon: "⚡",
    color: "text-cyan-300",
    badge: "Best Value",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    tier: "budget",
    inputCost: 0.15,
    outputCost: 0.6,
    reasoning: 3,
    speed: 5,
    codeQuality: 4,
    description: "OpenAI's reliable workhorse. Consistent output quality.",
    icon: "🤖",
    color: "text-purple-300",
  },
  {
    id: "or/meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick",
    provider: "OpenRouter",
    tier: "budget",
    inputCost: 0.2,
    outputCost: 0.6,
    reasoning: 3,
    speed: 4,
    codeQuality: 4,
    description: "Meta's open-source powerhouse. Strong full-stack coding.",
    icon: "🦙",
    color: "text-amber-400",
  },
  {
    id: "or/qwen/qwen3-235b",
    name: "Qwen 3 235B",
    provider: "OpenRouter",
    tier: "budget",
    inputCost: 0.2,
    outputCost: 0.6,
    reasoning: 4,
    speed: 4,
    codeQuality: 4,
    description: "Alibaba's giant. 235B params with surprisingly strong reasoning.",
    icon: "🌐",
    color: "text-teal-400",
  },
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    tier: "budget",
    inputCost: 0.27,
    outputCost: 1.1,
    reasoning: 3,
    speed: 4,
    codeQuality: 4,
    description: "CodeForge's default model. Solid all-rounder.",
    icon: "🧠",
    color: "text-emerald-400",
  },
  {
    id: "or/mistralai/codestral",
    name: "Codestral",
    provider: "OpenRouter",
    tier: "budget",
    inputCost: 0.3,
    outputCost: 0.9,
    reasoning: 3,
    speed: 5,
    codeQuality: 4,
    description: "Mistral's code specialist. Optimized for programming tasks.",
    icon: "🔧",
    color: "text-rose-400",
    badge: "Code-First",
  },
  // ── Mid Tier ──
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    tier: "mid",
    inputCost: 0.55,
    outputCost: 2.19,
    reasoning: 5,
    speed: 3,
    codeQuality: 4,
    description: "Chain-of-thought reasoning. Best thinker per dollar.",
    icon: "💡",
    color: "text-green-400",
    badge: "Best Reasoner/$",
  },
  {
    id: "or/deepseek/deepseek-r1",
    name: "DeepSeek R1 (OR)",
    provider: "OpenRouter",
    tier: "mid",
    inputCost: 0.55,
    outputCost: 2.19,
    reasoning: 5,
    speed: 3,
    codeQuality: 4,
    description: "Same R1 model via OpenRouter. Use if no DeepSeek key.",
    icon: "💡",
    color: "text-green-300",
  },
  {
    id: "or/anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "OpenRouter",
    tier: "mid",
    inputCost: 0.8,
    outputCost: 4.0,
    reasoning: 4,
    speed: 4,
    codeQuality: 5,
    description: "Anthropic's fast model. Exceptional code review quality.",
    icon: "🟠",
    color: "text-orange-300",
    badge: "Best Reviewer",
  },
  {
    id: "or/nousresearch/hermes-3-llama-3.1-405b",
    name: "Hermes 3 405B",
    provider: "OpenRouter",
    tier: "mid",
    inputCost: 0.8,
    outputCost: 0.8,
    reasoning: 4,
    speed: 3,
    codeQuality: 4,
    description: "Open-source 405B. Flat pricing — great for long outputs.",
    icon: "⚗️",
    color: "text-violet-400",
  },
  {
    id: "or/openai/o3-mini",
    name: "o3-mini",
    provider: "OpenRouter",
    tier: "mid",
    inputCost: 1.1,
    outputCost: 4.4,
    reasoning: 5,
    speed: 3,
    codeQuality: 4,
    description: "OpenAI's reasoning model. Strong logic and planning.",
    icon: "🔬",
    color: "text-blue-300",
  },
  // ── Premium Tier ──
  {
    id: "or/google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "OpenRouter",
    tier: "premium",
    inputCost: 1.25,
    outputCost: 10.0,
    reasoning: 5,
    speed: 3,
    codeQuality: 5,
    description: "1M token context. Best for analyzing massive codebases.",
    icon: "💎",
    color: "text-cyan-400",
    badge: "Biggest Context",
  },
  {
    id: "or/openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "OpenRouter",
    tier: "premium",
    inputCost: 2.0,
    outputCost: 8.0,
    reasoning: 4,
    speed: 4,
    codeQuality: 5,
    description: "OpenAI's latest. Strong across all coding tasks.",
    icon: "🤖",
    color: "text-purple-400",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    tier: "premium",
    inputCost: 2.5,
    outputCost: 10.0,
    reasoning: 4,
    speed: 4,
    codeQuality: 5,
    description: "Battle-tested flagship. Reliable for production code.",
    icon: "🤖",
    color: "text-purple-400",
  },
  {
    id: "or/anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "OpenRouter",
    tier: "premium",
    inputCost: 3.0,
    outputCost: 15.0,
    reasoning: 5,
    speed: 3,
    codeQuality: 5,
    description: "Writes the cleanest code. Best for complex architecture.",
    icon: "🟠",
    color: "text-orange-400",
    badge: "Best Code Quality",
  },
  {
    id: "grok-3-fast",
    name: "Grok 3 Fast",
    provider: "xAI",
    tier: "premium",
    inputCost: 3.0,
    outputCost: 15.0,
    reasoning: 4,
    speed: 5,
    codeQuality: 4,
    description: "xAI's fast flagship. Quick turnaround for premium quality.",
    icon: "⚡",
    color: "text-blue-400",
  },
  {
    id: "grok-4",
    name: "Grok 4",
    provider: "xAI",
    tier: "premium",
    inputCost: 5.0,
    outputCost: 25.0,
    reasoning: 5,
    speed: 3,
    codeQuality: 5,
    description: "xAI flagship. Maximum capability, highest cost.",
    icon: "🔮",
    color: "text-indigo-400",
    badge: "Most Powerful",
  },
];

// ─── Swarm Profiles (presets) ──────────────────────────────────────────────

interface SwarmRole {
  role: string;
  label: string;
  modelId: string;
}

interface SwarmProfile {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  estimatedCostPerBuild: string;
  roles: SwarmRole[];
  badge?: string;
}

const SWARM_PROFILES: SwarmProfile[] = [
  {
    id: "viktor-recommended",
    name: "Viktor's Pick",
    description:
      "Optimal balance of cost, speed, and quality. R1 plans, budget models execute, Haiku reviews.",
    icon: <Star className="h-4 w-4" />,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    estimatedCostPerBuild: "$0.10–$0.25",
    badge: "Recommended",
    roles: [
      { role: "architect", label: "Architect / Planner", modelId: "deepseek-reasoner" },
      { role: "coder", label: "Coder Agents", modelId: "or/google/gemini-2.5-flash" },
      { role: "reviewer", label: "Code Reviewer", modelId: "or/anthropic/claude-3.5-haiku" },
      { role: "debugger", label: "Debugger", modelId: "or/meta-llama/llama-4-maverick" },
      { role: "tester", label: "Test Writer", modelId: "or/qwen/qwen3-235b" },
      { role: "devops", label: "DevOps / Deploy", modelId: "deepseek-v3" },
    ],
  },
  {
    id: "budget-swarm",
    name: "Budget Swarm",
    description:
      "Maximum agents, minimum cost. Great for scaffolding, prototypes, and bulk generation.",
    icon: <CircleDollarSign className="h-4 w-4" />,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    estimatedCostPerBuild: "$0.02–$0.08",
    roles: [
      { role: "architect", label: "Architect / Planner", modelId: "or/qwen/qwen3-235b" },
      { role: "coder", label: "Coder Agents", modelId: "kimi-k2" },
      { role: "reviewer", label: "Code Reviewer", modelId: "or/google/gemini-2.5-flash" },
      { role: "debugger", label: "Debugger", modelId: "gpt-4o-mini" },
      { role: "tester", label: "Test Writer", modelId: "kimi-k2" },
      { role: "devops", label: "DevOps / Deploy", modelId: "deepseek-v3" },
    ],
  },
  {
    id: "premium-quality",
    name: "Premium Quality",
    description:
      "Top-tier models for every role. Best code quality, strongest reasoning. Use for production.",
    icon: <Crown className="h-4 w-4" />,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    estimatedCostPerBuild: "$0.80–$2.00",
    roles: [
      { role: "architect", label: "Architect / Planner", modelId: "or/anthropic/claude-sonnet-4" },
      { role: "coder", label: "Coder Agents", modelId: "or/openai/gpt-4.1" },
      { role: "reviewer", label: "Code Reviewer", modelId: "or/anthropic/claude-sonnet-4" },
      { role: "debugger", label: "Debugger", modelId: "or/google/gemini-2.5-pro" },
      { role: "tester", label: "Test Writer", modelId: "or/openai/o3-mini" },
      { role: "devops", label: "DevOps / Deploy", modelId: "gpt-4o" },
    ],
  },
  {
    id: "reasoning-heavy",
    name: "Reasoning Heavy",
    description:
      "Chain-of-thought everywhere. Slower but thinks harder. Best for complex refactors.",
    icon: <Brain className="h-4 w-4" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    estimatedCostPerBuild: "$0.30–$0.60",
    roles: [
      { role: "architect", label: "Architect / Planner", modelId: "or/openai/o3-mini" },
      { role: "coder", label: "Coder Agents", modelId: "deepseek-reasoner" },
      { role: "reviewer", label: "Code Reviewer", modelId: "or/anthropic/claude-3.5-haiku" },
      { role: "debugger", label: "Debugger", modelId: "deepseek-reasoner" },
      { role: "tester", label: "Test Writer", modelId: "or/openai/o3-mini" },
      { role: "devops", label: "DevOps / Deploy", modelId: "deepseek-v3" },
    ],
  },
  {
    id: "speed-demon",
    name: "Speed Demon",
    description:
      "Fastest possible models. When you need code NOW. Great for rapid iteration.",
    icon: <Rocket className="h-4 w-4" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    estimatedCostPerBuild: "$0.05–$0.15",
    roles: [
      { role: "architect", label: "Architect / Planner", modelId: "or/google/gemini-2.5-flash" },
      { role: "coder", label: "Coder Agents", modelId: "kimi-k2" },
      { role: "reviewer", label: "Code Reviewer", modelId: "gpt-4o-mini" },
      { role: "debugger", label: "Debugger", modelId: "or/google/gemini-2.5-flash" },
      { role: "tester", label: "Test Writer", modelId: "or/mistralai/codestral" },
      { role: "devops", label: "DevOps / Deploy", modelId: "kimi-k2" },
    ],
  },
];

// ─── Rating bar component ──────────────────────────────────────────────────

function RatingBar({
  value,
  max = 5,
  color,
  label,
}: {
  value: number;
  max?: number;
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-16 text-right">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-3 rounded-sm transition-colors ${
              i < value ? color : "bg-zinc-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Cost badge ────────────────────────────────────────────────────────────

function CostBadge({ inputCost }: { inputCost: number }) {
  const tier =
    inputCost < 0.3
      ? { label: "$", color: "text-green-400 bg-green-500/10" }
      : inputCost < 1.0
        ? { label: "$$", color: "text-yellow-400 bg-yellow-500/10" }
        : inputCost < 3.0
          ? { label: "$$$", color: "text-orange-400 bg-orange-500/10" }
          : { label: "$$$$", color: "text-red-400 bg-red-500/10" };

  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${tier.color}`}
    >
      {tier.label}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function ModelProfilesTab() {
  const userSettings = useQuery(api.userSettings.get);
  const updateProfile = useMutation(api.userSettings.setModelProfile);

  const activeProfileId = userSettings?.modelProfileId ?? "viktor-recommended";
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [showAllModels, setShowAllModels] = useState(false);
  const [filterTier, setFilterTier] = useState<
    "all" | "budget" | "mid" | "premium"
  >("all");
  const [sortBy, setSortBy] = useState<"cost" | "reasoning" | "speed">("cost");

  const filteredModels = useMemo(() => {
    let models =
      filterTier === "all"
        ? ALL_MODELS
        : ALL_MODELS.filter((m) => m.tier === filterTier);

    models = [...models].sort((a, b) => {
      if (sortBy === "cost") return a.inputCost - b.inputCost;
      if (sortBy === "reasoning") return b.reasoning - a.reasoning;
      return b.speed - a.speed;
    });

    return models;
  }, [filterTier, sortBy]);

  const handleSelectProfile = useCallback(
    async (profileId: string) => {
      const profile = SWARM_PROFILES.find((p) => p.id === profileId);
      if (!profile) return;

      try {
        await updateProfile({
          modelProfileId: profileId,
          agentModels: Object.fromEntries(
            profile.roles.map((r) => [r.role, r.modelId]),
          ),
        });
        toast.success(`Profile "${profile.name}" activated`);
      } catch {
        toast.error("Failed to save profile");
      }
    },
    [updateProfile],
  );

  const getModelName = useCallback((modelId: string) => {
    return ALL_MODELS.find((m) => m.id === modelId)?.name ?? modelId;
  }, []);

  return (
    <div className="space-y-6">
      {/* ─── Section: Swarm Profiles ──────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Layers className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-200">
            Swarm Profiles
          </h3>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Choose a preset that assigns the right AI model to each agent role.
          Each profile optimizes for different priorities.
        </p>

        <div className="grid gap-3">
          {SWARM_PROFILES.map((profile) => {
            const isActive = activeProfileId === profile.id;
            const isExpanded = expandedProfile === profile.id;

            return (
              <div
                key={profile.id}
                className={`rounded-lg border transition-all ${
                  isActive
                    ? `${profile.borderColor} ${profile.bgColor}`
                    : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
                }`}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer"
                  onClick={() =>
                    setExpandedProfile(isExpanded ? null : profile.id)
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={profile.color}>{profile.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">
                          {profile.name}
                        </span>
                        {profile.badge && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${profile.bgColor} ${profile.color}`}
                          >
                            {profile.badge}
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate">
                        {profile.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-[10px] font-mono text-zinc-500">
                      {profile.estimatedCostPerBuild}/build
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                    )}
                  </div>
                </div>

                {/* Expanded: show roles */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-zinc-800/50">
                    <div className="grid gap-1.5 mt-2.5">
                      {profile.roles.map((r) => {
                        const model = ALL_MODELS.find(
                          (m) => m.id === r.modelId,
                        );
                        return (
                          <div
                            key={r.role}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-zinc-500">{r.label}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={model?.color ?? "text-zinc-400"}>
                                {model?.icon ?? "•"}
                              </span>
                              <span className="text-zinc-300 font-medium">
                                {getModelName(r.modelId)}
                              </span>
                              <span className="text-zinc-600 text-[10px] font-mono">
                                ${model?.inputCost?.toFixed(2) ?? "?"}/M
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {!isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProfile(profile.id);
                        }}
                        className={`mt-3 w-full text-xs font-medium py-1.5 rounded-md border transition-colors ${profile.borderColor} ${profile.color} hover:${profile.bgColor}`}
                      >
                        Activate This Profile
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Section: All Models Catalog ──────────────────────────────── */}
      <div>
        <button
          onClick={() => setShowAllModels(!showAllModels)}
          className="flex items-center gap-2 text-sm font-semibold text-zinc-200 hover:text-zinc-100 transition-colors"
        >
          <Sparkles className="h-4 w-4 text-zinc-400" />
          All Models Catalog ({ALL_MODELS.length})
          {showAllModels ? (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          )}
        </button>

        {showAllModels && (
          <div className="mt-3 space-y-3">
            {/* Filters & sort */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "budget", "mid", "premium"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTier(t)}
                  className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                    filterTier === t
                      ? "bg-zinc-700 border-zinc-600 text-zinc-200"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  }`}
                >
                  {t === "all"
                    ? "All"
                    : t === "budget"
                      ? "💰 Budget"
                      : t === "mid"
                        ? "⚖️ Mid-Range"
                        : "👑 Premium"}
                </button>
              ))}

              <span className="text-zinc-700 text-[10px]">|</span>

              <span className="text-[10px] text-zinc-500">Sort:</span>
              {(["cost", "reasoning", "speed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                    sortBy === s
                      ? "bg-zinc-700 border-zinc-600 text-zinc-200"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  }`}
                >
                  {s === "cost"
                    ? "💲 Cheapest"
                    : s === "reasoning"
                      ? "🧠 Reasoning"
                      : "⚡ Speed"}
                </button>
              ))}
            </div>

            {/* Model cards */}
            <div className="grid gap-2">
              {filteredModels.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors"
                >
                  {/* Icon */}
                  <span className="text-lg shrink-0 mt-0.5">{m.icon}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-medium ${m.color}`}
                      >
                        {m.name}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {m.provider}
                      </span>
                      {m.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                          {m.badge}
                        </span>
                      )}
                      <CostBadge inputCost={m.inputCost} />
                    </div>
                    <p className="text-[11px] text-zinc-500">{m.description}</p>

                    {/* Rating bars */}
                    <div className="flex gap-4">
                      <RatingBar
                        value={m.reasoning}
                        color="bg-blue-500"
                        label="Reasoning"
                      />
                      <RatingBar
                        value={m.codeQuality}
                        color="bg-purple-500"
                        label="Code"
                      />
                      <RatingBar
                        value={m.speed}
                        color="bg-amber-500"
                        label="Speed"
                      />
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="text-[10px] font-mono text-zinc-300">
                      ${m.inputCost.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-zinc-600">in/1M</div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      ${m.outputCost.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-zinc-600">out/1M</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
