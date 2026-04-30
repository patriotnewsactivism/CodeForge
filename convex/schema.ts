import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  // Projects (GitHub repos or local projects)
  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()), // "owner/repo"
    githubBranch: v.optional(v.string()),
    githubToken: v.optional(v.string()), // encrypted PAT
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "name"]),

  // Files within a project
  files: defineTable({
    projectId: v.id("projects"),
    path: v.string(), // e.g. "src/App.tsx"
    name: v.string(), // filename
    type: v.union(v.literal("file"), v.literal("folder")),
    content: v.optional(v.string()), // file content (null for folders)
    language: v.optional(v.string()), // detected language
    size: v.optional(v.number()),
    githubSha: v.optional(v.string()), // for tracking changes
    isModified: v.optional(v.boolean()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_path", ["projectId", "path"]),

  // Chat sessions
  sessions: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    name: v.string(),
    model: v.string(), // current model
    totalInputTokens: v.optional(v.number()),
    totalOutputTokens: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  // Chat messages
  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
    fileContext: v.optional(v.string()), // file path that was referenced
  }).index("by_session", ["sessionId"]),

  // Cost tracking entries
  costEntries: defineTable({
    userId: v.id("users"),
    sessionId: v.optional(v.id("sessions")),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cost: v.number(),
    operation: v.string(), // "chat", "code_review", etc.
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"]),

  // AI Suggestions
  suggestions: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    category: v.string(), // "feature", "fix", "performance", "style", "security"
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
    prompt: v.string(), // The prompt to send to AI when user clicks "Do it"
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("dismissed")
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"]),

  // Multi-Agent Tasks
  agentTasks: defineTable({
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    parentTaskId: v.optional(v.string()), // orchestrator grouping id
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    model: v.string(),
    result: v.optional(v.string()),
    filesCreated: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    agentIndex: v.number(), // 0-based agent index for display
  })
    .index("by_project", ["projectId"])
    .index("by_session", ["sessionId"])
    .index("by_parent", ["parentTaskId"]),

  // GitHub connection settings
  githubSettings: defineTable({
    userId: v.id("users"),
    token: v.string(), // Personal Access Token
    username: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_user", ["userId"]),
});

export default schema;
