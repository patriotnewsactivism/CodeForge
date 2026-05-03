/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE — SUBSCRIPTION & USAGE CONTROL
 * ═══════════════════════════════════════════════════════════════════
 *
 * Plans:
 *   free     — 25 AI requests/day, 3 missions/day, 2 concurrent agents, 3 projects
 *   weekly   — 200 AI requests/day, 20 missions/day, 5 concurrent agents, 10 projects
 *   monthly  — 500 AI requests/day, 50 missions/day, 10 concurrent agents, 25 projects
 *   lifetime — 1000 AI requests/day, 100 missions/day, 20 concurrent agents, unlimited projects
 *
 * Hard spend cap per billing period prevents runaway costs.
 * Rate limiting is enforced at the hourly AND daily level.
 */
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Plan Definitions ────────────────────────────────────────────
export const PLAN_LIMITS = {
  free: {
    maxAiRequestsPerDay: 25,
    maxAiRequestsPerHour: 10,
    maxMissionsPerDay: 3,
    maxConcurrentAgents: 2,
    maxProjectFiles: 50,
    maxProjects: 3,
    monthlyComputeBudgetCents: 0, // Free tier: $0 budget (only free models)
    priceCents: 0,
    label: "Free",
  },
  weekly: {
    maxAiRequestsPerDay: 200,
    maxAiRequestsPerHour: 50,
    maxMissionsPerDay: 20,
    maxConcurrentAgents: 5,
    maxProjectFiles: 200,
    maxProjects: 10,
    monthlyComputeBudgetCents: 500,  // $5 hard cap per week
    priceCents: 999,                 // $9.99/week
    label: "Weekly Pro",
  },
  monthly: {
    maxAiRequestsPerDay: 500,
    maxAiRequestsPerHour: 100,
    maxMissionsPerDay: 50,
    maxConcurrentAgents: 10,
    maxProjectFiles: 500,
    maxProjects: 25,
    monthlyComputeBudgetCents: 1500, // $15 hard cap per month
    priceCents: 2999,                // $29.99/month
    label: "Monthly Pro",
  },
  lifetime: {
    maxAiRequestsPerDay: 1000,
    maxAiRequestsPerHour: 200,
    maxMissionsPerDay: 100,
    maxConcurrentAgents: 20,
    maxProjectFiles: 1000,
    maxProjects: 100,
    monthlyComputeBudgetCents: 5000, // $50 rolling 30-day hard cap
    priceCents: 29999,               // $299.99 lifetime (launch promo)
    label: "Lifetime Founder",
  },
} as const;

type PlanType = keyof typeof PLAN_LIMITS;

// ─── Get or create subscription ──────────────────────────────────
export const getMySubscription = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!sub) {
      // Return default free plan shape for UI
      return {
        plan: "free" as const,
        status: "active" as const,
        ...PLAN_LIMITS.free,
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        _isDefault: true,
      };
    }
    return sub;
  },
});

// ─── Initialize free subscription for new users ──────────────────
export const ensureSubscription = mutation({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) return existing;

    const now = Date.now();
    const id = await ctx.db.insert("subscriptions", {
      userId,
      plan: "free",
      status: "active",
      ...PLAN_LIMITS.free,
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
      createdAt: now,
    });
    return await ctx.db.get(id);
  },
});

