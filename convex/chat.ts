/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — CHAT API
 * ═══════════════════════════════════════════════════════════════════
 *
 * Public-facing chat interface. Handles:
 * 1. Simple questions → Direct AI response (no tools)
 * 2. Code requests → Launches a mission with the agent engine
 *
 * The frontend calls chat.send, which decides the approach.
 */
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

declare const process: { env: Record<string, string | undefined> };

// ─── Session Management ─────────────────────────────────────────

export const getOrCreateSession = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Look for existing active session
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("sessions", {
      userId,
      projectId: args.projectId,
      name: "New Session",
      model: args.model || "deepseek-v3.2",
      isActive: true,
    });
  },
});

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

export const getMessages = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
  },
});

// ─── Main Chat Action ───────────────────────────────────────────

export const send = action({
  args: {
    sessionId: v.id("sessions"),
    projectId: v.optional(v.id("projects")),
    message: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    response: string;
    missionId?: string;
    projectId?: string;
    mode: "chat" | "mission";
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Save user message
    await ctx.runMutation(api.chat.saveMessage, {
      sessionId: args.sessionId,
      role: "user",
      content: args.message,
    });

    // Auto-create project if none
    let projectId = args.projectId;
    if (!projectId) {
      projectId = await ctx.runMutation(api.chat.autoCreateProject, { userId });
    }

    // Decide: simple chat vs full mission
    const isCodeRequest = detectCodeIntent(args.message);

    if (isCodeRequest) {
      // Launch a full mission with the agent engine
      const missionId = await ctx.runMutation(api.chat.createMission, {
        projectId,
        sessionId: args.sessionId,
        prompt: args.message,
      });

      // Start the agent engine
      await ctx.scheduler.runAfter(0, internal.engine.launchMission, {
        missionId,
        projectId,
        sessionId: args.sessionId,
        prompt: args.message,
        model: args.model || "deepseek-v3.2",
      });

      // Save assistant message
      const reply = `🚀 *Mission launched!* I'm working on this now.\n\nYou can watch the agents work in real-time in the Agent panel. I'll update you when it's complete.`;
      await ctx.runMutation(api.chat.saveMessage, {
        sessionId: args.sessionId,
        role: "assistant",
        content: reply,
        missionId,
      });

      return {
        response: reply,
        missionId: missionId as string,
        projectId: projectId as string,
        mode: "mission",
      };
    } else {
      // Simple chat — direct AI response (no tools)
      const response = await simpleChat(args.message, args.model || "deepseek-v3.2");

      await ctx.runMutation(api.chat.saveMessage, {
        sessionId: args.sessionId,
        role: "assistant",
        content: response,
        model: args.model || "deepseek-v3.2",
      });

      return {
        response,
        projectId: projectId as string,
        mode: "chat",
      };
    }
  },
});

// ─── Mutations ──────────────────────────────────────────────────

export const saveMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("tool_summary")),
    content: v.string(),
    model: v.optional(v.string()),
    cost: v.optional(v.number()),
    missionId: v.optional(v.id("missions")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

export const autoCreateProject = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Check if user already has a project
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("projects", {
      userId,
      name: "My Project",
      description: "Auto-created project",
    });
  },
});

export const createMission = mutation({
  args: {
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("missions", {
      userId,
      projectId: args.projectId,
      sessionId: args.sessionId,
      prompt: args.prompt,
      status: "planning",
      startedAt: Date.now(),
    });
  },
});

// ─── Helpers ────────────────────────────────────────────────────

function detectCodeIntent(message: string): boolean {
  const codeKeywords = [
    /\b(build|create|make|implement|write|code|develop|scaffold|generate|add|set\s*up|design)\b/i,
    /\b(fix|debug|refactor|optimize|update|change|modify|edit|improve)\b/i,
    /\b(component|function|api|endpoint|page|route|model|schema|database|app|feature)\b/i,
    /\b(todo|landing|dashboard|form|auth|login|signup|crud|chat|upload)\b/i,
  ];

  const chatKeywords = [
    /^(what|who|when|where|why|how|explain|tell\s*me|describe|compare)\b/i,
    /\b(difference|between|versus|vs|definition|meaning|concept)\b/i,
    /^(hi|hello|hey|thanks|thank\s*you|ok|sure|yes|no)\b/i,
  ];

  // If it matches chat patterns and NOT code patterns → chat
  const matchesChat = chatKeywords.some((r) => r.test(message));
  const matchesCode = codeKeywords.some((r) => r.test(message));

  if (matchesCode) return true;
  if (matchesChat && !matchesCode) return false;
  // Default: if > 30 chars and no clear chat signal → treat as code request
  return message.length > 30;
}

async function simpleChat(message: string, modelId: string): Promise<string> {
  const models: Record<string, { model: string; endpoint: () => string; apiKey: () => string }> = {
    "deepseek-v3.2": {
      model: "DeepSeek-V3-0324",
      endpoint: () => process.env.DEEPSEEK_ENDPOINT || "",
      apiKey: () => process.env.DEEPSEEK_API_KEY || "",
    },
    "grok-4.1-fast": {
      model: "grok-4-1-fast-reasoning",
      endpoint: () => process.env.GROK_ENDPOINT || "",
      apiKey: () => process.env.GROK_API_KEY || "",
    },
    "kimi-k2.6": {
      model: "Kimi-K2.6",
      endpoint: () => process.env.KIMI_ENDPOINT || "",
      apiKey: () => process.env.KIMI_API_KEY || "",
    },
  };

  const config = models[modelId] || models["deepseek-v3.2"];
  const endpoint = config.endpoint();
  const apiKey = config.apiKey();

  if (!endpoint || !apiKey) return "AI model not configured. Check environment variables.";

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: "You are CodeForge AI — an expert coding assistant. Be concise and helpful." },
          { role: "user", content: message },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!resp.ok) return `AI error: ${resp.status}`;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "No response from AI.";
  } catch (e: any) {
    return `AI error: ${e.message}`;
  }
}
