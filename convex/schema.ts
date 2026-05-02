import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════════
// CodeForge v2 Schema — Tool-Calling Agent Architecture
// ═══════════════════════════════════════════════════════════════════

const schema = defineSchema({
  ...authTables,

  // ─── Projects ────────────────────────────────────────────────────
  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    githubBranch: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "name"]),

  // ─── Files ───────────────────────────────────────────────────────
  files: defineTable({
    projectId: v.id("projects"),
    path: v.string(),
    name: v.string(),
    type: v.union(v.literal("file"), v.literal("folder")),
    content: v.optional(v.string()),
    language: v.optional(v.string()),
    size: v.optional(v.number()),
    lastModifiedBy: v.optional(v.string()), // "user" | agentRunId
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_path", ["projectId", "path"]),

  // ─── Chat Sessions ──────────────────────────────────────────────
  sessions: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    name: v.string(),
    model: v.string(),
    totalInputTokens: v.optional(v.number()),  // legacy compat
    totalOutputTokens: v.optional(v.number()), // legacy compat
    totalCost: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  // ─── Chat Messages ──────────────────────────────────────────────
  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool_summary"),
    ),
    content: v.string(),
    model: v.optional(v.string()),
    inputTokens: v.optional(v.number()),   // legacy compat
    outputTokens: v.optional(v.number()),  // legacy compat
    cost: v.optional(v.number()),
    fileContext: v.optional(v.string()),    // legacy compat
    missionId: v.optional(v.id("missions")),
  }).index("by_session", ["sessionId"]),

  // ─── GitHub Settings ────────────────────────────────────────────
  githubSettings: defineTable({
    userId: v.id("users"),
    token: v.string(),
    username: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // ═══════════════════════════════════════════════════════════════
  // AUTONOMOUS AGENT SYSTEM (v2 — Tool-Calling)
  // ═══════════════════════════════════════════════════════════════

  // ─── Missions — Top-level user requests ─────────────────────────
  missions: defineTable({
    userId: v.id("users"),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    prompt: v.string(),
    status: v.union(
      v.literal("planning"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    plan: v.optional(v.string()),         // JSON plan from orchestrator
    totalAgents: v.optional(v.number()),
    totalFiles: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_session", ["sessionId"]),

  // ─── Agent Runs — Individual agent executions ───────────────────
  agentRuns: defineTable({
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    parentAgentId: v.optional(v.id("agentRuns")),
    role: v.string(),
    title: v.string(),
    description: v.string(),
    model: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),      // Agent loop is active
      v.literal("waiting"),      // Waiting for children
      v.literal("completed"),
      v.literal("failed"),
    ),
    depth: v.number(),
    // Metrics
    toolCallCount: v.optional(v.number()),
    filesCreated: v.optional(v.number()),
    filesModified: v.optional(v.number()),
    childrenSpawned: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
    // Loop tracking
    loopIteration: v.optional(v.number()),  // Current think→act→observe cycle
    maxIterations: v.optional(v.number()),  // Safety cap
    // Result
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_mission", ["missionId"])
    .index("by_parent", ["parentAgentId"])
    .index("by_project", ["projectId"])
    .index("by_mission_status", ["missionId", "status"]),

  // ─── Tool Calls — Full audit trail of every agent action ────────
  // This is the LIVE FEED the user watches.
  // Every file creation, edit, spawn, etc. is recorded here.
  toolCalls: defineTable({
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    // Tool info
    toolName: v.string(),       // "create_file", "edit_file", "spawn_agent", etc.
    toolInput: v.string(),      // JSON stringified input args
    toolOutput: v.optional(v.string()), // JSON stringified result
    // Status
    status: v.union(
      v.literal("executing"),
      v.literal("success"),
      v.literal("error"),
    ),
    // Context
    filePath: v.optional(v.string()),     // If file-related
    childAgentId: v.optional(v.id("agentRuns")), // If spawn-related
    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()),     // ms
  })
    .index("by_agent", ["agentRunId"])
    .index("by_mission", ["missionId"])
    .index("by_mission_time", ["missionId", "startedAt"]),

  // ─── Agent Thoughts — Streaming reasoning/status ────────────────
  // Lightweight stream of what the agent is thinking (pre-tool-call)
  agentThoughts: defineTable({
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    iteration: v.number(),       // Which loop iteration
    phase: v.union(
      v.literal("thinking"),     // Deciding what to do
      v.literal("acting"),       // Executing tool calls
      v.literal("observing"),    // Reviewing results
      v.literal("reflecting"),   // Deciding if done or continue
    ),
    content: v.string(),
    timestamp: v.number(),
  })
    .index("by_agent", ["agentRunId"])
    .index("by_mission", ["missionId"])
    .index("by_mission_time", ["missionId", "timestamp"]),

  // ─── Agent Messages — Inter-agent communication ─────────────────
  agentMessages: defineTable({
    missionId: v.id("missions"),
    fromAgentId: v.id("agentRuns"),
    toAgentId: v.optional(v.id("agentRuns")),
    type: v.union(
      v.literal("context"),
      v.literal("warning"),
      v.literal("dependency"),
      v.literal("handoff"),
      v.literal("conflict"),
    ),
    content: v.string(),
    isRead: v.boolean(),
    timestamp: v.number(),
  })
    .index("by_mission", ["missionId"])
    .index("by_recipient", ["toAgentId"]),

  // ═══════════════════════════════════════════════════════════════
  // INTELLIGENCE LAYER
  // ═══════════════════════════════════════════════════════════════

  // ─── Agent Memory — Persistent learnings ────────────────────────
  memories: defineTable({
    projectId: v.id("projects"),
    category: v.union(
      v.literal("pattern"),
      v.literal("antipattern"),
      v.literal("convention"),
      v.literal("bugfix"),
      v.literal("architecture"),
      v.literal("preference"),
      v.literal("general"),
    ),
    title: v.string(),
    content: v.string(),
    confidence: v.number(),
    useCount: v.number(),
    lastUsedAt: v.optional(v.number()),
    sourceMissionId: v.optional(v.id("missions")),
    tags: v.optional(v.array(v.string())),
    isActive: v.boolean(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_active", ["projectId", "isActive"]),

  // ─── Retrospectives — Post-mission analysis ─────────────────────
  retrospectives: defineTable({
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    summary: v.string(),
    whatWorked: v.array(v.string()),
    whatFailed: v.array(v.string()),
    improvements: v.array(v.string()),
    score: v.number(),
    memoriesCreated: v.optional(v.number()),
    cost: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_mission", ["missionId"])
    .index("by_project", ["projectId"]),

  // ─── Suggestions — AI-generated improvement ideas ───────────────
  suggestions: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    prompt: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("dismissed"),
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"]),

  // ─── Git Branches — Branch-per-mission tracking ─────────────────
  gitBranches: defineTable({
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    branchName: v.string(),
    baseBranch: v.string(),
    status: v.string(),
    commits: v.number(),
    prUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_mission", ["missionId"])
    .index("by_project", ["projectId"]),

  // ─── Cost Tracking ──────────────────────────────────────────────
  costEntries: defineTable({
    userId: v.id("users"),
    missionId: v.optional(v.id("missions")),
    agentRunId: v.optional(v.id("agentRuns")),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cost: v.number(),
    operation: v.string(),
  })
    .index("by_user", ["userId"]),
});

export default schema;
