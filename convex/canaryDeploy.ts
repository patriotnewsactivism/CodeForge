/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE — CANARY DEPLOY TOOL
 * ═══════════════════════════════════════════════════════════════════
 *
 * Gradual deployment with health monitoring. Deploys to a small
 * percentage of traffic first, monitors for errors, then ramps up.
 * Integrates with the DevOps agent for automated rollback.
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

interface CanaryConfig {
  projectId: v.id("projects");
  targetUrl: string;       // production URL to monitor
  healthCheckPath: string; // e.g., "/api/health"
  stages: number[];        // e.g., [5, 25, 50, 100] — percentage stages
  waitBetweenStages: number; // seconds to wait between stages
  rollbackOnErrorRate: number; // e.g., 0.05 = 5% error rate triggers rollback
  rollbackOnLatencyMs: number;  // rollback if p95 latency exceeds this
}

interface CanaryStatus {
  stage: number;
  percentage: number;
  status: "pending" | "deploying" | "monitoring" | "passed" | "rolling_back" | "complete" | "failed";
  errorRate: number;
  p95LatencyMs: number;
  startedAt: number;
  message: string;
}

// ─── Start canary deployment ─────────────────────────────────────
export const startCanary = action({
  args: {
    projectId: v.id("projects"),
    targetUrl: v.string(),
    healthCheckPath: v.optional(v.string()),
    stages: v.optional(v.array(v.number())),
    waitBetweenStages: v.optional(v.number()),
    rollbackOnErrorRate: v.optional(v.number()),
    rollbackOnLatencyMs: v.optional(v.number()),
  },
  returns: v.object({
    canaryId: v.id("canaryDeploys"),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const stages = args.stages || [5, 25, 50, 100];
    const config = {
      projectId: args.projectId,
      targetUrl: args.targetUrl,
      healthCheckPath: args.healthCheckPath || "/api/health",
      stages,
      waitBetweenStages: args.waitBetweenStages || 60,
      rollbackOnErrorRate: args.rollbackOnErrorRate || 0.05,
      rollbackOnLatencyMs: args.rollbackOnLatencyMs || 2000,
    };

    const canaryId = await ctx.runMutation(api.canaryDeploy.createCanary, {
      projectId: args.projectId,
      targetUrl: config.targetUrl,
      healthCheckPath: config.healthCheckPath,
      stages: config.stages,
      config: JSON.stringify(config),
    });

    return {
      canaryId,
      message: `Canary deployment started. Will progress through stages: ${stages.join("% → ")}%`,
    };
  },
});

// ─── Check health at current stage ───────────────────────────────
export const checkHealth = action({
  args: {
    canaryId: v.id("canaryDeploys"),
  },
  returns: v.object({
    healthy: v.boolean(),
    errorRate: v.number(),
    p95LatencyMs: v.number(),
    statusCode: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, { canaryId }) => {
    const canary = await ctx.runQuery(api.canaryDeploy.getCanary, { canaryId });
    if (!canary) throw new Error("Canary deployment not found");

    const healthUrl = `${canary.targetUrl}${canary.healthCheckPath}`;
    const startTime = Date.now();

    try {
      const res = await fetch(healthUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });

      const latency = Date.now() - startTime;
      const statusCode = res.status;
      const healthy = statusCode >= 200 && statusCode < 400;

      // Simple error rate estimation based on status code
      const errorRate = healthy ? 0 : 1;

      // Update canary status
      await ctx.runMutation(api.canaryDeploy.updateHealth, {
        canaryId,
        errorRate,
        p95LatencyMs: latency,
        statusCode,
      });

      // Check rollback conditions
      const config = JSON.parse(canary.config || "{}");
      const shouldRollback =
        errorRate > (config.rollbackOnErrorRate || 0.05) ||
        latency > (config.rollbackOnLatencyMs || 2000);

      if (shouldRollback && healthy === false) {
        await ctx.runMutation(api.canaryDeploy.updateStatus, {
          canaryId,
          status: "rolling_back",
          message: `Health check failed: status ${statusCode}, latency ${latency}ms`,
        });
        return {
          healthy: false,
          errorRate,
          p95LatencyMs: latency,
          statusCode,
          message: `Rolling back: ${statusCode} response, ${latency}ms latency`,
        };
      }

      return {
        healthy,
        errorRate,
        p95LatencyMs: latency,
        statusCode,
        message: healthy
          ? `Health check passed: ${statusCode} in ${latency}ms`
          : `Health check failed: ${statusCode}`,
      };
    } catch (err) {
      const latency = Date.now() - startTime;
      await ctx.runMutation(api.canaryDeploy.updateHealth, {
        canaryId,
        errorRate: 1,
        p95LatencyMs: latency,
        statusCode: 0,
      });
      await ctx.runMutation(api.canaryDeploy.updateStatus, {
        canaryId,
        status: "rolling_back",
        message: `Health check error: ${err instanceof Error ? err.message : "unknown"}`,
      });
      return {
        healthy: false,
        errorRate: 1,
        p95LatencyMs: latency,
        statusCode: 0,
        message: `Health check failed: ${err instanceof Error ? err.message : "timeout"}`,
      };
    }
  },
});

// ─── Advance to next stage ───────────────────────────────────────
export const advanceStage = mutation({
  args: { canaryId: v.id("canaryDeploys") },
  returns: v.object({
    stage: v.number(),
    percentage: v.number(),
    isComplete: v.boolean(),
  }),
  handler: async (ctx, { canaryId }) => {
    const canary = await ctx.db.get(canaryId);
    if (!canary) throw new Error("Canary not found");

    const stages: number[] = JSON.parse(canary.stages || "[5, 25, 50, 100]");
    const currentStage = canary.currentStage;

    if (currentStage >= stages.length - 1) {
      await ctx.db.patch(canaryId, { status: "complete", completedAt: Date.now() });
      return { stage: currentStage, percentage: stages[currentStage], isComplete: true };
    }

    const nextStage = currentStage + 1;
    await ctx.db.patch(canaryId, {
      currentStage: nextStage,
      status: "deploying",
      stageStartedAt: Date.now(),
    });

    return { stage: nextStage, percentage: stages[nextStage], isComplete: false };
  },
});

// ─── Create canary record ────────────────────────────────────────
export const createCanary = mutation({
  args: {
    projectId: v.id("projects"),
    targetUrl: v.string(),
    healthCheckPath: v.string(),
    stages: v.array(v.number()),
    config: v.string(),
  },
  returns: v.id("canaryDeploys"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("canaryDeploys", {
      projectId: args.projectId,
      userId,
      targetUrl: args.targetUrl,
      healthCheckPath: args.healthCheckPath,
      stages: JSON.stringify(args.stages),
      config: args.config,
      currentStage: 0,
      status: "deploying",
      errorRate: 0,
      p95LatencyMs: 0,
      lastStatusCode: 0,
      stageStartedAt: Date.now(),
      startedAt: Date.now(),
    });
  },
});

// ─── Get canary status ───────────────────────────────────────────
export const getCanary = query({
  args: { canaryId: v.id("canaryDeploys") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, { canaryId }) => {
    return await ctx.db.get(canaryId);
  },
});

// ─── Update health metrics ───────────────────────────────────────
export const updateHealth = mutation({
  args: {
    canaryId: v.id("canaryDeploys"),
    errorRate: v.number(),
    p95LatencyMs: v.number(),
    statusCode: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.canaryId, {
      errorRate: args.errorRate,
      p95LatencyMs: args.p95LatencyMs,
      lastStatusCode: args.statusCode,
      lastCheckedAt: Date.now(),
    });
    return null;
  },
});

// ─── Update status ───────────────────────────────────────────────
export const updateStatus = mutation({
  args: {
    canaryId: v.id("canaryDeploys"),
    status: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: any = { status: args.status };
    if (args.message) patch.lastMessage = args.message;
    if (args.status === "complete" || args.status === "failed") {
      patch.completedAt = Date.now();
    }
    await ctx.db.patch(args.canaryId, patch);
    return null;
  },
});

// ─── List canaries for a project ─────────────────────────────────
export const listCanaries = query({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("canaryDeploys")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(20);
  },
});
