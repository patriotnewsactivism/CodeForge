/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — PROMPT EVOLVER (Self-Improvement Loop)
 * ═══════════════════════════════════════════════════════════════════
 *
 * The heart of CodeForge's "always learning" system.
 *
 * Before any mission launches, this module:
 *   1. Retrieves relevant memories from past missions
 *   2. Checks retrospective learnings (what went right/wrong)
 *   3. Enhances the user's prompt with context, patterns, and fixes
 *   4. Records a new memory entry after mission completion
 *
 * After every mission completes:
 *   1. Runs a retrospective analysis
 *   2. Extracts learnings (mistakes, wins, patterns)
 *   3. Stores them so future prompts benefit
 *
 * This means CodeForge literally gets smarter with every use.
 */
import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };

// ─── Queries ────────────────────────────────────────────────────

/**
 * Get all memories for a project, ranked by relevance
 */
export const getMemories = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("memories")
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .order("desc")
      .take(50);
  },
});

/**
 * Get retrospective learnings
 */
export const getRetrospectives = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("retrospectives")
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .order("desc")
      .take(20);
  },
});

// ─── Internal: Fetch memories for prompt enhancement ────────────

export const fetchProjectMemories = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const memories = await ctx.db
      .query("memories")
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .order("desc")
      .take(20);

    const retros = await ctx.db
      .query("retrospectives")
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .order("desc")
      .take(10);

    return { memories, retrospectives: retros };
  },
});

// ─── Enhance Prompt (called before mission launch) ──────────────

export const enhancePrompt = internalAction({
  args: {
    projectId: v.id("projects"),
    originalPrompt: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    // 1. Fetch project memories and retrospectives
    const { memories, retrospectives } = await ctx.runQuery(
      internal.promptEvolver.fetchProjectMemories,
      { projectId: args.projectId }
    );

    // If no history, return original prompt (first mission)
    if (memories.length === 0 && retrospectives.length === 0) {
      return args.originalPrompt;
    }

    // 2. Build context from learnings
    const memoryContext = memories
      .slice(0, 10)
      .map(
        (m: any) =>
          `• [${m.category}] ${m.content}${m.importance ? ` (importance: ${m.importance})` : ""}`
      )
      .join("\n");

    const retroContext = retrospectives
      .slice(0, 5)
      .map(
        (r: any) =>
          `• Wins: ${r.wins?.join(", ") || "none"} | Issues: ${r.issues?.join(", ") || "none"} | Key: ${r.keyLearning || "n/a"}`
      )
      .join("\n");

    // 3. Use AI to enhance the prompt
    const endpoint =
      process.env.DEEPSEEK_ENDPOINT || process.env.GROK_ENDPOINT || "";
    const apiKey =
      process.env.DEEPSEEK_API_KEY || process.env.GROK_API_KEY || "";

    if (!endpoint || !apiKey) return args.originalPrompt;

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "DeepSeek-V3-0324",
          messages: [
            {
              role: "system",
              content: `You are CodeForge's Prompt Evolver — your job is to enhance a user's prompt using learnings from past missions.

RULES:
- Keep the user's original intent intact
- Add specificity based on what worked/failed before
- Include architectural guidance from past patterns
- Mention pitfalls to avoid from retrospectives
- Be concise — enhance, don't bloat
- Return ONLY the enhanced prompt, nothing else

PAST LEARNINGS:
${memoryContext || "No memories yet."}

RETROSPECTIVES:
${retroContext || "No retrospectives yet."}`,
            },
            {
              role: "user",
              content: `Enhance this prompt using the learnings above:\n\n"${args.originalPrompt}"`,
            },
          ],
          temperature: 0.2,
          max_tokens: 2048,
        }),
      });

      if (!resp.ok) return args.originalPrompt;

      const data = await resp.json();
      const enhanced =
        data.choices?.[0]?.message?.content?.trim() || args.originalPrompt;

      // 4. Store a memory about this enhancement
      await ctx.runMutation(internal.promptEvolver.recordEnhancement, {
        projectId: args.projectId,
        original: args.originalPrompt,
        enhanced,
      });

      return enhanced;
    } catch {
      return args.originalPrompt;
    }
  },
});

// ─── Run Retrospective (called after mission completes) ─────────

