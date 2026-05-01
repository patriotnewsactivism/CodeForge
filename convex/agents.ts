import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

const DEFAULTS = {
  DEEPSEEK_ENDPOINT: "",
  DEEPSEEK_API_KEY: "",
  GROK_ENDPOINT: "",
  GROK_API_KEY: "",
};

const AGENT_MODELS = [
  {
    id: "deepseek-v3.2",
    model: "DeepSeek-V3-0324",
    endpoint: () =>
      process.env.DEEPSEEK_ENDPOINT || DEFAULTS.DEEPSEEK_ENDPOINT,
    apiKey: () => process.env.DEEPSEEK_API_KEY || DEFAULTS.DEEPSEEK_API_KEY,
    inputCostPer1M: 0.28,
    outputCostPer1M: 0.42,
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  {
    id: "grok-4.1-fast",
    model: "grok-4-1-fast-reasoning",
    endpoint: () => process.env.GROK_ENDPOINT || DEFAULTS.GROK_ENDPOINT,
    apiKey: () => process.env.GROK_API_KEY || DEFAULTS.GROK_API_KEY,
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5,
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  {
    id: "kimi-k2.6",
    model: "Kimi-K2.6",
    endpoint: () => process.env.KIMI_ENDPOINT || DEFAULTS.DEEPSEEK_ENDPOINT,
    apiKey: () => process.env.KIMI_API_KEY || DEFAULTS.DEEPSEEK_API_KEY,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.35,
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
];

// List agent tasks by session
export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  returns: v.array(
    v.object({
      _id: v.id("agentTasks"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      sessionId: v.id("sessions"),
      parentTaskId: v.optional(v.string()),
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
      agentIndex: v.number(),
    })
  ),
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("agentTasks")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
  },
});

// List active agent tasks by parent grouping
export const listByParent = query({
  args: { parentTaskId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("agentTasks"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      sessionId: v.id("sessions"),
      parentTaskId: v.optional(v.string()),
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
      agentIndex: v.number(),
    })
  ),
  handler: async (ctx, { parentTaskId }) => {
    return await ctx.db
      .query("agentTasks")
      .withIndex("by_parent", (q) => q.eq("parentTaskId", parentTaskId))
      .collect();
  },
});

// Create an agent task
export const createTask = mutation({
  args: {
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    parentTaskId: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    model: v.string(),
    agentIndex: v.number(),
  },
  returns: v.id("agentTasks"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentTasks", {
      ...args,
      status: "queued",
    });
  },
});

// Update task status
export const updateTask = mutation({
  args: {
    taskId: v.id("agentTasks"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    result: v.optional(v.string()),
    filesCreated: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { taskId, ...updates }) => {
    // Remove undefined values
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }
    await ctx.db.patch(taskId, cleanUpdates);
    return null;
  },
});

// The orchestrator: decompose a task into subtasks
export const orchestrate = action({
  args: {
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    userPrompt: v.string(),
    agentCount: v.number(), // 2-10 agents
  },
  returns: v.object({
    parentTaskId: v.string(),
    taskCount: v.number(),
  }),
  handler: async (ctx, { projectId, sessionId, userPrompt, agentCount }) => {
    const clampedCount = Math.min(Math.max(agentCount, 2), 10);
    const parentTaskId = `multi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Get project files for context
    const files = await ctx.runQuery(api.files.listWithContent, { projectId });
    const fileList = files
      .filter((f: { type: string }) => f.type === "file")
      .map((f: { path: string }) => f.path)
      .join("\n");

    // Step 1: Use AI to decompose the task
    const endpoint =
      process.env.DEEPSEEK_ENDPOINT || DEFAULTS.DEEPSEEK_ENDPOINT;
    const apiKey = process.env.DEEPSEEK_API_KEY || DEFAULTS.DEEPSEEK_API_KEY;

    const decompositionPrompt = `You are a project manager for CodeForge, an AI coding platform. Break down the user's request into exactly ${clampedCount} independent, parallelizable subtasks that different AI agents can work on simultaneously.

IMPORTANT: Each subtask must be independently executable — agents cannot see each other's output. Design tasks so they work on DIFFERENT files or aspects of the project.

Current project files:
${fileList || "(empty project)"}

Return ONLY a JSON array of exactly ${clampedCount} objects, each with:
- "title": Short task name (e.g., "Build navigation component")
- "description": Detailed instructions for the agent, including specific file paths to create/modify
- "model": One of "deepseek-v3.2", "grok-4.1-fast", or "kimi-k2.6" (distribute evenly for speed and diversity)

Return ONLY valid JSON array, no markdown, no explanation.`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "DeepSeek-V3-0324",
        messages: [
          { role: "system", content: decompositionPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Orchestrator AI error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    let content = data.choices[0]?.message?.content?.trim() || "[]";
    if (content.startsWith("```")) {
      content = content
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }

    let tasks: Array<{
      title: string;
      description: string;
      model: string;
    }>;
    try {
      tasks = JSON.parse(content);
    } catch {
      // Fallback: create generic tasks
      tasks = [
        {
          title: "Build core structure",
          description: `Build the main structure for: ${userPrompt}`,
          model: "deepseek-v3.2",
        },
        {
          title: "Build UI components",
          description: `Build the UI/frontend components for: ${userPrompt}`,
          model: "grok-4.1-fast",
        },
      ];
    }

    if (!Array.isArray(tasks)) tasks = [tasks];
    tasks = tasks.slice(0, clampedCount);

    // Create task records in DB
    const taskIds: string[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const taskId = await ctx.runMutation(api.agents.createTask, {
        projectId,
        sessionId,
        parentTaskId,
        title: t.title || `Agent ${i + 1}`,
        description: t.description || userPrompt,
        model: t.model || (["deepseek-v3.2", "grok-4.1-fast", "kimi-k2.6"][i % 3]),
        agentIndex: i,
      });
      taskIds.push(taskId);
    }

    // Step 2: Launch all agents truly in parallel using scheduler
    // Each agent runs as an independent Convex action — no blocking!
    for (const taskId of taskIds) {
      await ctx.scheduler.runAfter(0, api.agents.executeAgent, {
        taskId: taskId as any,
        projectId,
        sessionId,
        userPrompt,
      });
    }

    // Save orchestrator message to chat so user sees it
    await ctx.runMutation(api.chatMessages.send, {
      sessionId,
      content: `🚀 **Multi-Agent Build launched** — ${taskIds.length} agents working in parallel.\n\nWatch the dashboard above for real-time progress. Files will appear in your file tree as each agent completes.`,
      role: "assistant",
      model: "orchestrator",
    });

    return { parentTaskId, taskCount: taskIds.length };
  },
});

