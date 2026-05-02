import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Detect language from file extension
function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    r: "r",
    sql: "sql",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    dockerfile: "dockerfile",
    toml: "toml",
    ini: "ini",
    env: "plaintext",
    txt: "plaintext",
    svg: "xml",
    vue: "vue",
    svelte: "svelte",
  };
  return langMap[ext] || "plaintext";
}

export const listByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("files"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      path: v.string(),
      name: v.string(),
      type: v.union(v.literal("file"), v.literal("folder")),
      language: v.optional(v.string()),
      size: v.optional(v.number()),
      isModified: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) return [];
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return files.map(({ content, githubSha, ...f }) => f);
  },
});

// List files with content for preview
export const listWithContent = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("files"),
      path: v.string(),
      name: v.string(),
      type: v.union(v.literal("file"), v.literal("folder")),
      content: v.optional(v.union(v.string(), v.null())),
      language: v.optional(v.union(v.string(), v.null())),
    })
  ),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) return [];
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return files.map((f) => ({
      _id: f._id,
      path: f.path,
      name: f.name,
      type: f.type,
      content: f.content,
      language: f.language,
    }));
  },
});

export const getContent = query({
  args: { fileId: v.id("files") },
  returns: v.union(
    v.object({
      _id: v.id("files"),
      path: v.string(),
      name: v.string(),
      content: v.union(v.string(), v.null()),
      language: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { fileId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const file = await ctx.db.get(fileId);
    if (!file) return null;
    const project = await ctx.db.get(file.projectId);
    if (!project || project.userId !== userId) return null;
    return {
      _id: file._id,
      path: file.path,
      name: file.name,
      content: file.content ?? null,
      language: file.language ?? null,
    };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    name: v.string(),
    type: v.union(v.literal("file"), v.literal("folder")),
    content: v.optional(v.string()),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    return await ctx.db.insert("files", {
      projectId: args.projectId,
      path: args.path,
      name: args.name,
      type: args.type,
      content: args.content || "",
      language: args.type === "file" ? detectLanguage(args.name) : undefined,
      size: args.content?.length || 0,
      isModified: false,
    });
  },
});

export const updateContent = mutation({
  args: {
    fileId: v.id("files"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { fileId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const file = await ctx.db.get(fileId);
    if (!file) throw new Error("Not found");
    const project = await ctx.db.get(file.projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(fileId, {
      content,
      size: content.length,
      isModified: true,
    });
    return null;
  },
});

export const remove = mutation({
  args: { fileId: v.id("files") },
  returns: v.null(),
  handler: async (ctx, { fileId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const file = await ctx.db.get(fileId);
    if (!file) throw new Error("Not found");
    const project = await ctx.db.get(file.projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");

    if (file.type === "folder") {
      // Delete all files under this folder
      const children = await ctx.db
        .query("files")
        .withIndex("by_project", (q) => q.eq("projectId", file.projectId))
        .collect();
      const prefix = file.path + "/";
      for (const child of children) {
        if (child.path.startsWith(prefix)) {
          await ctx.db.delete(child._id);
        }
      }
    }
    await ctx.db.delete(fileId);
    return null;
  },
});

export const rename = mutation({
  args: {
    fileId: v.id("files"),
    newName: v.string(),
    newPath: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { fileId, newName, newPath }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const file = await ctx.db.get(fileId);
    if (!file) throw new Error("Not found");
    const project = await ctx.db.get(file.projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");

    const oldPath = file.path;
    await ctx.db.patch(fileId, {
      name: newName,
      path: newPath,
      language: file.type === "file" ? detectLanguage(newName) : undefined,
    });

    // If folder, update children paths
    if (file.type === "folder") {
      const children = await ctx.db
        .query("files")
        .withIndex("by_project", (q) => q.eq("projectId", file.projectId))
        .collect();
      const prefix = oldPath + "/";
      for (const child of children) {
        if (child.path.startsWith(prefix)) {
          await ctx.db.patch(child._id, {
            path: newPath + "/" + child.path.slice(prefix.length),
          });
        }
      }
    }
    return null;
  },
});

// Bulk insert files (for GitHub import)
export const bulkInsert = mutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(
      v.object({
        path: v.string(),
        name: v.string(),
        type: v.union(v.literal("file"), v.literal("folder")),
        content: v.optional(v.string()),
        size: v.optional(v.number()),
        githubSha: v.optional(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, files }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");

    for (const f of files) {
      await ctx.db.insert("files", {
        projectId,
        path: f.path,
        name: f.name,
        type: f.type,
        content: f.content || "",
        language: f.type === "file" ? detectLanguage(f.name) : undefined,
        size: f.size || f.content?.length || 0,
        githubSha: f.githubSha,
        isModified: false,
      });
    }
    return null;
  },
});

// Internal mutation for AI-generated files (called from actions)
export const createFromAI = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    name: v.string(),
    content: v.string(),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    // Check if file already exists at this path
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const existingFile = existing.find((f) => f.path === args.path);
    if (existingFile) {
      // Update existing file
      await ctx.db.patch(existingFile._id, {
        content: args.content,
        size: args.content.length,
        isModified: true,
      });
      return existingFile._id;
    }

    // Ensure parent folders exist
    const parts = args.path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const folderPath = parts.slice(0, i).join("/");
      const folderName = parts[i - 1];
      const folderExists = existing.find(
        (f) => f.path === folderPath && f.type === "folder"
      );
      if (!folderExists) {
        await ctx.db.insert("files", {
          projectId: args.projectId,
          path: folderPath,
          name: folderName,
          type: "folder",
          content: "",
          size: 0,
          isModified: false,
        });
      }
    }

    return await ctx.db.insert("files", {
      projectId: args.projectId,
      path: args.path,
      name: args.name,
      type: "file",
      content: args.content,
      language: detectLanguage(args.name),
      size: args.content.length,
      isModified: false,
    });
  },
});

// ─── Internal versions for scheduled actions (no auth check) ─────────────────
// Used by swarm agents and multi-agent tasks that run as scheduled actions

export const listWithContentInternal = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("files"),
      path: v.string(),
      name: v.string(),
      type: v.union(v.literal("file"), v.literal("folder")),
      content: v.optional(v.union(v.string(), v.null())),
      language: v.optional(v.union(v.string(), v.null())),
    })
  ),
  handler: async (ctx, { projectId }) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return files.map((f) => ({
      _id: f._id,
      path: f.path,
      name: f.name,
      type: f.type,
      content: f.content,
      language: f.language,
    }));
  },
});

export const bulkInsertInternal = mutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(
      v.object({
        path: v.string(),
        name: v.string(),
        type: v.union(v.literal("file"), v.literal("folder")),
        content: v.optional(v.string()),
        size: v.optional(v.number()),
        githubSha: v.optional(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, files }) => {
    for (const f of files) {
      await ctx.db.insert("files", {
        projectId,
        path: f.path,
        name: f.name,
        type: f.type,
        content: f.content || "",
        language: f.type === "file" ? detectLanguage(f.name) : undefined,
        size: f.size || f.content?.length || 0,
        githubSha: f.githubSha,
        isModified: false,
      });
    }
    return null;
  },
});
