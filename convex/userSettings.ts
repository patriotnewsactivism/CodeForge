/**
 * userSettings.ts — Per-user preferences for model profiles and agent config
 *
 * Stores:
 * - modelProfileId: which preset profile is active
 * - agentModels: per-role model assignments (role → modelId)
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  returns: v.union(
    v.object({
      modelProfileId: v.string(),
      agentModels: v.any(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!settings) {
      return {
        modelProfileId: "viktor-recommended",
        agentModels: {},
      };
    }

    return {
      modelProfileId: settings.modelProfileId,
      agentModels: settings.agentModels,
    };
  },
});

export const setModelProfile = mutation({
  args: {
    modelProfileId: v.string(),
    agentModels: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        modelProfileId: args.modelProfileId,
        agentModels: args.agentModels,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        modelProfileId: args.modelProfileId,
        agentModels: args.agentModels,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

// Internal helper: get agent model for a specific role (used by buildLoop)
export const getAgentModel = query({
  args: {
    role: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!settings?.agentModels) return null;

    const models = settings.agentModels as Record<string, string>;
    return models[args.role] ?? models["default"] ?? null;
  },
});