// ─── Upgrade plan (called after payment confirmation) ────────────
export const upgradePlan = mutation({
  args: {
    plan: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("lifetime"),
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, { plan, stripeCustomerId, stripeSubscriptionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const limits = PLAN_LIMITS[plan];
    const now = Date.now();

    let periodEnd: number;
    if (plan === "weekly") {
      periodEnd = now + 7 * 24 * 60 * 60 * 1000;
    } else if (plan === "monthly") {
      periodEnd = now + 30 * 24 * 60 * 60 * 1000;
    } else {
      // Lifetime: set period far in the future but still reset usage monthly
      periodEnd = now + 30 * 24 * 60 * 60 * 1000;
    }

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        plan,
        status: "active",
        ...limits,
        stripeCustomerId,
        stripeSubscriptionId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("subscriptions", {
      userId,
      plan,
      status: "active",
      ...limits,
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      createdAt: now,
    });
    return await ctx.db.get(id);
  },
});

// ─── Get today's usage ───────────────────────────────────────────
export const getMyUsage = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const now = new Date();
    const dailyKey = now.toISOString().slice(0, 10); // "2026-05-03"
    const hourlyKey = now.toISOString().slice(0, 13); // "2026-05-03T10"

    const daily = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", userId).eq("periodType", "daily").eq("periodKey", dailyKey)
      )
      .first();

    const hourly = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", userId).eq("periodType", "hourly").eq("periodKey", hourlyKey)
      )
      .first();

    return {
      daily: daily || { aiRequests: 0, missionsLaunched: 0, agentsSpawned: 0, tokensUsed: 0, computeCostCents: 0 },
      hourly: hourly || { aiRequests: 0, missionsLaunched: 0, agentsSpawned: 0, tokensUsed: 0, computeCostCents: 0 },
    };
  },
});

// ─── Check if user can make an AI request ────────────────────────
// Called before every AI call to enforce limits
export const checkUsageAllowed = query({
  args: { actionType: v.union(v.literal("ai_request"), v.literal("mission"), v.literal("agent_spawn")) },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    remainingToday: v.optional(v.number()),
    remainingThisHour: v.optional(v.number()),
  }),
  handler: async (ctx, { actionType }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { allowed: false, reason: "Not authenticated" };

    // Get subscription
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const limits = sub || PLAN_LIMITS.free;

    // Check if subscription is active
    if (sub && sub.status !== "active") {
      return { allowed: false, reason: "Subscription is not active. Please renew." };
    }

    // Check period expiry
    if (sub && sub.currentPeriodEnd < Date.now() && sub.plan !== "lifetime") {
      return { allowed: false, reason: "Subscription period has expired. Please renew." };
    }

    const now = new Date();
    const dailyKey = now.toISOString().slice(0, 10);
    const hourlyKey = now.toISOString().slice(0, 13);

    const daily = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", userId).eq("periodType", "daily").eq("periodKey", dailyKey)
      )
      .first();

    const hourly = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", userId).eq("periodType", "hourly").eq("periodKey", hourlyKey)
      )
      .first();

    const dailyAI = daily?.aiRequests || 0;
    const hourlyAI = hourly?.aiRequests || 0;
    const dailyMissions = daily?.missionsLaunched || 0;
    const dailyCost = daily?.computeCostCents || 0;

    // Budget check — most important for cost protection
    if (limits.monthlyComputeBudgetCents > 0 && dailyCost >= limits.monthlyComputeBudgetCents) {
      return { allowed: false, reason: "Compute budget exceeded for this period. Upgrade plan or wait for reset." };
    }

    if (actionType === "ai_request") {
      if (dailyAI >= limits.maxAiRequestsPerDay) {
        return { allowed: false, reason: `Daily AI request limit reached (${limits.maxAiRequestsPerDay}/day). Resets at midnight UTC.`, remainingToday: 0 };
      }
      if (hourlyAI >= limits.maxAiRequestsPerHour) {
        return { allowed: false, reason: `Hourly AI rate limit reached (${limits.maxAiRequestsPerHour}/hour). Try again soon.`, remainingThisHour: 0 };
      }
      return {
        allowed: true,
        remainingToday: limits.maxAiRequestsPerDay - dailyAI,
        remainingThisHour: limits.maxAiRequestsPerHour - hourlyAI,
      };
    }

    if (actionType === "mission") {
      if (dailyMissions >= limits.maxMissionsPerDay) {
        return { allowed: false, reason: `Daily mission limit reached (${limits.maxMissionsPerDay}/day). Resets at midnight UTC.` };
      }
      return { allowed: true };
    }

    // Agent spawn — check concurrent limit
    if (actionType === "agent_spawn") {
      // Count currently running agents for this user's active missions
      const activeMissions = await ctx.db
        .query("missions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("status"), "running"))
        .collect();

      let runningAgents = 0;
      for (const m of activeMissions) {
        const agents = await ctx.db
          .query("agentRuns")
          .withIndex("by_mission_status", (q) => q.eq("missionId", m._id).eq("status", "running"))
          .collect();
        runningAgents += agents.length;
      }

      if (runningAgents >= limits.maxConcurrentAgents) {
        return { allowed: false, reason: `Concurrent agent limit reached (${limits.maxConcurrentAgents}). Wait for agents to finish.` };
      }
      return { allowed: true };
    }

    return { allowed: true };
  },
});

