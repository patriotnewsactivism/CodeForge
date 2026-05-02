/**
 * AGENT MEMORY SYSTEM — Persistent Brain
 *
 * The memory system gives the swarm long-term knowledge.
 * After each task, agents extract learnings (patterns, bugs, conventions).
 * Before each task, relevant memories are injected into the agent's prompt.
 *
 * The more you use CodeForge, the smarter it gets.
 */
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

// ─── Queries ────────────────────────────────────────────────────

// Get all active memories for a project
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("agentMemory")
      .withIndex("by_project_active", (q) =>
        q.eq("projectId", projectId).eq("isActive", true)
      )
      .collect();
  },
});

// Get memories by category
export const listByCategory = query({
  args: {
    projectId: v.id("projects"),
    category: v.string(),
  },
  handler: async (ctx, { projectId, category }) => {
    return await ctx.db
      .query("agentMemory")
      .withIndex("by_project_category", (q) =>
        q.eq("projectId", projectId).eq("category", category as any)
      )
      .collect();
  },
});

// Get top memories by confidence for injection into prompts
export const getTopMemories = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit }) => {
    const memories = await ctx.db
      .query("agentMemory")
      .withIndex("by_project_active", (q) =>
        q.eq("projectId", projectId).eq("isActive", true)
      )
      .collect();

    // Sort by confidence * useCount for relevance ranking
    return memories
      .sort((a, b) => {
        const scoreA = a.confidence * (1 + Math.log(1 + a.useCount));
        const scoreB = b.confidence * (1 + Math.log(1 + b.useCount));
        return scoreB - scoreA;
      })
      .slice(0, limit || 20);
  },
});

// Get memory stats for display
export const getStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const memories = await ctx.db
      .query("agentMemory")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const active = memories.filter((m) => m.isActive);
    const byCategory: Record<string, number> = {};
    for (const m of active) {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    }

    return {
      total: memories.length,
      active: active.length,
      inactive: memories.length - active.length,
      byCategory,
      avgConfidence:
        active.length > 0
          ? active.reduce((sum, m) => sum + m.confidence, 0) / active.length
          : 0,
      totalUses: active.reduce((sum, m) => sum + m.useCount, 0),
    };
  },
});

// ─── Mutations ──────────────────────────────────────────────────

// Store a new memory
export const store = mutation({
  args: {
    projectId: v.id("projects"),
    category: v.string(),
    title: v.string(),
    content: v.string(),
    context: v.optional(v.string()),
    confidence: v.number(),
    sourceAgentRole: v.optional(v.string()),
    sourceMissionId: v.optional(v.id("missions")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Check for duplicate/similar memories before storing
    const existing = await ctx.db
      .query("agentMemory")
      .withIndex("by_project_category", (q) =>
        q.eq("projectId", args.projectId).eq("category", args.category as any)
      )
      .collect();

    // If a memory with very similar title exists, boost its confidence instead
    const similar = existing.find(
      (m) =>
        m.isActive &&
        m.title.toLowerCase().includes(args.title.toLowerCase().slice(0, 30))
    );

    if (similar) {
      await ctx.db.patch(similar._id, {
        confidence: Math.min(1.0, similar.confidence + 0.1),
        useCount: similar.useCount + 1,
        lastUsedAt: Date.now(),
        // Append new context if different
        content:
          similar.content.length < 2000
            ? `${similar.content}\n\n[Reinforced]: ${args.content}`
            : similar.content,
      });
      return similar._id;
    }

    return await ctx.db.insert("agentMemory", {
      projectId: args.projectId,
      category: args.category as any,
      title: args.title,
      content: args.content,
      context: args.context,
      confidence: args.confidence,
      useCount: 0,
      sourceAgentRole: args.sourceAgentRole,
      sourceMissionId: args.sourceMissionId,
      tags: args.tags,
      isActive: true,
    });
  },
});

// Record that a memory was used in a prompt
export const recordUse = mutation({
  args: { memoryId: v.id("agentMemory") },
  handler: async (ctx, { memoryId }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) return;
    await ctx.db.patch(memoryId, {
      useCount: memory.useCount + 1,
      lastUsedAt: Date.now(),
    });
  },
});

// Deactivate a memory (proven wrong or outdated)
export const deactivate = mutation({
  args: { memoryId: v.id("agentMemory") },
  handler: async (ctx, { memoryId }) => {
    await ctx.db.patch(memoryId, { isActive: false });
  },
});

// Boost a memory's confidence (user confirmed it's useful)
export const boost = mutation({
  args: { memoryId: v.id("agentMemory") },
  handler: async (ctx, { memoryId }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) return;
    await ctx.db.patch(memoryId, {
      confidence: Math.min(1.0, memory.confidence + 0.15),
    });
  },
});

// Decay all memories slightly (keeps system fresh, old unused memories fade)
export const decayUnused = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const memories = await ctx.db
      .query("agentMemory")
      .withIndex("by_project_active", (q) =>
        q.eq("projectId", projectId).eq("isActive", true)
      )
      .collect();

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const m of memories) {
      if ((!m.lastUsedAt || m.lastUsedAt < oneWeekAgo) && m.confidence > 0.2) {
        await ctx.db.patch(m._id, {
          confidence: Math.max(0.1, m.confidence - 0.05),
        });
      }
    }
  },
});

// ─── Actions ────────────────────────────────────────────────────

