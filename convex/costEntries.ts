import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List cost entries for a project (via missions)
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get missions for this project
    const missions = await ctx.db
      .query("missions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const missionIds = new Set(missions.map((m) => m._id));

    // Get all cost entries for this user
    const allEntries = await ctx.db
      .query("costEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);

    // Filter to entries belonging to this project's missions
    return allEntries.filter(
      (e) => e.missionId && missionIds.has(e.missionId)
    );
  },
});

// List all cost entries for the user
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("costEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
  },
});

// Record a cost entry (called from engine)
export const record = mutation({
  args: {
    missionId: v.optional(v.id("missions")),
    agentRunId: v.optional(v.id("agentRuns")),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cost: v.number(),
    operation: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("costEntries", {
      userId,
      ...args,
    });
  },
});
