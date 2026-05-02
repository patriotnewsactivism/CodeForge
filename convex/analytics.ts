/**
 * ANALYTICS — Project-level metrics and insights.
 *
 * Aggregates mission history, cost data, agent performance,
 * and model usage into dashboard-ready queries.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";

/** Overall project stats: missions, costs, agents, files touched. */
export const getProjectStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }): Promise<{
    totalMissions: number;
    completedMissions: number;
    failedMissions: number;
    activeMissions: number;
    totalAgents: number;
    totalCost: number;
    totalFilesCreated: number;
    avgMissionDuration: number;
    avgAgentsPerMission: number;
  }> => {
    const missions = await ctx.db
      .query("missions")
      .withIndex("by_project", q => q.eq("projectId", projectId))
      .collect();

    const completed = missions.filter(m => m.status === "completed");
    const failed = missions.filter(m => m.status === "failed");
    const active = missions.filter(m => m.status === "running" || m.status === "planning");

    const agents = await ctx.db
      .query("agentRuns")
      .withIndex("by_project", q => q.eq("projectId", projectId))
      .collect();

    const totalCost = missions.reduce((s, m) => s + (m.totalCost || 0), 0)
      + agents.reduce((s, a) => s + (a.cost || 0), 0);

    const totalFiles = missions.reduce((s, m) => s + (m.totalFilesCreated || 0), 0);

    const durations = completed
      .filter(m => m.completedAt && m.startedAt)
      .map(m => (m.completedAt! - m.startedAt) / 1000);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const avgAgents = missions.length > 0
      ? agents.length / missions.length
      : 0;

    return {
      totalMissions: missions.length,
      completedMissions: completed.length,
      failedMissions: failed.length,
      activeMissions: active.length,
      totalAgents: agents.length,
      totalCost,
      totalFilesCreated: totalFiles,
      avgMissionDuration: Math.round(avgDuration),
      avgAgentsPerMission: Math.round(avgAgents * 10) / 10,
    };
  },
});

/** Per-model usage breakdown. */
export const getModelUsage = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }): Promise<Array<{
    model: string;
    runs: number;
    completed: number;
    failed: number;
    totalCost: number;
    avgDuration: number;
  }>> => {
    const agents = await ctx.db
      .query("agentRuns")
      .withIndex("by_project", q => q.eq("projectId", projectId))
      .collect();

    const byModel = new Map<string, typeof agents>();
    for (const a of agents) {
      const list = byModel.get(a.model) || [];
      list.push(a);
      byModel.set(a.model, list);
    }

    const result: Array<{
      model: string;
      runs: number;
      completed: number;
      failed: number;
      totalCost: number;
      avgDuration: number;
    }> = [];

    for (const [model, runs] of byModel) {
      const done = runs.filter(r => r.status === "completed");
      const fail = runs.filter(r => r.status === "failed");
      const cost = runs.reduce((s, r) => s + (r.cost || 0), 0);
      const durations = done
        .filter(r => r.startedAt && r.completedAt)
        .map(r => (r.completedAt! - r.startedAt!) / 1000);
      const avgD = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      result.push({
        model,
        runs: runs.length,
        completed: done.length,
        failed: fail.length,
        totalCost: cost,
        avgDuration: Math.round(avgD),
      });
    }

    return result.sort((a, b) => b.runs - a.runs);
  },
});

/** Per-role performance breakdown. */
export const getRolePerformance = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }): Promise<Array<{
    role: string;
    runs: number;
    successRate: number;
    totalCost: number;
    avgDuration: number;
    filesCreated: number;
  }>> => {
    const agents = await ctx.db
      .query("agentRuns")
      .withIndex("by_project", q => q.eq("projectId", projectId))
      .collect();

    const byRole = new Map<string, typeof agents>();
    for (const a of agents) {
      const list = byRole.get(a.role) || [];
      list.push(a);
      byRole.set(a.role, list);
    }

    const result: Array<{
      role: string;
      runs: number;
      successRate: number;
      totalCost: number;
      avgDuration: number;
      filesCreated: number;
    }> = [];

    for (const [role, runs] of byRole) {
      const finished = runs.filter(r => r.status === "completed" || r.status === "failed");
      const done = runs.filter(r => r.status === "completed");
      const successRate = finished.length > 0
        ? Math.round((done.length / finished.length) * 100)
        : 0;
      const cost = runs.reduce((s, r) => s + (r.cost || 0), 0);
      const files = runs.reduce((s, r) => s + (r.filesCreated || 0), 0);
      const durations = done
        .filter(r => r.startedAt && r.completedAt)
        .map(r => (r.completedAt! - r.startedAt!) / 1000);
      const avgD = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      result.push({
        role,
        runs: runs.length,
        successRate,
        totalCost: cost,
        avgDuration: Math.round(avgD),
        filesCreated: files,
      });
    }

    return result.sort((a, b) => b.runs - a.runs);
  },
});

/** Recent mission history (last 20). */
export const getRecentMissions = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const missions = await ctx.db
      .query("missions")
      .withIndex("by_project", q => q.eq("projectId", projectId))
      .order("desc")
      .take(20);

    return missions.map(m => ({
      _id: m._id,
      prompt: m.prompt,
      status: m.status,
      totalAgentsSpawned: m.totalAgentsSpawned || 0,
      totalCost: m.totalCost || 0,
      startedAt: m.startedAt,
      completedAt: m.completedAt,
      duration: m.completedAt
        ? Math.round((m.completedAt - m.startedAt) / 1000)
        : null,
    }));
  },
});
