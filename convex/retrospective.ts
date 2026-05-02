/**
 * SELF-IMPROVEMENT LOOP — Retrospective Agent
 *
 * After every mission completes, a Retrospective agent analyzes:
 * - What went right
 * - What went wrong
 * - What patterns emerged
 * - What to do differently next time
 *
 * Findings get stored as memories, making the swarm smarter over time.
 * The more you use CodeForge, the better it performs.
 */
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Type helpers for Convex strict mode
type AgentRun = { _id: string; role: string; title: string; status: string; model: string; startedAt?: number; completedAt?: number; filesCreated?: number; filesModified?: number; cost?: number; error?: string; parentAgentId?: string };
type ActivityLogEntry = { type: string; agentRole: string; title: string; detail?: string; filePath?: string };

declare const process: { env: Record<string, string | undefined> };

// ─── Queries ────────────────────────────────────────────────────

// Get retrospective for a specific mission
export const getByMission = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    const results = await ctx.db
      .query("retrospectives")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .collect();
    return results[0] || null;
  },
});

// Get all retrospectives for a project (history of learnings)
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("retrospectives")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

// Get improvement trend over time
export const getScoreTrend = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const retros = await ctx.db
      .query("retrospectives")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return retros
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        missionId: r.missionId,
        score: r.score,
        memoriesCreated: r.memoriesCreated || 0,
        createdAt: r.createdAt,
      }));
  },
});

// ─── Mutations ──────────────────────────────────────────────────

