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

  // ──────────────────────────────────────────────────────────────────
  // AUTONOMOUS AGENT SWARM SYSTEM
  // ──────────────────────────────────────────────────────────────────

  // Missions — top-level user requests ("Build me a todo app")
  // A mission persists and tracks the entire autonomous build process
  missions: defineTable({
    userId: v.id("users"),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    prompt: v.string(), // Original user request
    status: v.union(
      v.literal("planning"),     // Orchestrator is decomposing
      v.literal("running"),      // Agents are working
      v.literal("paused"),       // User paused
      v.literal("completed"),    // All done
      v.literal("failed"),       // Unrecoverable error
    ),
    plan: v.optional(v.string()), // JSON: the high-level plan
    totalAgentsSpawned: v.optional(v.number()),
    totalFilesCreated: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_session", ["sessionId"]),

  // Agent Runs — each autonomous agent instance
  // Agents can spawn child agents, creating an exponential tree
  agentRuns: defineTable({
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    parentAgentId: v.optional(v.id("agentRuns")), // null = root agent
    role: v.string(), // "orchestrator", "planner", "coder", "reviewer", "debugger", "tester"
    title: v.string(),
    description: v.string(),
    model: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("thinking"),     // AI is generating
      v.literal("coding"),       // Writing files
      v.literal("reviewing"),    // Reviewing output
      v.literal("spawning"),     // Creating child agents
      v.literal("waiting"),      // Waiting for children
      v.literal("completed"),
      v.literal("failed"),
    ),
    depth: v.number(), // 0 = root, 1 = first spawn, etc. Cap at 4
    childCount: v.optional(v.number()),
    filesCreated: v.optional(v.number()),
    filesModified: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
    result: v.optional(v.string()), // Summary of what was accomplished
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_mission", ["missionId"])
    .index("by_parent", ["parentAgentId"])
    .index("by_project", ["projectId"])
    .index("by_mission_status", ["missionId", "status"]),

  // Activity Log — real-time stream of everything agents do
  // This is what the user watches — the "live action"
  activityLog: defineTable({
    missionId: v.id("missions"),
    agentRunId: v.id("agentRuns"),
    type: v.union(
      v.literal("thinking"),      // Agent is reasoning
      v.literal("plan"),          // Agent created a plan
      v.literal("spawn"),         // Agent spawned a child
      v.literal("file_create"),   // Created a file
      v.literal("file_modify"),   // Modified a file
      v.literal("file_delete"),   // Deleted a file
      v.literal("code"),          // Generated code block
      v.literal("test"),          // Running a test
      v.literal("error"),         // Hit an error
      v.literal("fix"),           // Auto-fixing an error
      v.literal("review"),        // Reviewing code
      v.literal("complete"),      // Agent finished
      v.literal("message"),       // General status message
    ),
    title: v.string(),           // Short description: "Creating src/App.tsx"
    detail: v.optional(v.string()), // Longer content (code snippet, error, etc.)
    filePath: v.optional(v.string()), // Related file
    agentRole: v.string(),       // Role of the agent for display
    agentModel: v.string(),      // Model used
    timestamp: v.number(),
  })
    .index("by_mission", ["missionId"])
    .index("by_agent", ["agentRunId"])
    .index("by_mission_time", ["missionId", "timestamp"]),

  // ──────────────────────────────────────────────────────────────────
  // LEGACY — keep for backward compat, will be migrated
  // ──────────────────────────────────────────────────────────────────

  // Multi-Agent Tasks (legacy)
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
