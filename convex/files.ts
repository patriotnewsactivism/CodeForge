/**
 * File operations — public queries/mutations for the frontend.
 * The engine uses internal versions in engine.ts.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

// Alias used by frontend (IDEPage)
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const listWithContent = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const getByPath = query({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, { projectId, path }) => {
    return await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) => q.eq("projectId", projectId).eq("path", path))
      .first();
  },
});

// Alias: get a single file's full content by ID
export const getContent = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    return await ctx.db.get(fileId);
  },
});

// Alias for update by ID
export const updateContent = mutation({
  args: { fileId: v.id("files"), content: v.string() },
  handler: async (ctx, { fileId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(fileId, {
      content,
      size: content.length,
      lastModifiedBy: "user",
    });
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    name: v.string(),
    type: v.union(v.literal("file"), v.literal("folder")),
    content: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check for existing
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) => q.eq("projectId", args.projectId).eq("path", args.path))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        language: args.language,
        size: args.content?.length || 0,
        lastModifiedBy: "user",
      });
      return existing._id;
    }

    return await ctx.db.insert("files", {
      ...args,
      size: args.content?.length || 0,
      lastModifiedBy: "user",
    });
  },
});

export const update = mutation({
  args: {
    fileId: v.id("files"),
    content: v.string(),
  },
  handler: async (ctx, { fileId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(fileId, {
      content,
      size: content.length,
      lastModifiedBy: "user",
    });
  },
});

export const remove = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.delete(fileId);
  },
});

export const bulkInsert = mutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(v.object({
      path: v.string(),
      name: v.string(),
      type: v.union(v.literal("file"), v.literal("folder")),
      content: v.optional(v.string()),
      language: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { projectId, files }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let count = 0;
    for (const f of files) {
      const existing = await ctx.db
        .query("files")
        .withIndex("by_project_and_path", (q) => q.eq("projectId", projectId).eq("path", f.path))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          content: f.content,
          language: f.language,
          size: f.content?.length || 0,
        });
      } else {
        await ctx.db.insert("files", {
          projectId,
          ...f,
          size: f.content?.length || 0,
          lastModifiedBy: "user",
        });
      }
      count++;
    }
    return { inserted: count };
  },
});
