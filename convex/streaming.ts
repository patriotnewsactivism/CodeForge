/**
 * STREAMING AGENT THOUGHT PROCESS
 *
 * Real-time streaming of agent thoughts, code generation, and decisions.
 * Uses Convex mutations to push incremental updates that the frontend
 * subscribes to via queries — giving a live "watching the agent think" experience.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Thought Stream Entries ─────────────────────────────────────

export const pushThought = mutation({
  args: {
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    phase: v.union(
      v.literal("reasoning"),    // Agent is thinking through the problem
      v.literal("planning"),     // Laying out steps
      v.literal("coding"),       // Writing code
      v.literal("reviewing"),    // Self-reviewing
      v.literal("refining"),     // Adjusting approach
      v.literal("spawning"),     // Creating child agents
      v.literal("complete"),     // Done
    ),
    content: v.string(),         // The actual thought / code chunk / plan step
    codeFile: v.optional(v.string()),    // If coding, which file
    codeLanguage: v.optional(v.string()), // Language for syntax highlighting
    tokensSoFar: v.optional(v.number()), // Running token count
    costSoFar: v.optional(v.number()),   // Running cost
  },
  returns: v.id("thoughtStream"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("thoughtStream", {
      agentRunId: args.agentRunId,
      missionId: args.missionId,
      phase: args.phase,
      content: args.content,
      codeFile: args.codeFile,
      codeLanguage: args.codeLanguage,
      tokensSoFar: args.tokensSoFar,
      costSoFar: args.costSoFar,
      timestamp: Date.now(),
    });
  },
});

// Append to the latest thought (for streaming token-by-token)
export const appendToThought = mutation({
  args: {
    thoughtId: v.id("thoughtStream"),
    chunk: v.string(),
    tokensSoFar: v.optional(v.number()),
    costSoFar: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thought = await ctx.db.get(args.thoughtId);
    if (!thought) return null;
    await ctx.db.patch(args.thoughtId, {
      content: thought.content + args.chunk,
      ...(args.tokensSoFar !== undefined ? { tokensSoFar: args.tokensSoFar } : {}),
      ...(args.costSoFar !== undefined ? { costSoFar: args.costSoFar } : {}),
    });
    return null;
  },
});

// ─── Queries for Real-Time Subscription ─────────────────────────

// Get all thoughts for a mission (live feed)
export const listByMission = query({
  args: {
    missionId: v.id("missions"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("thoughtStream"),
    _creationTime: v.number(),
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    phase: v.string(),
    content: v.string(),
    codeFile: v.optional(v.string()),
    codeLanguage: v.optional(v.string()),
    tokensSoFar: v.optional(v.number()),
    costSoFar: v.optional(v.number()),
    timestamp: v.number(),
  })),
  handler: async (ctx, { missionId, limit }) => {
    const thoughts = await ctx.db
      .query("thoughtStream")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .order("desc")
      .take(limit || 100);
    return thoughts.reverse();
  },
});

// Get thoughts for a specific agent (drill-down view)
export const listByAgent = query({
  args: {
    agentRunId: v.id("agentRuns"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("thoughtStream"),
    _creationTime: v.number(),
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    phase: v.string(),
    content: v.string(),
    codeFile: v.optional(v.string()),
    codeLanguage: v.optional(v.string()),
    tokensSoFar: v.optional(v.number()),
    costSoFar: v.optional(v.number()),
    timestamp: v.number(),
  })),
  handler: async (ctx, { agentRunId, limit }) => {
    const thoughts = await ctx.db
      .query("thoughtStream")
      .withIndex("by_agent", (q) => q.eq("agentRunId", agentRunId))
      .order("desc")
      .take(limit || 50);
    return thoughts.reverse();
  },
});

// Get the latest thought for each active agent (dashboard overview)
export const latestPerAgent = query({
  args: {
    missionId: v.id("missions"),
  },
  returns: v.array(v.object({
    agentRunId: v.id("agentRuns"),
    phase: v.string(),
    content: v.string(),
    codeFile: v.optional(v.string()),
    timestamp: v.number(),
  })),
  handler: async (ctx, { missionId }) => {
    const allThoughts = await ctx.db
      .query("thoughtStream")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .order("desc")
      .take(500);

    // Group by agent, take latest
    const byAgent = new Map<string, typeof allThoughts[0]>();
    for (const t of allThoughts) {
      const key = t.agentRunId as string;
      if (!byAgent.has(key)) {
        byAgent.set(key, t);
      }
    }

    return Array.from(byAgent.values()).map((t) => ({
      agentRunId: t.agentRunId,
      phase: t.phase,
      content: t.content.slice(0, 200), // Truncate for overview
      codeFile: t.codeFile,
      timestamp: t.timestamp,
    }));
  },
});

// Stream stats for a mission
export const missionStreamStats = query({
  args: { missionId: v.id("missions") },
  returns: v.object({
    totalThoughts: v.number(),
    phases: v.any(),
    latestTimestamp: v.optional(v.number()),
  }),
  handler: async (ctx, { missionId }) => {
    const thoughts = await ctx.db
      .query("thoughtStream")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .collect();

    const phases: Record<string, number> = {};
    let latestTimestamp: number | undefined;
    for (const t of thoughts) {
      phases[t.phase] = (phases[t.phase] || 0) + 1;
      if (!latestTimestamp || t.timestamp > latestTimestamp) {
        latestTimestamp = t.timestamp;
      }
    }

    return {
      totalThoughts: thoughts.length,
      phases,
      latestTimestamp,
    };
  },
});
