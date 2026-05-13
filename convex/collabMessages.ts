/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE — COLLAB MESSAGES
 * Real-time pair-programming chat, persisted in Convex.
 * ═══════════════════════════════════════════════════════════════════
 */
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit }) => {
    const msgs = await ctx.db
      .query("collabMessages")
      .withIndex("by_project_time", (q) => q.eq("projectId", projectId))
      .order("asc")
      .take(limit ?? 100);
    return msgs;
  },
});

export const send = mutation({
  args: {
    projectId: v.id("projects"),
    text: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, { projectId, text, displayName }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("collabMessages", {
      projectId,
      userId: user._id,
      displayName,
      text: text.slice(0, 2000),
      sentAt: Date.now(),
    });
  },
});

export const clearProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const msgs = await ctx.db
      .query("collabMessages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    await Promise.all(msgs.map((m) => ctx.db.delete(m._id)));
    return msgs.length;
  },
});