// ─── Record usage (called after each AI call) ────────────────────
export const recordUsage = mutation({
  args: {
    actionType: v.union(v.literal("ai_request"), v.literal("mission"), v.literal("agent_spawn")),
    tokensUsed: v.optional(v.number()),
    costCents: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { actionType, tokensUsed, costCents }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const now = new Date();
    const dailyKey = now.toISOString().slice(0, 10);
    const hourlyKey = now.toISOString().slice(0, 13);

    // Update or create daily record
    const daily = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", userId).eq("periodType", "daily").eq("periodKey", dailyKey)
      )
      .first();

    if (daily) {
      const patch: Record<string, number> = {};
      if (actionType === "ai_request") patch.aiRequests = daily.aiRequests + 1;
      if (actionType === "mission") patch.missionsLaunched = daily.missionsLaunched + 1;
      if (actionType === "agent_spawn") patch.agentsSpawned = daily.agentsSpawned + 1;
      if (tokensUsed) patch.tokensUsed = daily.tokensUsed + tokensUsed;
      if (costCents) patch.computeCostCents = daily.computeCostCents + costCents;
      await ctx.db.patch(daily._id, patch);
    } else {
      await ctx.db.insert("usageRecords", {
        userId,
        periodKey: dailyKey,
        periodType: "daily",
        aiRequests: actionType === "ai_request" ? 1 : 0,
        missionsLaunched: actionType === "mission" ? 1 : 0,
        agentsSpawned: actionType === "agent_spawn" ? 1 : 0,
        tokensUsed: tokensUsed || 0,
        computeCostCents: costCents || 0,
      });
    }

    // Update or create hourly record
    const hourly = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", userId).eq("periodType", "hourly").eq("periodKey", hourlyKey)
      )
      .first();

    if (hourly) {
      const patch: Record<string, number> = {};
      if (actionType === "ai_request") patch.aiRequests = hourly.aiRequests + 1;
      if (actionType === "mission") patch.missionsLaunched = hourly.missionsLaunched + 1;
      if (actionType === "agent_spawn") patch.agentsSpawned = hourly.agentsSpawned + 1;
      if (tokensUsed) patch.tokensUsed = hourly.tokensUsed + tokensUsed;
      if (costCents) patch.computeCostCents = hourly.computeCostCents + costCents;
      await ctx.db.patch(hourly._id, patch);
    } else {
      await ctx.db.insert("usageRecords", {
        userId,
        periodKey: hourlyKey,
        periodType: "hourly",
        aiRequests: actionType === "ai_request" ? 1 : 0,
        missionsLaunched: actionType === "mission" ? 1 : 0,
        agentsSpawned: actionType === "agent_spawn" ? 1 : 0,
        tokensUsed: tokensUsed || 0,
        computeCostCents: costCents || 0,
      });
    }

    return null;
  },
});

// ─── Get plan limits (for pricing page) ──────────────────────────
export const getPlanLimits = query({
  args: {},
  returns: v.any(),
  handler: async () => {
    return PLAN_LIMITS;
  },
});
