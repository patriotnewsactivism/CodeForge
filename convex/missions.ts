/**
 * MISSIONS — Public queries for mission data.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";

export const get = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db.get(missionId);
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("missions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(20);
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("missions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
  },
});
