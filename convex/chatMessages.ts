import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) return [];
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
  },
});

export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool_summary"),
    ),
    model: v.optional(v.string()),
    cost: v.optional(v.number()),
    missionId: v.optional(v.id("missions")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId)
      throw new Error("Session not found");
    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      model: args.model,
      cost: args.cost,
      missionId: args.missionId,
    });
  },
});

export const clearSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) throw new Error("Not found");
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.patch(sessionId, { totalCost: 0 });
  },
});