export const runRetrospective = internalAction({
  args: {
    missionId: v.id("missions"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Fetch mission details
    const mission = await ctx.runQuery(internal.promptEvolver.getMission, {
      missionId: args.missionId,
    });

    if (!mission) return;

    // Fetch agent thoughts and tool calls for analysis
    const thoughts = await ctx.runQuery(
      internal.promptEvolver.getMissionThoughts,
      { missionId: args.missionId }
    );

    const endpoint =
      process.env.DEEPSEEK_ENDPOINT || process.env.GROK_ENDPOINT || "";
    const apiKey =
      process.env.DEEPSEEK_API_KEY || process.env.GROK_API_KEY || "";

    if (!endpoint || !apiKey) return;

    const thoughtSummary = thoughts
      .slice(0, 20)
      .map((t: any) => `[${t.role}] ${t.content?.slice(0, 200)}`)
      .join("\n");

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "DeepSeek-V3-0324",
          messages: [
            {
              role: "system",
              content: `You are CodeForge's Retrospective Analyst. After a mission completes, you analyze what happened and extract learnings.

Respond in this JSON format:
{
  "wins": ["list of things that went well"],
  "issues": ["list of problems or mistakes"],
  "keyLearning": "single most important insight",
  "patterns": ["reusable patterns discovered"],
  "avoidNext": ["things to avoid next time"]
}`,
            },
            {
              role: "user",
              content: `Mission prompt: "${mission.prompt}"\nStatus: ${mission.status}\n\nAgent thoughts:\n${thoughtSummary}\n\nAnalyze this mission and extract learnings.`,
            },
          ],
          temperature: 0.1,
          max_tokens: 1024,
        }),
      });

      if (!resp.ok) return;

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || "";

      // Try to parse JSON response
      let retro: any = {};
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          retro = JSON.parse(jsonMatch[0]);
        }
      } catch {
        retro = { keyLearning: content.slice(0, 500), wins: [], issues: [] };
      }

      // Save retrospective
      await ctx.runMutation(internal.promptEvolver.saveRetrospective, {
        missionId: args.missionId,
        projectId: args.projectId,
        wins: retro.wins || [],
        issues: retro.issues || [],
        keyLearning: retro.keyLearning || "",
        patterns: retro.patterns || [],
        avoidNext: retro.avoidNext || [],
      });

      // Save key learnings as memories
      if (retro.keyLearning) {
        await ctx.runMutation(internal.promptEvolver.saveMemory, {
          projectId: args.projectId,
          category: "retrospective",
          content: retro.keyLearning,
          importance: 8,
        });
      }

      for (const pattern of (retro.patterns || []).slice(0, 3)) {
        await ctx.runMutation(internal.promptEvolver.saveMemory, {
          projectId: args.projectId,
          category: "pattern",
          content: pattern,
          importance: 6,
        });
      }

      for (const issue of (retro.avoidNext || []).slice(0, 3)) {
        await ctx.runMutation(internal.promptEvolver.saveMemory, {
          projectId: args.projectId,
          category: "pitfall",
          content: `AVOID: ${issue}`,
          importance: 9,
        });
      }
    } catch {
      // Retrospective is best-effort — don't fail the mission
    }
  },
});

// ─── Internal Mutations ─────────────────────────────────────────

export const recordEnhancement = internalMutation({
  args: {
    projectId: v.id("projects"),
    original: v.string(),
    enhanced: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("memories", {
      projectId: args.projectId,
      category: "enhancement",
      content: `Original: "${args.original.slice(0, 100)}..." → Enhanced with past learnings`,
      importance: 3,
      isActive: true,
    });
  },
});

export const saveRetrospective = internalMutation({
  args: {
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    wins: v.array(v.string()),
    issues: v.array(v.string()),
    keyLearning: v.string(),
    patterns: v.array(v.string()),
    avoidNext: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("retrospectives", {
      missionId: args.missionId,
      projectId: args.projectId,
      wins: args.wins,
      issues: args.issues,
      keyLearning: args.keyLearning,
      completedAt: Date.now(),
    });
  },
});

export const saveMemory = internalMutation({
  args: {
    projectId: v.id("projects"),
    category: v.string(),
    content: v.string(),
    importance: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("memories", {
      projectId: args.projectId,
      category: args.category,
      content: args.content,
      importance: args.importance,
      isActive: true,
    });
  },
});

export const getMission = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db.get(missionId);
  },
});

export const getMissionThoughts = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("agentThoughts")
      .filter((q) => q.eq(q.field("missionId"), missionId))
      .order("asc")
      .take(30);
  },
});
