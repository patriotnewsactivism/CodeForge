import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      sessionId: v.id("sessions"),
      role: v.union(
        v.literal("user"),
        v.literal("assistant"),
        v.literal("system")
      ),
      content: v.string(),
      model: v.optional(v.string()),
      inputTokens: v.optional(v.number()),
      outputTokens: v.optional(v.number()),
      cost: v.optional(v.number()),
      fileContext: v.optional(v.string()),
    })
  ),
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
      v.literal("system")
    ),
    model: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
    fileContext: v.optional(v.string()),
  },
  returns: v.id("messages"),
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
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      cost: args.cost,
      fileContext: args.fileContext,
    });
  },
});

export const clearSession = mutation({
  args: { sessionId: v.id("sessions") },
  returns: v.null(),
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
    // Reset cost tracking
    await ctx.db.patch(sessionId, {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
    });
    return null;
  },
});
