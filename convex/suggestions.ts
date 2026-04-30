import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

declare const process: { env: Record<string, string | undefined> };

const DEFAULTS = {
  DEEPSEEK_ENDPOINT: "",
  DEEPSEEK_API_KEY: "",
};

// List suggestions for a project
export const listByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("suggestions"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      title: v.string(),
      description: v.string(),
      category: v.string(),
      priority: v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      ),
      prompt: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("dismissed")
      ),
    })
  ),
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("suggestions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

// Dismiss a suggestion
export const dismiss = mutation({
  args: { suggestionId: v.id("suggestions") },
  returns: v.null(),
  handler: async (ctx, { suggestionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(suggestionId, { status: "dismissed" });
    return null;
  },
});

// Mark suggestion as in progress
export const markInProgress = mutation({
  args: { suggestionId: v.id("suggestions") },
  returns: v.null(),
  handler: async (ctx, { suggestionId }) => {
    await ctx.db.patch(suggestionId, { status: "in_progress" });
    return null;
  },
});

// Mark suggestion as completed
export const markCompleted = mutation({
  args: { suggestionId: v.id("suggestions") },
  returns: v.null(),
  handler: async (ctx, { suggestionId }) => {
    await ctx.db.patch(suggestionId, { status: "completed" });
    return null;
  },
});

// Save suggestions to DB
export const saveSuggestions = mutation({
  args: {
    projectId: v.id("projects"),
    suggestions: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        category: v.string(),
        priority: v.union(
          v.literal("high"),
          v.literal("medium"),
          v.literal("low")
        ),
        prompt: v.string(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, suggestions }) => {
    // Clear old pending suggestions first
    const existing = await ctx.db
      .query("suggestions")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", projectId).eq("status", "pending")
      )
      .collect();
    for (const s of existing) {
      await ctx.db.delete(s._id);
    }
    // Insert new ones
    for (const s of suggestions) {
      await ctx.db.insert("suggestions", {
        projectId,
        ...s,
        status: "pending",
      });
    }
    return null;
  },
});

// Generate suggestions using AI
export const generate = action({
  args: { projectId: v.id("projects") },
  returns: v.number(), // number of suggestions generated
  handler: async (ctx, { projectId }) => {
    // Get project files for context
    const files = await ctx.runQuery(api.files.listWithContent, { projectId });

    if (files.length === 0) {
      return 0;
    }

    // Build file summary
    const fileSummary = files
      .filter((f: { type: string }) => f.type === "file")
      .slice(0, 30) // Limit to 30 files for token budget
      .map(
        (f: { path: string; content: string | null }) =>
          `--- ${f.path} ---\n${(f.content || "").slice(0, 1500)}`
      )
      .join("\n\n");

    const systemPrompt = `You are a senior code analyst for CodeForge. Analyze the user's project files and generate actionable improvement suggestions. Each suggestion should be specific, useful, and one-click executable.

Return ONLY a JSON array of suggestions. Each suggestion must have:
- "title": Short, action-oriented title (e.g., "Add dark mode toggle")
- "description": 1-2 sentence explanation of what it does and why
- "category": One of "feature", "fix", "performance", "style", "security"
- "priority": "high", "medium", or "low"
- "prompt": The exact prompt that CodeForge AI should execute to implement this. Be specific — include file paths, frameworks, etc.

Generate 5-8 suggestions. Focus on:
1. Missing best practices (error handling, validation, a11y)
2. Feature enhancements the project would benefit from
3. Performance optimizations
4. Security improvements
5. Code quality / DX improvements

Return ONLY valid JSON array, no markdown, no explanation.`;

    const endpoint =
      process.env.DEEPSEEK_ENDPOINT || DEFAULTS.DEEPSEEK_ENDPOINT;
    const apiKey = process.env.DEEPSEEK_API_KEY || DEFAULTS.DEEPSEEK_API_KEY;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "DeepSeek-V3-0324",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Here are my project files:\n\n${fileSummary}`,
          },
        ],
        max_tokens: 4096,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content || "[]";

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let suggestions: Array<{
      title: string;
      description: string;
      category: string;
      priority: "high" | "medium" | "low";
      prompt: string;
    }>;
    try {
      suggestions = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse suggestions JSON:", jsonStr);
      return 0;
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) return 0;

    // Validate and clean
    const validCategories = [
      "feature",
      "fix",
      "performance",
      "style",
      "security",
    ];
    const validPriorities = ["high", "medium", "low"];
    const cleaned = suggestions
      .filter(
        (s) =>
          s.title &&
          s.description &&
          s.prompt &&
          validCategories.includes(s.category) &&
          validPriorities.includes(s.priority)
      )
      .slice(0, 8);

    // Save to DB
    await ctx.runMutation(api.suggestions.saveSuggestions, {
      projectId,
      suggestions: cleaned,
    });

    return cleaned.length;
  },
});