// Build a memory context string to inject into agent prompts
export const buildPromptContext = action({
  args: {
    projectId: v.id("projects"),
    agentRole: v.string(),
    taskDescription: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, { projectId, agentRole, taskDescription }) => {
    // Get top memories for this project
    const memories = await ctx.runQuery(api.memory.getTopMemories, {
      projectId,
      limit: 30,
    });

    if (memories.length === 0) {
      return "";
    }

    // Filter memories relevant to this agent's role
    const roleRelevance: Record<string, string[]> = {
      orchestrator: [
        "architecture",
        "pattern",
        "convention",
        "preference",
        "general",
      ],
      planner: ["architecture", "pattern", "convention", "general"],
      architect: [
        "architecture",
        "pattern",
        "convention",
        "dependency",
        "performance",
      ],
      coder: [
        "pattern",
        "antipattern",
        "convention",
        "bugfix",
        "dependency",
        "performance",
      ],
      reviewer: [
        "antipattern",
        "bugfix",
        "security",
        "performance",
        "convention",
      ],
      debugger: ["bugfix", "antipattern", "pattern", "dependency"],
      tester: ["bugfix", "antipattern", "convention"],
      styler: ["convention", "preference", "pattern"],
    };

    const relevantCategories =
      roleRelevance[agentRole] || Object.keys(roleRelevance.coder);
    const relevant = memories.filter((m: { category: string }) =>
      relevantCategories.includes(m.category)
    );

    if (relevant.length === 0) return "";

    // Mark memories as used
    for (const m of relevant.slice(0, 15)) {
      await ctx.runMutation(api.memory.recordUse, { memoryId: m._id });
    }

    // Build the context string
    const sections: string[] = [
      "## 🧠 Agent Memory — What I've Learned About This Project",
      "",
    ];

    const grouped: Record<string, typeof relevant> = {};
    for (const m of relevant.slice(0, 15)) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    }

    const categoryLabels: Record<string, string> = {
      pattern: "✅ Patterns That Work",
      antipattern: "❌ Things To Avoid",
      convention: "📏 Project Conventions",
      bugfix: "🐛 Known Bugs & Fixes",
      architecture: "🏗️ Architecture Decisions",
      dependency: "📦 Dependency Knowledge",
      preference: "👤 User Preferences",
      performance: "⚡ Performance Notes",
      security: "🔒 Security Considerations",
      general: "💡 General Knowledge",
    };

    for (const [cat, entries] of Object.entries(grouped)) {
      sections.push(`### ${categoryLabels[cat] || cat}`);
      for (const entry of entries) {
        const conf = Math.round(entry.confidence * 100);
        sections.push(`- **${entry.title}** (${conf}% confident)`);
        sections.push(`  ${entry.content.slice(0, 200)}`);
      }
      sections.push("");
    }

    sections.push(
      "Use these learnings to write better code. If you discover something new, note it in your response."
    );

    return sections.join("\n");
  },
});

// Extract learnings from a completed agent run and store them as memories
export const extractAndStore = action({
  args: {
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    agentRole: v.string(),
    agentResult: v.string(),
    model: v.string(),
  },
  returns: v.number(), // Number of memories stored
  handler: async (
    ctx,
    { agentRunId: _agentRunId, missionId, projectId, agentRole, agentResult, model: _model }
  ) => {
    // Use the cheapest/fastest model for memory extraction
    const endpoint = process.env.KIMI_ENDPOINT || process.env.DEEPSEEK_ENDPOINT || "";
    const apiKey = process.env.KIMI_API_KEY || process.env.DEEPSEEK_API_KEY || "";
    const modelName = process.env.KIMI_ENDPOINT ? "Kimi-K2.6" : "DeepSeek-V3-0324";

    if (!endpoint || !apiKey) return 0;

    const extractionPrompt = `You are the Memory Extraction System for CodeForge, an AI coding platform.

Analyze this agent's completed work and extract reusable learnings. Focus on:
- Code patterns that worked well
- Anti-patterns or mistakes to avoid
- Project conventions discovered
- Bug fixes and their root causes
- Architecture decisions made
- Performance insights
- Dependency quirks

Agent role: ${agentRole}
Agent output (truncated):
${agentResult.slice(0, 4000)}

Return ONLY a JSON array of memory objects. Each object has:
{
  "category": "pattern" | "antipattern" | "convention" | "bugfix" | "architecture" | "dependency" | "performance" | "security" | "general",
  "title": "Short label (max 80 chars)",
  "content": "Detailed description of the learning (max 300 chars)",
  "confidence": 0.5-0.9,
  "tags": ["tag1", "tag2"]
}

Return 0-5 memories. Only extract genuinely useful, specific learnings. Don't create generic/obvious entries.
Return [] if nothing worth remembering was found.
Return ONLY valid JSON array, no markdown.`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: extractionPrompt },
            {
              role: "user",
              content: "Extract learnings from the agent output above.",
            },
          ],
          max_tokens: 2048,
          temperature: 0.2,
        }),
      });

      if (!response.ok) return 0;

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      let content = data.choices[0]?.message?.content?.trim() || "[]";
      if (content.startsWith("```")) {
        content = content
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }

      let memories: Array<{
        category: string;
        title: string;
        content: string;
        confidence: number;
        tags?: string[];
      }>;

      try {
        memories = JSON.parse(content);
      } catch {
        return 0;
      }

      if (!Array.isArray(memories)) return 0;

      // Store each memory
      let stored = 0;
      for (const mem of memories.slice(0, 5)) {
        try {
          await ctx.runMutation(api.memory.store, {
            projectId,
            category: mem.category,
            title: mem.title,
            content: mem.content,
            confidence: Math.max(0.1, Math.min(0.95, mem.confidence)),
            sourceAgentRole: agentRole,
            sourceMissionId: missionId,
            tags: mem.tags,
          });
          stored++;
        } catch (e) {
          console.error("Failed to store memory:", e);
        }
      }

      return stored;
    } catch (e) {
      console.error("Memory extraction failed:", e);
      return 0;
    }
  },
});