export const store = mutation({
  args: {
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    summary: v.string(),
    whatWorked: v.array(v.string()),
    whatFailed: v.array(v.string()),
    improvements: v.array(v.string()),
    patternsFound: v.array(v.string()),
    score: v.number(),
    agentPerformance: v.optional(v.string()),
    memoriesCreated: v.optional(v.number()),
    model: v.string(),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("retrospectives", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ─── Actions ────────────────────────────────────────────────────

/**
 * Run a retrospective analysis on a completed mission.
 * Called automatically when a mission finishes.
 *
 * 1. Gathers all agent run data for the mission
 * 2. Asks an AI to analyze outcomes
 * 3. Stores the retrospective
 * 4. Extracts memories from the analysis
 * 5. Logs to activity feed
 */
export const runRetrospective = action({
  args: {
    missionId: v.id("missions"),
    projectId: v.id("projects"),
  },
  returns: v.object({
    score: v.number(),
    memoriesCreated: v.number(),
    summary: v.string(),
  }),
  handler: async (ctx, { missionId, projectId }) => {
    // 1. Gather all data about the mission
    const agentRuns = await ctx.runQuery(api.swarm.listAgentRuns, {
      missionId,
    });
    const activityLog = await ctx.runQuery(api.swarm.getActivityLog, {
      missionId,
      limit: 200,
    });

    // Get previous retrospectives to compare
    const pastRetros = await ctx.runQuery(api.retrospective.listByProject, {
      projectId,
    });
    const lastScore =
      pastRetros.length > 0
        ? pastRetros[pastRetros.length - 1].score
        : null;

    // Build the analysis prompt
    const agentSummary = agentRuns
      .map((a: AgentRun) => {
        const duration =
          a.completedAt && a.startedAt
            ? `${((a.completedAt - a.startedAt) / 1000).toFixed(1)}s`
            : "unknown";
        return `- [${a.role}] "${a.title}" | Status: ${a.status} | Model: ${a.model} | Duration: ${duration} | Files: ${a.filesCreated || 0} created, ${a.filesModified || 0} modified | Cost: $${(a.cost || 0).toFixed(4)} | ${a.error ? `ERROR: ${a.error.slice(0, 100)}` : "OK"}`;
      })
      .join("\n");

    const errorLogs = activityLog
      .filter((l: ActivityLogEntry) => l.type === "error")
      .map((l: ActivityLogEntry) => `- [${l.agentRole}] ${l.title}: ${l.detail?.slice(0, 200) || "no details"}`)
      .join("\n");

    const fileLogs = activityLog
      .filter((l: ActivityLogEntry) => l.type === "file_create" || l.type === "file_modify")
      .map((l: ActivityLogEntry) => `- ${l.type}: ${l.filePath || l.title}`)
      .join("\n");

    // Use Grok for retrospectives — best at reasoning
    const endpoint = process.env.GROK_ENDPOINT || process.env.DEEPSEEK_ENDPOINT || "";
    const apiKey = process.env.GROK_API_KEY || process.env.DEEPSEEK_API_KEY || "";
    const modelId = process.env.GROK_ENDPOINT
      ? "grok-4-1-fast-reasoning"
      : "DeepSeek-V3-0324";

    if (!endpoint || !apiKey) {
      return { score: 50, memoriesCreated: 0, summary: "No AI model available for retrospective." };
    }

    const retroPrompt = `You are the Retrospective Agent for CodeForge. Your job is to analyze a completed autonomous coding mission and extract actionable insights.

## Mission Data

### Agent Runs (${agentRuns.length} total)
${agentSummary || "(no agent data)"}

### Errors Encountered
${errorLogs || "(no errors)"}

### Files Created/Modified
${fileLogs || "(no file activity)"}

### Mission Stats
- Total agents spawned: ${agentRuns.length}
- Successful: ${agentRuns.filter((a: AgentRun) => a.status === "completed").length}
- Failed: ${agentRuns.filter((a: AgentRun) => a.status === "failed").length}
- Total cost: $${agentRuns.reduce((sum: number, a: AgentRun) => sum + (a.cost || 0), 0).toFixed(4)}
${lastScore !== null ? `- Previous mission score: ${lastScore}/100` : "- First mission (no baseline)"}

## Your Analysis

Provide a thorough retrospective. Return ONLY valid JSON:

{
  "summary": "2-3 sentence overview of what happened",
  "score": 0-100,
  "whatWorked": ["specific thing 1", "specific thing 2"],
  "whatFailed": ["specific thing 1", "specific thing 2"],
  "improvements": ["actionable improvement 1", "actionable improvement 2"],
  "patternsFound": ["pattern 1", "pattern 2"],
  "agentPerformance": {
    "best": { "role": "coder", "reason": "completed fastest with 0 errors" },
    "worst": { "role": "tester", "reason": "failed to run" },
    "modelEfficiency": { "model": "best performing model ID" }
  },
  "memories": [
    {
      "category": "pattern|antipattern|convention|bugfix|architecture|dependency|performance|security|general",
      "title": "Short label",
      "content": "Detailed learning (max 300 chars)",
      "confidence": 0.5-0.9,
      "tags": ["tag1"]
    }
  ]
}

Be specific and actionable. Don't be generic. Score honestly — 50 is average, 80+ is great, below 30 is bad.`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: retroPrompt },
            { role: "user", content: "Run the retrospective analysis now." },
          ],
          max_tokens: 4096,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Retrospective AI failed:", errText);
        return { score: 50, memoriesCreated: 0, summary: "Retrospective AI unavailable." };
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      let content = data.choices[0]?.message?.content?.trim() || "{}";
      if (content.startsWith("```")) {
        content = content
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }

      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const costPerM = process.env.GROK_ENDPOINT ? 0.5 : 0.42;
      const cost =
        (inputTokens / 1_000_000) * 0.2 +
        (outputTokens / 1_000_000) * costPerM;

      let analysis: {
        summary: string;
        score: number;
        whatWorked: string[];
        whatFailed: string[];
        improvements: string[];
        patternsFound: string[];
        agentPerformance?: Record<string, unknown>;
        memories?: Array<{
          category: string;
          title: string;
          content: string;
          confidence: number;
          tags?: string[];
        }>;
      };

      try {
        analysis = JSON.parse(content);
      } catch {
        analysis = {
          summary: "Failed to parse retrospective analysis.",
          score: 50,
          whatWorked: [],
          whatFailed: ["Retrospective parsing failed"],
          improvements: ["Fix retrospective JSON output"],
          patternsFound: [],
        };
      }

      // 2. Store the retrospective
      const memoriesFromAnalysis = analysis.memories || [];
      await ctx.runMutation(api.retrospective.store, {
        missionId,
        projectId,
        summary: analysis.summary || "No summary",
        whatWorked: analysis.whatWorked || [],
        whatFailed: analysis.whatFailed || [],
        improvements: analysis.improvements || [],
        patternsFound: analysis.patternsFound || [],
        score: Math.max(0, Math.min(100, analysis.score || 50)),
        agentPerformance: analysis.agentPerformance
          ? JSON.stringify(analysis.agentPerformance)
          : undefined,
        memoriesCreated: memoriesFromAnalysis.length,
        model: modelId,
        cost,
      });

      // 3. Store extracted memories
      let memoriesStored = 0;
      for (const mem of memoriesFromAnalysis.slice(0, 8)) {
        try {
          await ctx.runMutation(api.memory.store, {
            projectId,
            category: mem.category,
            title: mem.title,
            content: mem.content,
            confidence: Math.max(0.1, Math.min(0.95, mem.confidence)),
            sourceAgentRole: "retrospective",
            sourceMissionId: missionId,
            tags: mem.tags,
          });
          memoriesStored++;
        } catch (e) {
          console.error("Failed to store retro memory:", e);
        }
      }

      // 4. Store improvement suggestions as memories too
      for (const improvement of (analysis.improvements || []).slice(0, 3)) {
        try {
          await ctx.runMutation(api.memory.store, {
            projectId,
            category: "general",
            title: `Improvement: ${improvement.slice(0, 70)}`,
            content: improvement,
            confidence: 0.7,
            sourceAgentRole: "retrospective",
            sourceMissionId: missionId,
            tags: ["improvement", "self-improvement"],
          });
          memoriesStored++;
        } catch (e) {
          console.error("Failed to store improvement memory:", e);
        }
      }

      // 5. Log to activity feed if there's an active agent
      const rootAgent = agentRuns.find((a: AgentRun) => !a.parentAgentId);
      if (rootAgent) {
        try {
          await ctx.runMutation(api.swarm.logActivity, {
            missionId,
            agentRunId: rootAgent._id,
            type: "review",
            title: `🔄 Retrospective: Score ${analysis.score}/100 — ${memoriesStored} new memories stored`,
            detail: analysis.summary,
            agentRole: "retrospective",
            agentModel: modelId,
          });
        } catch (e) {
          console.error("Failed to log retrospective activity:", e);
        }
      }

      return {
        score: analysis.score || 50,
        memoriesCreated: memoriesStored,
        summary: analysis.summary || "Retrospective complete.",
      };
    } catch (e) {
      console.error("Retrospective failed:", e);
      return { score: 50, memoriesCreated: 0, summary: "Retrospective failed." };
    }
  },
});
