/**
 * ═══════════════════════════════════════════════════════════════════
 * INTELLIGENCE LAYER — Queries for memories, retrospectives, agents
 * ═══════════════════════════════════════════════════════════════════
 *
 * Powers the Agent Memory Dashboard, Mission Timeline, and
 * self-improvement analytics.
 */
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ─── MEMORIES ─────────────────────────────────────────────────────

export const listMemories = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("memories")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(100);
  },
});

export const getActiveMemories = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("memories")
      .withIndex("by_project_active", (q) =>
        q.eq("projectId", projectId).eq("isActive", true)
      )
      .order("desc")
      .take(50);
  },
});

export const toggleMemory = mutation({
  args: { memoryId: v.id("memories"), isActive: v.boolean() },
  handler: async (ctx, { memoryId, isActive }) => {
    await ctx.db.patch(memoryId, { isActive });
  },
});

export const deleteMemory = mutation({
  args: { memoryId: v.id("memories") },
  handler: async (ctx, { memoryId }) => {
    await ctx.db.delete(memoryId);
  },
});

// ─── RETROSPECTIVES ──────────────────────────────────────────────

export const listRetrospectives = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("retrospectives")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(30);
  },
});

export const getRetrospective = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("retrospectives")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .first();
  },
});

// ─── AGENT RUNS ──────────────────────────────────────────────────

export const listAgentRuns = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .order("desc")
      .collect();
  },
});

export const listAgentRunsByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(50);
  },
});

// ─── TOOL CALLS ──────────────────────────────────────────────────

export const listToolCalls = query({
  args: { agentRunId: v.id("agentRuns") },
  handler: async (ctx, { agentRunId }) => {
    return await ctx.db
      .query("toolCalls")
      .withIndex("by_agent", (q) => q.eq("agentRunId", agentRunId))
      .collect();
  },
});

// ─── AGENT THOUGHTS ──────────────────────────────────────────────

export const listThoughts = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("agentThoughts")
      .withIndex("by_mission_time", (q) => q.eq("missionId", missionId))
      .order("asc")
      .take(200);
  },
});

// ─── INTELLIGENCE STATS ──────────────────────────────────────────

export const getProjectStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const retrospectives = await ctx.db
      .query("retrospectives")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const missions = await ctx.db
      .query("missions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const agentRuns = await ctx.db
      .query("agentRuns")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const activeMemories = memories.filter((m) => m.isActive);
    const completedMissions = missions.filter((m) => m.status === "completed");
    const avgScore = retrospectives.length
      ? retrospectives.reduce((sum, r) => sum + (r.score ?? 0), 0) / retrospectives.length
      : 0;

    const totalAgents = agentRuns.length;
    const successfulAgents = agentRuns.filter((a) => a.status === "completed").length;

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    for (const m of memories) {
      const cat = m.category || "general";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }

    return {
      totalMemories: memories.length,
      activeMemories: activeMemories.length,
      totalRetrospectives: retrospectives.length,
      totalMissions: missions.length,
      completedMissions: completedMissions.length,
      totalAgentRuns: totalAgents,
      successfulAgents,
      agentSuccessRate: totalAgents ? Math.round((successfulAgents / totalAgents) * 100) : 0,
      avgRetroScore: Math.round(avgScore * 10) / 10,
      categoryBreakdown: categoryMap,
    };
  },
});

// ─── MISSION TIMELINE (detailed) ─────────────────────────────────

export const getMissionTimeline = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const missions = await ctx.db
      .query("missions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(30);

    const timeline = await Promise.all(
      missions.map(async (mission) => {
        const agents = await ctx.db
          .query("agentRuns")
          .withIndex("by_mission", (q) => q.eq("missionId", mission._id))
          .collect();

        const retro = await ctx.db
          .query("retrospectives")
          .withIndex("by_mission", (q) => q.eq("missionId", mission._id))
          .first();

        return {
          ...mission,
          agents: agents.map((a) => ({
            _id: a._id,
            role: a.role,
            title: a.title,
            status: a.status,
            model: a.model,
          })),
          agentCount: agents.length,
          successfulAgents: agents.filter((a) => a.status === "completed").length,
          retroScore: retro?.score ?? null,
          retroSummary: retro?.summary ?? retro?.keyLearning ?? null,
          memoriesCreated: retro?.memoriesCreated ?? 0,
          duration: mission.completedAt
            ? mission.completedAt - mission.startedAt
            : null,
        };
      })
    );

    return timeline;
  },
});

// ─── Agent Messages (for Debate Panel) ───────────────────────────

export const listAgentMessages = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("agentMessages")
      .withIndex("by_mission", (q) => q.eq("missionId", args.missionId))
      .order("asc")
      .take(100);

    // Enrich with agent role info
    const enriched = await Promise.all(
      msgs.map(async (msg) => {
        const fromAgent = await ctx.db.get(msg.fromAgentId);
        const toAgent = msg.toAgentId ? await ctx.db.get(msg.toAgentId) : null;
        return {
          ...msg,
          fromRole: fromAgent?.role ?? "worker",
          fromTitle: fromAgent?.title ?? "Agent",
          toRole: toAgent?.role ?? null,
          toTitle: toAgent?.title ?? null,
        };
      })
    );

    return enriched;
  },
});
