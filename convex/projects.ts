import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      userId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      githubRepo: v.optional(v.string()),
      githubBranch: v.optional(v.string()),
      lastSyncedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return projects.map(({ githubToken, ...p }) => p);
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      userId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      githubRepo: v.optional(v.string()),
      githubBranch: v.optional(v.string()),
      lastSyncedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) return null;
    const { githubToken, ...p } = project;
    return p;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    githubBranch: v.optional(v.string()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("projects", {
      userId,
      name: args.name,
      description: args.description,
      githubRepo: args.githubRepo,
      githubBranch: args.githubBranch || "main",
    });
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    // Delete all files
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const file of files) {
      await ctx.db.delete(file._id);
    }
    await ctx.db.delete(projectId);
    return null;
  },
});
