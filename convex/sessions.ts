import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("sessions"),
      _creationTime: v.number(),
      userId: v.id("users"),
      projectId: v.optional(v.id("projects")),
      name: v.string(),
      model: v.string(),
      totalInputTokens: v.optional(v.number()),
      totalOutputTokens: v.optional(v.number()),
      totalCost: v.optional(v.number()),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getActive = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("sessions"),
      _creationTime: v.number(),
      userId: v.id("users"),
      projectId: v.optional(v.id("projects")),
      name: v.string(),
      model: v.string(),
      totalInputTokens: v.optional(v.number()),
      totalOutputTokens: v.optional(v.number()),
      totalCost: v.optional(v.number()),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    model: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.id("sessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Deactivate other sessions
    const active = await ctx.db
      .query("sessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .collect();
    for (const s of active) {
      await ctx.db.patch(s._id, { isActive: false });
    }
    return await ctx.db.insert("sessions", {
      userId,
      projectId: args.projectId,
      name: args.name,
      model: args.model,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      isActive: true,
    });
  },
});

export const updateModel = mutation({
  args: {
    sessionId: v.id("sessions"),
    model: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { sessionId, model }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(sessionId, { model });
    return null;
  },
});

export const addCost = mutation({
  args: {
    sessionId: v.id("sessions"),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cost: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { sessionId, inputTokens, outputTokens, cost }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    await ctx.db.patch(sessionId, {
      totalInputTokens: (session.totalInputTokens || 0) + inputTokens,
      totalOutputTokens: (session.totalOutputTokens || 0) + outputTokens,
      totalCost: (session.totalCost || 0) + cost,
    });
    return null;
  },
});