// Execute a single agent task
export const executeAgent = action({
  args: {
    taskId: v.id("agentTasks"),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    userPrompt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { taskId, projectId, sessionId, userPrompt }) => {
    // Get the task details
    const tasks = await ctx.runQuery(api.agents.listBySession, { sessionId });
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return null;

    // Mark as running
    await ctx.runMutation(api.agents.updateTask, {
      taskId,
      status: "running",
      startedAt: Date.now(),
    });

    // Get project files for context
    const files = await ctx.runQuery(api.files.listWithContent, { projectId });
    const fileSummary = files
      .filter((f: { type: string }) => f.type === "file")
      .slice(0, 20)
      .map(
        (f: { path: string; content: string | null }) =>
          `--- ${f.path} ---\n${(f.content || "").slice(0, 1000)}`
      )
      .join("\n\n");

    const systemPrompt = `You are Agent #${task.agentIndex + 1} working in CodeForge, a multi-agent coding platform. You are one of several agents working in PARALLEL on different parts of the same project.

Your specific assignment: ${task.description}

The overall user request: ${userPrompt}

CRITICAL — File Creation Format:
When you generate code files, use this exact format so files are automatically created:

\`\`\`lang:path/to/filename.ext
file content here
\`\`\`

Examples:
\`\`\`html:index.html
<!DOCTYPE html>...
\`\`\`

Always use the lang:path format for ALL code you generate. This automatically creates files in the project.

Current project files:
${fileSummary || "(empty project)"}

Focus ONLY on your assigned task. Generate complete, working, production-ready code. Be thorough.`;

    // Pick model config
    const modelConfig =
      AGENT_MODELS.find((m) => m.id === task.model) || AGENT_MODELS[0];

    try {
      const response = await fetch(modelConfig.endpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [modelConfig.authHeader]: `${modelConfig.authPrefix}${modelConfig.apiKey()}`,
        },
        body: JSON.stringify({
          model: modelConfig.model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Execute your assigned task: ${task.title}\n\nDetails: ${task.description}`,
            },
          ],
          max_tokens: 8192,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${modelConfig.id} API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const content =
        data.choices[0]?.message?.content || "No response generated.";
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const cost =
        (inputTokens / 1_000_000) * modelConfig.inputCostPer1M +
        (outputTokens / 1_000_000) * modelConfig.outputCostPer1M;

      // Parse and create files
      let filesCreated = 0;
      const fileBlockRegex = /```[a-zA-Z]*:([^\n]+)\n([\s\S]*?)```/g;
      let match;
      while ((match = fileBlockRegex.exec(content)) !== null) {
        const filePath = match[1].trim();
        const fileContent = match[2];
        const fileName = filePath.split("/").pop() || filePath;
        try {
          await ctx.runMutation(api.files.createFromAI, {
            projectId,
            path: filePath,
            name: fileName,
            content: fileContent,
          });
          filesCreated++;
        } catch (e) {
          console.error(`Agent ${task.agentIndex}: Failed to create ${filePath}`, e);
        }
      }

      // Update session cost
      await ctx.runMutation(api.sessions.addCost, {
        sessionId,
        inputTokens,
        outputTokens,
        cost,
      });

      // Also save the agent's response as a chat message
      await ctx.runMutation(api.chatMessages.send, {
        sessionId,
        content: `**🤖 Agent ${task.agentIndex + 1}: ${task.title}**\n\n${content}`,
        role: "assistant",
        model: task.model,
        inputTokens,
        outputTokens,
        cost,
      });

      // Mark completed
      await ctx.runMutation(api.agents.updateTask, {
        taskId,
        status: "completed",
        result: content.slice(0, 5000), // Store truncated
        filesCreated,
        inputTokens,
        outputTokens,
        cost,
        completedAt: Date.now(),
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(api.agents.updateTask, {
        taskId,
        status: "failed",
        result: errMsg,
        completedAt: Date.now(),
      });
    }

    return null;
  },
});
