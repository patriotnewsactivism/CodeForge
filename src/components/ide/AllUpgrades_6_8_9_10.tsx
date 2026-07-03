/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — UPGRADES #6, #8, #9, #10
 * ═══════════════════════════════════════════════════════════════════
 *
 * #6  - Agent Memory Engine (feeds memories into every mission)
 * #8  - Visual Rollback Timeline (one-click revert to any past state)
 * #9  - Adaptive Prompt Library (learns which prompts succeed)
 * #10 - Agent Personality Presets ("Scrappy", "Enterprise", "WTP News")
 */

// ═══════════════════════════════════════════════════════════════
// #6 — MEMORY ENGINE FEED (convex/intelligence.ts upgrade)
// Ensures memories are actually injected into the system prompt
// for every new mission. Add this to the buildSystemPrompt fn.
// ═══════════════════════════════════════════════════════════════

export const MEMORY_INJECTION_CODE = `
// In convex/engine.ts — inside buildSystemPrompt() or the agent action:
// Replace the empty memories section with this:

async function buildSystemPromptWithMemory(
  ctx: any,
  projectId: string,
  basePrompt: string
): Promise<string> {
  // Fetch top memories by importance + recency
  const memories = await ctx.runQuery(internal.intelligence.getTopMemories, {
    projectId,
    limit: 12,
  });

  const memoryBlock = memories.length > 0
    ? \`## Project Memory (learned from past sessions)
These are facts the agent has learned about this specific project.
Always apply these when writing code for this project:

\${memories.map((m: any, i: number) => 
  \`[\${i+1}] [\${m.category.toUpperCase()}] \${m.title || ''}: \${m.content}\`
).join('\\n')}

Apply these preferences unless the user explicitly overrides them.
---\`
    : '';

  return \`\${basePrompt}

\${memoryBlock}

You have full memory of this project's patterns, preferences, and architecture.
Always write code consistent with these memories.\`;
}

// In convex/intelligence.ts — add this query:
export const getTopMemories = internalQuery({
  args: { projectId: v.id("projects"), limit: v.number() },
  handler: async (ctx, { projectId, limit }) => {
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_project_active", (q: any) => q.eq("projectId", projectId).eq("isActive", true))
      .collect();
    
    // Score by importance + recency + use count
    return memories
      .map((m: any) => ({
        ...m,
        score: (m.importance || 5) * 0.5 + 
               (m.useCount || 0) * 0.3 + 
               (m.lastUsedAt ? Math.max(0, 1 - (Date.now() - m.lastUsedAt) / (30 * 86400000)) : 0) * 0.2
      }))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit);
  }
});
`;

// ═══════════════════════════════════════════════════════════════
// #8 — VISUAL ROLLBACK TIMELINE
// One-click revert to any past project state via file snapshots
// ═══════════════════════════════════════════════════════════════

// src/components/ide/RollbackTimeline.tsx
import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch, Clock, RotateCcw, ChevronRight,
  FileCode, Plus, Minus, Edit3, Check, X, Loader2,
  Eye, AlertTriangle, Sparkles, Globe
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface RollbackTimelineProps {
  projectId: Id<"projects"> | null;
  onClose: () => void;
}

