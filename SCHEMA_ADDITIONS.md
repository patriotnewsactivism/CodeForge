# Schema Additions for All Upgrades\n\nAdd these tables to convex/schema.ts:\n\n```typescript
// ─── ADD THESE TO convex/schema.ts (inside defineSchema) ────────

// Terminal output streaming (Upgrade #1)
// terminalOutput: defineTable({
//   projectId: v.id("projects"),
//   terminalId: v.string(),
//   lines: v.array(v.object({ text: v.string(), type: v.string() })),
//   done: v.boolean(),
//   updatedAt: v.number(),
// })
//   .index("by_terminal", ["projectId", "terminalId"]),

// Project share links (Upgrade #3)
// projectShares: defineTable({
//   projectId: v.id("projects"),
//   token: v.string(),
//   expiry: v.string(),
//   expiresAt: v.optional(v.number()),
//   hasPassword: v.boolean(),
//   passwordHash: v.optional(v.string()),
//   isActive: v.boolean(),
//   viewCount: v.number(),
//   createdAt: v.number(),
//   updatedAt: v.number(),
// })
//   .index("by_project", ["projectId"])
//   .index("by_token", ["token"]),

// Project snapshots for rollback (Upgrade #8)
// projectSnapshots: defineTable({
//   projectId: v.id("projects"),
//   missionId: v.optional(v.id("missions")),
//   label: v.optional(v.string()),
//   fileCount: v.number(),
//   createdAt: v.number(),
// })
//   .index("by_project", ["projectId"]),

// Agent personality per user (Upgrade #10)
// userPersonality: defineTable({
//   userId: v.id("users"),
//   personalityId: v.string(),
//   systemPrompt: v.string(),
//   updatedAt: v.number(),
// })
//   .index("by_user", ["userId"]),
```\n