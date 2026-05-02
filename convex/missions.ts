/**
 * MISSIONS — Direct queries for mission data.
 *
 * Supplements the swarm module with simple CRUD operations.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";

export const get = query({
  args: { missionId: v.id("missions") },
  returns: v.union(
    v.object({
      _id: v.id("missions"),
      _creationTime: v.number(),
      userId: v.id("users"),
      projectId: v.id("projects"),
      sessionId: v.id("sessions"),
      prompt: v.string(),
      status: v.string(),
      plan: v.optional(v.string()),
      totalAgentsSpawned: v.optional(v.number()),
      totalFilesCreated: v.optional(v.number()),
      totalCost: v.optional(v.number()),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, { missionId }) => {
    return await ctx.db.get(missionId);
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("missions"),
      _creationTime: v.number(),
      userId: v.id("users"),
      projectId: v.id("projects"),
      sessionId: v.id("sessions"),
      prompt: v.string(),
      status: v.string(),
      plan: v.optional(v.string()),
      totalAgentsSpawned: v.optional(v.number()),
      totalFilesCreated: v.optional(v.number()),
      totalCost: v.optional(v.number()),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("missions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(20);
  },
});