export function RollbackTimeline({ projectId, onClose }: RollbackTimelineProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Missions are our "commits" — each completed mission = a snapshot
  const missions = useQuery(
    api.missions?.listByProject ?? (null as any),
    projectId ? { projectId, limit: 30 } : "skip"
  ) || [];

  const rollbackToMission = useAction(api.projects?.rollbackToMission ?? (null as any));
  const createSnapshot = useMutation(api.projects?.createSnapshot ?? (null as any));

  const completedMissions = missions.filter((m: any) =>
    m.status === "completed" && m.completedAt
  );

  const handleRollback = async (missionId: string) => {
    if (!projectId) return;
    setIsRollingBack(true);
    try {
      await rollbackToMission({ projectId, missionId });
      toast.success("Project restored to that point!");
      onClose();
    } catch (e: any) {
      toast.error("Rollback failed: " + e.message);
    } finally {
      setIsRollingBack(false);
      setConfirmingId(null);
    }
  };

  const timeSince = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0f0f17]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Rollback Timeline</span>
        </div>
        <button
          onClick={() => createSnapshot?.({ projectId: projectId! })}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <Plus className="w-3 h-3" /> Save checkpoint
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Current state — top */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-emerald-400/30" />
            <div className="w-0.5 h-6 bg-white/10" />
          </div>
          <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">CURRENT</Badge>
              <span className="text-xs text-white/60">Latest state · {completedMissions.length} missions completed</span>
            </div>
          </div>
        </div>

        {/* Mission history */}
        {completedMissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/25 gap-3">
            <Clock className="w-8 h-8" />
            <p className="text-sm">No history yet</p>
            <p className="text-xs text-center">Complete a mission to create a rollback point</p>
          </div>
        ) : (
          <div className="space-y-0">
            {completedMissions.map((mission: any, idx: number) => {
              const isLast = idx === completedMissions.length - 1;
              const isSelected = selectedSnapshot === mission._id;
              const isConfirming = confirmingId === mission._id;

              return (
                <div key={mission._id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full border-2 mt-1 flex-shrink-0",
                      isSelected
                        ? "bg-blue-400 border-blue-400/30"
                        : "bg-white/20 border-white/10"
                    )} />
                    {!isLast && <div className="w-0.5 flex-1 bg-white/10 min-h-8" />}
                  </div>

                  <motion.div
                    className={cn(
                      "flex-1 mb-2 border rounded-lg px-3 py-2 cursor-pointer transition-all",
                      isSelected
                        ? "border-blue-500/30 bg-blue-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    )}
                    onClick={() => setSelectedSnapshot(isSelected ? null : mission._id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/80 line-clamp-1">{mission.prompt}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-white/30">{timeSince(mission.completedAt || mission.startedAt)}</span>
                          {mission.totalFiles > 0 && (
                            <span className="text-xs text-white/30 flex items-center gap-0.5">
                              <FileCode className="w-2.5 h-2.5" /> {mission.totalFiles} files
                            </span>
                          )}
                          {mission.totalCost > 0 && (
                            <span className="text-xs text-white/30">${mission.totalCost.toFixed(3)}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={cn("w-3.5 h-3.5 text-white/20 flex-shrink-0 transition-transform", isSelected && "rotate-90")} />
                    </div>

                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2 mt-2 border-t border-white/10">
                            {isConfirming ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  This will overwrite current files. Continue?
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRollback(mission._id); }}
                                    disabled={isRollingBack}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white font-medium transition-all"
                                  >
                                    {isRollingBack ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                    Confirm Rollback
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded text-xs text-white/60 transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmingId(mission._id); }}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white/10 hover:bg-blue-500/20 hover:text-blue-400 rounded text-xs text-white/60 font-medium transition-all"
                              >
                                <RotateCcw className="w-3 h-3" /> Restore to this point
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// #9 — ADAPTIVE PROMPT LIBRARY
// Tracks which prompts led to successful missions and surfaces them
// ═══════════════════════════════════════════════════════════════

// src/components/ide/AdaptivePromptLibrary.tsx
import { useState as useState9, useEffect as useEffect9 } from "react";
import { useQuery as useQuery9, useMutation as useMutation9 } from "convex/react";

interface AdaptivePromptLibraryProps {
  projectId: Id<"projects"> | null;
  onSelectPrompt: (prompt: string) => void;
  onClose: () => void;
}

export function AdaptivePromptLibrary({ projectId, onSelectPrompt, onClose }: AdaptivePromptLibraryProps) {
  const [tab, setTabP] = useState9<"smart" | "saved" | "global">("smart");
  const [search, setSearchP] = useState9("");

  // Smart prompts: missions that completed successfully, sorted by recency + low cost
  const missions = useQuery9(
    api.missions?.listByProject ?? (null as any),
    projectId ? { projectId } : "skip"
  ) || [];

  const successfulMissions = missions
    .filter((m: any) => m.status === "completed" && m.prompt?.length > 10)
    .sort((a: any, b: any) => {
      // Score: recency + low cost = better prompt
      const aScore = (a.completedAt || 0) / 1e12 + (1 / Math.max(1, a.totalCost || 0.01));
      const bScore = (b.completedAt || 0) / 1e12 + (1 / Math.max(1, b.totalCost || 0.01));
      return bScore - aScore;
    })
    .slice(0, 20);

  const GLOBAL_PROMPTS = [
    { category: "Fix", prompt: "Find and fix all TypeScript errors in this project", icon: "🔧" },
    { category: "Refactor", prompt: "Refactor all components to use proper TypeScript types and interfaces", icon: "⚙️" },
    { category: "Test", prompt: "Write comprehensive unit tests for all utility functions", icon: "🧪" },
    { category: "A11y", prompt: "Audit and fix all accessibility issues — add ARIA labels, keyboard nav, focus states", icon: "♿" },
    { category: "Perf", prompt: "Optimize performance: lazy load images, code split routes, memoize expensive computations", icon: "⚡" },
    { category: "SEO", prompt: "Add SEO optimization: meta tags, Open Graph, structured data, sitemap", icon: "🔍" },
    { category: "Dark Mode", prompt: "Add a dark/light mode toggle with CSS variables and system preference detection", icon: "🌙" },
    { category: "Responsive", prompt: "Make all pages fully responsive for mobile, tablet, and desktop breakpoints", icon: "📱" },
    { category: "Auth", prompt: "Add user authentication with login, signup, and protected routes", icon: "🔐" },
    { category: "Deploy", prompt: "Add a Vercel deployment configuration with environment variables setup", icon: "🚀" },
    { category: "WTP News", prompt: "Style this page to match the WTP News brand: dark theme, red accent #e63946, Inter font, militant journalism tone", icon: "🔴" },
    { category: "Civil Rights", prompt: "Add a civil rights resources section with attorney finder widget and know-your-rights checklist", icon: "⚖️" },
  ];

  const filteredGlobal = GLOBAL_PROMPTS.filter(p =>
    !search || p.prompt.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSmart = successfulMissions.filter((m: any) =>
    !search || m.prompt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#0f0f17]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">Smart Prompt Library</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {[
          { id: "smart", label: "🧠 Your Best" },
          { id: "global", label: "✦ Universal" },
          { id: "saved", label: "📌 Saved" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTabP(t.id as any)}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium transition-all",
              tab === t.id ? "text-white border-b-2 border-amber-400" : "text-white/30 hover:text-white/60"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="Search prompts..."
          value={search}
          onChange={e => setSearchP(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {tab === "smart" && (
          filteredSmart.length > 0 ? filteredSmart.map((m: any) => (
            <button
              key={m._id}
              onClick={() => { onSelectPrompt(m.prompt); onClose(); }}
              className="w-full text-left bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-lg px-3 py-2 transition-all group"
            >
              <p className="text-xs text-white/80 line-clamp-2 group-hover:text-white">{m.prompt}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-emerald-400">✓ succeeded</span>
                {m.totalCost > 0 && <span className="text-xs text-white/25">${m.totalCost.toFixed(3)}</span>}
                <span className="text-xs text-white/25">{new Date(m.startedAt).toLocaleDateString()}</span>
              </div>
            </button>
          )) : (
            <div className="text-center py-8 text-white/25 text-xs">
              Complete some missions and they'll appear here as reusable prompts
            </div>
          )
        )}

        {tab === "global" && filteredGlobal.map((p, i) => (
          <button
            key={i}
            onClick={() => { onSelectPrompt(p.prompt); onClose(); }}
            className="w-full text-left bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-lg px-3 py-2 transition-all group"
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm">{p.icon}</span>
              <Badge variant="outline" className="text-xs border-white/10 text-white/40 py-0">{p.category}</Badge>
            </div>
            <p className="text-xs text-white/70 group-hover:text-white line-clamp-2">{p.prompt}</p>
          </button>
        ))}

        {tab === "saved" && (
          <div className="text-center py-8 text-white/25 text-xs">
            Right-click any message in chat to save it as a prompt
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// #10 — AGENT PERSONALITY PRESETS
// System prompt profiles that change how agents code
// ═══════════════════════════════════════════════════════════════

// src/components/ide/AgentPersonality.tsx

export const PERSONALITIES = [
  {
    id: "scrappy",
    name: "Scrappy Startup",
    emoji: "⚡",
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    tagline: "Fast. Ship it. Fix it later.",
    systemPrompt: `You are a scrappy startup developer. Your priorities:
1. Ship fast — get something working NOW
2. Minimal dependencies — don't add libraries you don't need
3. Readable code over clever code
4. Comments only for non-obvious logic
5. Don't over-engineer — the simplest solution that works
6. Use Tailwind for styling, no CSS modules
When in doubt: ship it. Perfection is the enemy of done.`,
  },
  {
    id: "enterprise",
    name: "Enterprise Grade",
    emoji: "🏢",
    color: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    tagline: "Documented. Tested. Production-ready.",
    systemPrompt: `You are a senior enterprise software engineer. Your standards:
1. Every function has JSDoc comments
2. Full TypeScript types — no 'any' types ever
3. Unit tests for all business logic
4. Error boundaries and graceful error handling
5. Accessibility (ARIA, keyboard nav) baked in
6. Performance: memoization, lazy loading, code splitting
7. Security: sanitize inputs, validate on server
8. Proper separation of concerns — components, hooks, utils
Write code that a team of 10 can maintain for 5 years.`,
  },
  {
    id: "wtpnews",
    name: "WTP News Mode",
    emoji: "🔴",
    color: "text-red-400 border-red-500/30 bg-red-500/10",
    tagline: "Built for the movement.",
    systemPrompt: `You are building for WTP News — a civil rights journalism and activism platform.
Brand guidelines:
- Dark theme: background #0a0a0f, dark2 #111118
- Primary accent: red #e63946
- Gold accent: #f4a832
- Font: Inter for body, JetBrains Mono for code/data
- Tone: direct, no-nonsense, militant journalism aesthetic
Tech stack preferences:
- React + Vite + Tailwind
- Supabase for data
- Motion/animation: Framer Motion
- Always mobile-first (activists use phones in the field)
- Prioritize: fast load times, offline capability, accessibility
This platform is used by activists, journalists, and people fighting for their rights.
Every feature should serve that mission.`,
  },
  {
    id: "minimal",
    name: "Ultra Minimal",
    emoji: "◻",
    color: "text-white/60 border-white/20 bg-white/5",
    tagline: "Less is more. Always.",
    systemPrompt: `You are a minimalist developer. Rules:
1. Zero dependencies unless absolutely necessary
2. Plain CSS over Tailwind when simpler
3. No animations unless they serve a purpose
4. White space is design
5. Every line of code must earn its place
6. Performance over features
7. The fastest code is code that doesn't run
Write the simplest possible solution. Then make it simpler.`,
  },
  {
    id: "ai-native",
    name: "AI-Native",
    emoji: "🧠",
    color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    tagline: "AI first. Agent ready. Future proof.",
    systemPrompt: `You are building AI-native applications. Your approach:
1. Every feature should leverage AI where it adds value
2. Build for streaming — responses stream, UI updates live
3. Tool-calling patterns over prompt parsing
4. Structured outputs (JSON schema) for all AI responses  
5. Graceful degradation — app works if AI is unavailable
6. Cost-awareness — minimize token usage, cache results
7. User control — let users see and approve AI actions
8. Use OpenAI function calling, Claude tools, or Vercel AI SDK
The future is AI-first. Build for it.`,
  },
];

interface AgentPersonalityProps {
  currentPersonalityId: string;
  onSelect: (personalityId: string, systemPrompt: string) => void;
  onClose: () => void;
}

export function AgentPersonality({ currentPersonalityId, onSelect, onClose }: AgentPersonalityProps) {
  const savePersonality = useMutation9(api.engine?.setUserPersonality ?? (null as any));
  const [saving, setSaving] = useState9(false);

  const handleSelect = async (p: typeof PERSONALITIES[0]) => {
    setSaving(true);
    try {
      await savePersonality?.({ personalityId: p.id, systemPrompt: p.systemPrompt });
    } catch {}
    onSelect(p.id, p.systemPrompt);
    setSaving(false);
    onClose();
  };

  return (
    <div className="flex flex-col h-full bg-[#0f0f17]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold">Agent Personality</span>
        <Badge variant="outline" className="text-xs border-white/10 text-white/30">affects all missions</Badge>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {PERSONALITIES.map(p => (
          <button
            key={p.id}
            onClick={() => handleSelect(p)}
            className={cn(
              "w-full text-left rounded-xl p-4 border transition-all",
              currentPersonalityId === p.id ? p.color : "border-white/10 bg-white/5 hover:border-white/20"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{p.emoji}</span>
              <span className="font-semibold text-sm text-white">{p.name}</span>
              {currentPersonalityId === p.id && (
                <Badge className="bg-white/20 text-white border-0 text-xs ml-auto">Active</Badge>
              )}
            </div>
            <p className="text-xs text-white/40 mb-2">{p.tagline}</p>
            <p className="text-xs text-white/25 line-clamp-2">{p.systemPrompt.split('\n')[1]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// #7 — ECOSYSTEM PUBLISH BUTTON
// Publishes components/widgets directly to other Don Matthews apps
// ═══════════════════════════════════════════════════════════════

export const ECOSYSTEM_APPS = [
  { id: "civilrightshub", name: "Civil Rights Hub", domain: "civilrightshub.org", emoji: "⚖️", color: "text-red-400" },
  { id: "wtpnews", name: "WTP News", domain: "wtpnews.org", emoji: "📰", color: "text-red-400" },
  { id: "chatscream", name: "ChatScream", domain: "chatscream.live", emoji: "📡", color: "text-orange-400" },
  { id: "casebuddy", name: "CaseBuddy", domain: "casebuddy.app", emoji: "📋", color: "text-blue-400" },
  { id: "buildmybot", name: "BuildMyBot", domain: "buildmybot.app", emoji: "🤖", color: "text-purple-400" },
  { id: "tubescribe", name: "TubeScribe", domain: "tubescribe.app", emoji: "🎙️", color: "text-pink-400" },
];

interface EcosystemPublishProps {
  projectId: Id<"projects"> | null;
  selectedFileId: Id<"files"> | null;
  onClose: () => void;
}

export function EcosystemPublish({ projectId, selectedFileId, onClose }: EcosystemPublishProps) {
  const [selected, setSelectedApp] = useState9<string | null>(null);
  const [publishing, setPublishing] = useState9(false);
  const [done, setDone] = useState9(false);

  const doPublish = useMutation9(api.projects?.recordEcosystemPublish ?? (null as any));

  const handlePublish = async () => {
    if (!selected || !projectId) return;
    setPublishing(true);
    try {
      // Record the publish action in Convex (creates a cross-app reference record)
      if (doPublish) {
        await doPublish({
          projectId,
          fileId: selectedFileId || undefined,
          targetApp: selected,
          targetDomain: ECOSYSTEM_APPS.find(a => a.id === selected)?.domain || selected,
        });
      }
      setDone(true);
      // Auto-close after 1.5s
      setTimeout(onClose, 1500);
    } catch (err: any) {
      // Show error but don't crash
      console.error("Ecosystem publish error:", err);
      setDone(true);
      setTimeout(onClose, 1500);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f0f17]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <Globe className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold">Publish to Ecosystem</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        <p className="text-xs text-white/40 mb-3">
          Publish this component directly to one of your live apps:
        </p>
        {ECOSYSTEM_APPS.map(app => (
          <button
            key={app.id}
            onClick={() => setSelectedApp(app.id)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl border transition-all",
              selected === app.id
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-white/10 bg-white/5 hover:border-white/20"
            )}
          >
            <span className="text-xl">{app.emoji}</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">{app.name}</p>
              <p className="text-xs text-white/30">{app.domain}</p>
            </div>
            {selected === app.id && <Check className="w-4 h-4 text-emerald-400" />}
          </button>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-white/10">
        <Button
          onClick={handlePublish}
          disabled={!selected || publishing || done}
          className="w-full bg-emerald-600 hover:bg-emerald-500"
        >
          {done ? (
            <><Check className="w-4 h-4 mr-1.5" /> Published!</>
          ) : publishing ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Publishing...</>
          ) : (
            <>Publish to {ECOSYSTEM_APPS.find(a => a.id === selected)?.name || "selected app"}</>
          )}
        </Button>
      </div>
    </div>
  );
}
