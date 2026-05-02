/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — TOOL-CALLING AGENT ENGINE
 * ═══════════════════════════════════════════════════════════════════
 *
 * The core of CodeForge. Agents run in an agentic loop:
 *   THINK → ACT (tool calls) → OBSERVE (results) → REPEAT
 *
 * Instead of generating markdown and parsing it with regex,
 * agents use OpenAI function-calling to explicitly invoke tools.
 * Every tool call is recorded for full audit trail + live UI.
 */
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };

// ─── Model Configuration ────────────────────────────────────────
interface ModelConfig {
  id: string;
  model: string;
  endpoint: () => string;
  apiKey: () => string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  role: string;
  maxIterations: number;
}

const MODELS: ModelConfig[] = [
  {
    id: "grok-4.1-fast",
    model: "grok-4-1-fast-reasoning",
    endpoint: () => process.env.GROK_ENDPOINT || "",
    apiKey: () => process.env.GROK_API_KEY || "",
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5,
    role: "lead",
    maxIterations: 15,
  },
  {
    id: "deepseek-v3.2",
    model: "DeepSeek-V3-0324",
    endpoint: () => process.env.DEEPSEEK_ENDPOINT || "",
    apiKey: () => process.env.DEEPSEEK_API_KEY || "",
    inputCostPer1M: 0.28,
    outputCostPer1M: 0.42,
    role: "coder",
    maxIterations: 20,
  },
  {
    id: "kimi-k2.6",
    model: "Kimi-K2.6",
    endpoint: () => process.env.KIMI_ENDPOINT || "",
    apiKey: () => process.env.KIMI_API_KEY || "",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.35,
    role: "worker",
    maxIterations: 12,
  },
];

const getModel = (id: string) => MODELS.find((m) => m.id === id) || MODELS[0];
const MAX_DEPTH = 4;
const MAX_AGENTS_PER_MISSION = 25;

// ─── Tool Definitions (OpenAI Function Calling Schema) ──────────
const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_file",
      description: "Create a new file in the project. Use full paths like 'src/components/App.tsx'. Will create parent directories automatically.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Full file path (e.g. 'src/App.tsx')" },
          content: { type: "string", description: "Complete file content" },
          language: { type: "string", description: "Programming language (e.g. 'typescript', 'css', 'python')" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_file",
      description: "Edit an existing file by replacing a specific section. Provide the old content to find and the new content to replace it with. For full rewrites, use create_file instead.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to edit" },
          old_content: { type: "string", description: "Exact content to find and replace" },
          new_content: { type: "string", description: "New content to insert" },
        },
        required: ["path", "old_content", "new_content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_file",
      description: "Delete a file from the project.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to delete" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read the content of a file. Use this to understand existing code before editing.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "List all files in the project or a specific directory.",
      parameters: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Directory to list (empty for root)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_files",
      description: "Search for a text pattern across all project files. Returns matching file paths and line content.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text or pattern to search for" },
          file_pattern: { type: "string", description: "Optional glob pattern to filter files (e.g. '*.tsx')" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "spawn_agent",
      description: "Create a child agent to work on a sub-task in parallel. The child agent gets its own tool-calling loop. Use for decomposing complex tasks.",
      parameters: {
        type: "object",
        properties: {
          role: {
            type: "string",
            enum: ["coder", "reviewer", "debugger", "tester", "architect"],
            description: "Role of the child agent",
          },
          title: { type: "string", description: "Short title for the task" },
          description: { type: "string", description: "Detailed description of what the child should do" },
          model: {
            type: "string",
            enum: ["deepseek-v3.2", "grok-4.1-fast", "kimi-k2.6"],
            description: "AI model to use (deepseek for coding, grok for complex reasoning, kimi for quick tasks)",
          },
        },
        required: ["role", "title", "description"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_message",
      description: "Send a message to another agent or broadcast to all agents in this mission.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["context", "warning", "dependency", "handoff"],
            description: "Message type",
          },
          content: { type: "string", description: "Message content" },
          to_agent_id: { type: "string", description: "Target agent ID (omit to broadcast)" },
        },
        required: ["type", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_task",
      description: "Signal that your task is complete. Always call this when finished. Include a summary of what was accomplished.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Summary of what was accomplished" },
          files_created: { type: "number", description: "Number of files created" },
          files_modified: { type: "number", description: "Number of files modified" },
        },
        required: ["summary"],
      },
    },
  },
];

// Reduced toolset for non-orchestrator roles (no spawning to reduce costs)
const WORKER_TOOLS = AGENT_TOOLS.filter(
  (t) => t.function.name !== "spawn_agent"
);

// ─── Role Prompts ───────────────────────────────────────────────
const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  orchestrator: `You are the Orchestrator Agent of CodeForge — an autonomous coding platform.

Your job: Break down the user's request into concrete sub-tasks and coordinate their execution.

Rules:
- ALWAYS start by reading existing files with list_files and read_file to understand the codebase
- Break complex tasks into focused sub-tasks, each assigned to a specialist agent via spawn_agent
- For simple requests (< 3 files), do the work yourself instead of spawning agents
- Assign the right model: deepseek-v3.2 for coding, grok-4.1-fast for architecture/complex logic, kimi-k2.6 for quick tasks
- After spawning agents, call complete_task — children run in parallel
- Always create COMPLETE, WORKING files — never placeholders or TODOs`,

  architect: `You are the Architect Agent. You design system architecture and file structure.

Rules:
- Read existing files before proposing changes
- Create clear, well-organized file structures
- Write configuration files, type definitions, and setup code
- Document architectural decisions in comments`,

  coder: `You are the Coder Agent. You write production-quality code.

Rules:
- ALWAYS read existing files first with read_file before editing
- Write COMPLETE implementations — no TODOs, no placeholders, no "add your code here"
- Use edit_file for modifying existing files, create_file for new ones
- Follow the existing codebase patterns and conventions
- Include proper imports, error handling, and types
- When creating React components: include all imports, proper TypeScript types, and export`,

  reviewer: `You are the Reviewer Agent. You review code for quality, bugs, and improvements.

Rules:
- Read all files with read_file
- Look for bugs, type errors, missing imports, security issues
- Fix issues directly with edit_file — don't just report them
- Check for consistency across files`,

  debugger: `You are the Debugger Agent. You find and fix bugs.

Rules:
- Read the relevant files with read_file
- Trace the issue through the code
- Fix the root cause with edit_file, not just the symptom
- Verify related files aren't affected`,

  tester: `You are the Tester Agent. You validate code correctness.

Rules:
- Read the code under test with read_file
- Create test files with create_file
- Check edge cases and error paths
- Report issues by editing the code directly`,
};

// ─── Tool Execution ─────────────────────────────────────────────

interface ToolCallArgs {
  ctx: any;
  toolName: string;
  toolInput: Record<string, any>;
  projectId: Id<"projects">;
  agentRunId: Id<"agentRuns">;
  missionId: Id<"missions">;
  depth: number;
  sessionId: Id<"sessions">;
  userPrompt: string;
}

async function executeTool(args: ToolCallArgs): Promise<string> {
  const { ctx, toolName, toolInput, projectId, agentRunId, missionId, depth, sessionId, userPrompt } = args;

  switch (toolName) {
    case "create_file": {
      const { path, content, language } = toolInput;
      // Create parent folders
      const parts = path.split("/");
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join("/");
        const existing = await ctx.runQuery(internal.engine.getFileByPath, { projectId, path: folderPath });
        if (!existing) {
          await ctx.runMutation(internal.engine.upsertFile, {
            projectId, path: folderPath, name: parts[i - 1],
            type: "folder", content: undefined, language: undefined,
            lastModifiedBy: agentRunId,
          });
        }
      }
      await ctx.runMutation(internal.engine.upsertFile, {
        projectId, path, name: parts[parts.length - 1],
        type: "file", content, language: language || detectLanguage(path),
        lastModifiedBy: agentRunId,
      });
      return `Created file: ${path} (${content.length} chars)`;
    }

    case "edit_file": {
      const { path, old_content, new_content } = toolInput;
      const file = await ctx.runQuery(internal.engine.getFileByPath, { projectId, path });
      if (!file || !file.content) return `Error: File not found: ${path}`;
      if (!file.content.includes(old_content)) {
        return `Error: Could not find the specified content in ${path}. Use read_file to see the current content.`;
      }
      const updated = file.content.replace(old_content, new_content);
      await ctx.runMutation(internal.engine.upsertFile, {
        projectId, path, name: file.name, type: "file",
        content: updated, language: file.language,
        lastModifiedBy: agentRunId,
      });
      return `Edited file: ${path} (replaced ${old_content.length} chars with ${new_content.length} chars)`;
    }

    case "delete_file": {
      const { path } = toolInput;
      await ctx.runMutation(internal.engine.deleteFile, { projectId, path });
      return `Deleted file: ${path}`;
    }

    case "read_file": {
      const { path } = toolInput;
      const file = await ctx.runQuery(internal.engine.getFileByPath, { projectId, path });
      if (!file) return `Error: File not found: ${path}`;
      if (file.type === "folder") return `${path} is a directory. Use list_files to see its contents.`;
      return file.content || "(empty file)";
    }

    case "list_files": {
      const { directory } = toolInput;
      const files = await ctx.runQuery(internal.engine.listProjectFiles, { projectId });
      const prefix = directory ? (directory.endsWith("/") ? directory : directory + "/") : "";
      const filtered = prefix
        ? files.filter((f: { path: string }) => f.path.startsWith(prefix))
        : files;
      if (filtered.length === 0) return prefix ? `No files found in ${directory}/` : "Project is empty. Start creating files!";
      return filtered
        .map((f: { path: string; type: string; size?: number | null }) =>
          `${f.type === "folder" ? "📁" : "📄"} ${f.path}${f.size ? ` (${f.size} bytes)` : ""}`
        )
        .join("\n");
    }

    case "search_files": {
      const { query, file_pattern } = toolInput;
      const files = await ctx.runQuery(internal.engine.listProjectFiles, { projectId });
      const results: string[] = [];
      const queryLower = query.toLowerCase();
      for (const file of files) {
        if (file.type !== "file" || !file.content) continue;
        if (file_pattern && !matchGlob(file.path, file_pattern)) continue;
        const lines = file.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            results.push(`${file.path}:${i + 1}: ${lines[i].trim()}`);
          }
        }
        if (results.length > 50) break;
      }
      return results.length > 0
        ? `Found ${results.length} matches:\n${results.slice(0, 30).join("\n")}`
        : `No matches found for "${query}"`;
    }

    case "spawn_agent": {
      const { role, title, description, model } = toolInput;
      // Check limits
      const existingAgents = await ctx.runQuery(internal.engine.countMissionAgents, { missionId });
      if (existingAgents >= MAX_AGENTS_PER_MISSION) {
        return `Error: Agent limit reached (${MAX_AGENTS_PER_MISSION}). Complete existing tasks first.`;
      }
      if (depth + 1 > MAX_DEPTH) {
        return `Error: Max agent depth reached (${MAX_DEPTH}). Do this task yourself instead.`;
      }
      // Create child agent
      const childId = await ctx.runMutation(internal.engine.createAgentRun, {
        missionId, projectId,
        parentAgentId: agentRunId,
        role: role || "coder",
        title,
        description,
        model: model || "deepseek-v3.2",
        depth: depth + 1,
      });
      // Schedule child to run
      await ctx.scheduler.runAfter(0, internal.engine.runAgentLoop, {
        agentRunId: childId, missionId, projectId,
        sessionId, userPrompt: description,
      });
      return `Spawned ${role} agent: "${title}" (id: ${childId})`;
    }

    case "send_message": {
      const { type, content, to_agent_id } = toolInput;
      await ctx.runMutation(internal.engine.insertAgentMessage, {
        missionId,
        fromAgentId: agentRunId,
        toAgentId: to_agent_id || undefined,
        type: type || "context",
        content,
      });
      return `Message sent${to_agent_id ? ` to agent ${to_agent_id}` : " (broadcast)"}`;
    }

    case "complete_task": {
      const { summary, files_created, files_modified } = toolInput;
      await ctx.runMutation(internal.engine.completeAgentRun, {
        agentRunId,
        result: summary,
        filesCreated: files_created || 0,
        filesModified: files_modified || 0,
      });
      return `Task completed: ${summary}`;
    }

    default:
      return `Error: Unknown tool: ${toolName}`;
  }
}

// ─── AI Call with Tools ─────────────────────────────────────────

interface AIResponse {
  content: string | null;
  toolCalls: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
}

async function callAIWithTools(
  modelConfig: ModelConfig,
  messages: Array<{ role: string; content?: string | null; tool_calls?: any; tool_call_id?: string; name?: string }>,
  tools: typeof AGENT_TOOLS,
): Promise<AIResponse> {
  const endpoint = modelConfig.endpoint();
  const apiKey = modelConfig.apiKey();

  if (!endpoint || !apiKey) {
    throw new Error(`Model ${modelConfig.id} not configured — missing endpoint or API key`);
  }

  const body: Record<string, any> = {
    model: modelConfig.model,
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.3,
    max_tokens: 8192,
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI API error (${resp.status}): ${text.slice(0, 500)}`);
  }

  const data = await resp.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("No choices in AI response");

  return {
    content: choice.message?.content || null,
    toolCalls: choice.message?.tool_calls || [],
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    finishReason: choice.finish_reason || "unknown",
  };
}

// ═══════════════════════════════════════════════════════════════════
// THE AGENT LOOP — The heart of CodeForge v2
// ═══════════════════════════════════════════════════════════════════

export const runAgentLoop = internalAction({
  args: {
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    userPrompt: v.string(),
  },
  handler: async (ctx, { agentRunId, missionId, projectId, sessionId, userPrompt }) => {
    // Fetch agent details
    const agent = await ctx.runQuery(internal.engine.getAgentRun, { agentRunId });
    if (!agent) return;

    const modelConfig = getModel(agent.model);
    const rolePrompt = ROLE_SYSTEM_PROMPTS[agent.role] || ROLE_SYSTEM_PROMPTS.coder;
    const isOrchestrator = agent.role === "orchestrator";
    const tools = isOrchestrator ? AGENT_TOOLS : WORKER_TOOLS;
    const maxIter = modelConfig.maxIterations;

    // Mark agent as running
    await ctx.runMutation(internal.engine.updateAgentStatus, {
      agentRunId,
      status: "running",
      startedAt: Date.now(),
    });

    // Build initial messages
    const conversationMessages: Array<{ role: string; content?: string | null; tool_calls?: any; tool_call_id?: string; name?: string }> = [
      {
        role: "system",
        content: `${rolePrompt}\n\nProject ID: ${projectId}\nYour Agent ID: ${agentRunId}\nYour depth: ${agent.depth}/${MAX_DEPTH}\n\nIMPORTANT: When you're done, ALWAYS call complete_task with a summary. Never end without calling complete_task.`,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    // Inject memory context if available
    try {
      const memories = await ctx.runQuery(internal.engine.getRelevantMemories, {
        projectId, limit: 5,
      });
      if (memories.length > 0) {
        const memCtx = memories.map((m: { title: string; content: string }) => `• ${m.title}: ${m.content}`).join("\n");
        conversationMessages[0].content += `\n\n🧠 Relevant memories from past missions:\n${memCtx}`;
      }
    } catch (e) {
      // Non-fatal
    }

    // Inject messages from other agents
    try {
      const msgs = await ctx.runQuery(internal.engine.getAgentMessagesFor, {
        missionId, agentRunId,
      });
      if (msgs.length > 0) {
        const msgCtx = msgs.map((m: { type: string; content: string }) => `[${m.type}] ${m.content}`).join("\n");
        conversationMessages[0].content += `\n\n📬 Messages from other agents:\n${msgCtx}`;
      }
    } catch (e) {
      // Non-fatal
    }

    let totalCost = 0;
    let totalTokens = 0;
    let completed = false;

    // ─── THE LOOP ───────────────────────────────────────────────
    for (let iteration = 0; iteration < maxIter && !completed; iteration++) {
      // Log thinking phase
      await ctx.runMutation(internal.engine.insertThought, {
        agentRunId, missionId, iteration,
        phase: "thinking",
        content: iteration === 0
          ? `Starting task: ${agent.title}`
          : `Iteration ${iteration + 1}: reviewing results and continuing...`,
      });

      // Update loop iteration
      await ctx.runMutation(internal.engine.updateAgentIteration, {
        agentRunId, iteration,
      });

      // Call AI
      let response: AIResponse;
      try {
        response = await callAIWithTools(modelConfig, conversationMessages, tools);
      } catch (e: any) {
        await ctx.runMutation(internal.engine.failAgentRun, {
          agentRunId, error: `AI call failed: ${e.message}`,
        });
        return;
      }

      // Track costs
      const iterCost =
        (response.inputTokens / 1_000_000) * modelConfig.inputCostPer1M +
        (response.outputTokens / 1_000_000) * modelConfig.outputCostPer1M;
      totalCost += iterCost;
      totalTokens += response.inputTokens + response.outputTokens;

      // If the AI returned text content (with or without tool calls), add it
      if (response.content) {
        conversationMessages.push({
          role: "assistant",
          content: response.content,
          tool_calls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
        });
      } else if (response.toolCalls.length > 0) {
        conversationMessages.push({
          role: "assistant",
          content: null,
          tool_calls: response.toolCalls,
        });
      }

      // No tool calls = done (or model confused)
      if (response.toolCalls.length === 0) {
        if (!completed) {
          // Force completion
          await ctx.runMutation(internal.engine.completeAgentRun, {
            agentRunId,
            result: response.content || "Task completed (no tool calls).",
            filesCreated: 0,
            filesModified: 0,
          });
          completed = true;
        }
        break;
      }

      // Execute each tool call
      await ctx.runMutation(internal.engine.insertThought, {
        agentRunId, missionId, iteration,
        phase: "acting",
        content: `Executing ${response.toolCalls.length} tool call(s): ${response.toolCalls.map((tc: any) => tc.function.name).join(", ")}`,
      });

      for (const toolCall of response.toolCalls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, any> = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        // Record tool call start
        const toolCallId = await ctx.runMutation(internal.engine.insertToolCall, {
          agentRunId, missionId,
          toolName: fnName,
          toolInput: JSON.stringify(fnArgs),
          filePath: fnArgs.path || undefined,
        });

        // Execute
        let result: string;
        try {
          result = await executeTool({
            ctx, toolName: fnName, toolInput: fnArgs,
            projectId, agentRunId, missionId, depth: agent.depth,
            sessionId, userPrompt,
          });
        } catch (e: any) {
          result = `Error executing ${fnName}: ${e.message}`;
        }

        // Record tool call result
        await ctx.runMutation(internal.engine.completeToolCall, {
          toolCallId,
          toolOutput: result,
          status: result.startsWith("Error") ? "error" : "success",
        });

        // Check if this was complete_task
        if (fnName === "complete_task") {
          completed = true;
        }

        // Add tool result to conversation
        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Log observation phase
      await ctx.runMutation(internal.engine.insertThought, {
        agentRunId, missionId, iteration,
        phase: "observing",
        content: `Completed ${response.toolCalls.length} actions. ${completed ? "Task complete." : "Continuing..."}`,
      });
    }

    // Update final costs
    await ctx.runMutation(internal.engine.updateAgentCost, {
      agentRunId, cost: totalCost, totalTokens,
    });

    // If this agent has no parent (root orchestrator), finalize the mission
    if (!agent.parentAgentId) {
      // Check if all agents are done
      await ctx.scheduler.runAfter(2000, internal.engine.checkMissionComplete, {
        missionId,
      });
    }
  },
});

// ─── Mission Launcher ───────────────────────────────────────────

export const launchMission = internalAction({
  args: {
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    prompt: v.string(),
    model: v.string(),
  },
  handler: async (ctx, { missionId, projectId, sessionId, prompt, model }) => {
    // Determine if this needs an orchestrator or a single agent
    const isComplex = prompt.length > 200 || /build|create|implement|full|app|system|feature/i.test(prompt);
    const role = isComplex ? "orchestrator" : "coder";
    const agentModel = isComplex ? "grok-4.1-fast" : (model || "deepseek-v3.2");

    const agentRunId = await ctx.runMutation(internal.engine.createAgentRun, {
      missionId, projectId,
      parentAgentId: undefined,
      role,
      title: isComplex ? "Mission Orchestrator" : "Code Agent",
      description: prompt,
      model: agentModel,
      depth: 0,
    });

    await ctx.runMutation(internal.engine.updateMissionStatus, {
      missionId, status: "running",
    });

    // Start the agent loop
    await ctx.scheduler.runAfter(0, internal.engine.runAgentLoop, {
      agentRunId, missionId, projectId, sessionId, userPrompt: prompt,
    });
  },
});

// ─── Mission Completion Check ───────────────────────────────────

export const checkMissionComplete = internalAction({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    const agents = await ctx.runQuery(internal.engine.getMissionAgents, { missionId });
    const running = agents.filter((a: { status: string }) =>
      a.status === "running" || a.status === "queued" || a.status === "waiting"
    );

    if (running.length > 0) {
      // Still running, check again in 3 seconds
      await ctx.scheduler.runAfter(3000, internal.engine.checkMissionComplete, { missionId });
      return;
    }

    // All done — finalize
    const totalCost = agents.reduce((sum: number, a: { cost?: number | null }) => sum + (a.cost || 0), 0);
    const totalFiles = agents.reduce((sum: number, a: { filesCreated?: number | null }) => sum + (a.filesCreated || 0), 0);
    const failed = agents.filter((a: { status: string }) => a.status === "failed");

    await ctx.runMutation(internal.engine.updateMissionComplete, {
      missionId,
      status: failed.length > 0 && failed.length === agents.length ? "failed" : "completed",
      totalAgents: agents.length,
      totalFiles,
      totalCost,
    });
  },
});

// ═══════════════════════════════════════════════════════════════════
// INTERNAL QUERIES & MUTATIONS (no auth needed — used by engine)
// ═══════════════════════════════════════════════════════════════════

export const getFileByPath = internalQuery({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, { projectId, path }) => {
    return await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) => q.eq("projectId", projectId).eq("path", path))
      .first();
  },
});

export const upsertFile = internalMutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    name: v.string(),
    type: v.union(v.literal("file"), v.literal("folder")),
    content: v.optional(v.string()),
    language: v.optional(v.string()),
    lastModifiedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) => q.eq("projectId", args.projectId).eq("path", args.path))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        language: args.language,
        size: args.content?.length || 0,
        lastModifiedBy: args.lastModifiedBy,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("files", {
        projectId: args.projectId,
        path: args.path,
        name: args.name,
        type: args.type,
        content: args.content,
        language: args.language,
        size: args.content?.length || 0,
        lastModifiedBy: args.lastModifiedBy,
      });
    }
  },
});

export const deleteFile = internalMutation({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, { projectId, path }) => {
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) => q.eq("projectId", projectId).eq("path", path))
      .first();
    if (file) await ctx.db.delete(file._id);
  },
});

export const listProjectFiles = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const getAgentRun = internalQuery({
  args: { agentRunId: v.id("agentRuns") },
  handler: async (ctx, { agentRunId }) => {
    return await ctx.db.get(agentRunId);
  },
});

export const createAgentRun = internalMutation({
  args: {
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    parentAgentId: v.optional(v.id("agentRuns")),
    role: v.string(),
    title: v.string(),
    description: v.string(),
    model: v.string(),
    depth: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentRuns", {
      ...args,
      status: "queued",
      toolCallCount: 0,
      filesCreated: 0,
      filesModified: 0,
      childrenSpawned: 0,
      totalTokens: 0,
      cost: 0,
      loopIteration: 0,
      maxIterations: 20,
    });
  },
});

export const updateAgentStatus = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    status: v.string(),
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, { agentRunId, status, startedAt }) => {
    const patch: Record<string, any> = { status };
    if (startedAt) patch.startedAt = startedAt;
    await ctx.db.patch(agentRunId, patch);
  },
});

export const updateAgentIteration = internalMutation({
  args: { agentRunId: v.id("agentRuns"), iteration: v.number() },
  handler: async (ctx, { agentRunId, iteration }) => {
    await ctx.db.patch(agentRunId, { loopIteration: iteration });
  },
});

export const updateAgentCost = internalMutation({
  args: { agentRunId: v.id("agentRuns"), cost: v.number(), totalTokens: v.number() },
  handler: async (ctx, { agentRunId, cost, totalTokens }) => {
    await ctx.db.patch(agentRunId, { cost, totalTokens });
  },
});

export const completeAgentRun = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    result: v.string(),
    filesCreated: v.number(),
    filesModified: v.number(),
  },
  handler: async (ctx, { agentRunId, result, filesCreated, filesModified }) => {
    await ctx.db.patch(agentRunId, {
      status: "completed",
      result,
      filesCreated,
      filesModified,
      completedAt: Date.now(),
    });
  },
});

export const failAgentRun = internalMutation({
  args: { agentRunId: v.id("agentRuns"), error: v.string() },
  handler: async (ctx, { agentRunId, error }) => {
    await ctx.db.patch(agentRunId, {
      status: "failed",
      error,
      completedAt: Date.now(),
    });
  },
});

export const countMissionAgents = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    const agents = await ctx.db
      .query("agentRuns")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .collect();
    return agents.length;
  },
});

export const getMissionAgents = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .collect();
  },
});

export const insertToolCall = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    toolName: v.string(),
    toolInput: v.string(),
    filePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Increment tool call count on agent
    const agent = await ctx.db.get(args.agentRunId);
    if (agent) {
      await ctx.db.patch(args.agentRunId, {
        toolCallCount: (agent.toolCallCount || 0) + 1,
      });
    }
    return await ctx.db.insert("toolCalls", {
      ...args,
      status: "executing",
      startedAt: Date.now(),
    });
  },
});

export const completeToolCall = internalMutation({
  args: {
    toolCallId: v.id("toolCalls"),
    toolOutput: v.string(),
    status: v.union(v.literal("success"), v.literal("error")),
  },
  handler: async (ctx, { toolCallId, toolOutput, status }) => {
    const tc = await ctx.db.get(toolCallId);
    await ctx.db.patch(toolCallId, {
      toolOutput,
      status,
      completedAt: Date.now(),
      duration: tc ? Date.now() - tc.startedAt : 0,
    });
  },
});

export const insertThought = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    iteration: v.number(),
    phase: v.union(
      v.literal("thinking"),
      v.literal("acting"),
      v.literal("observing"),
      v.literal("reflecting"),
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentThoughts", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const insertAgentMessage = internalMutation({
  args: {
    missionId: v.id("missions"),
    fromAgentId: v.id("agentRuns"),
    toAgentId: v.optional(v.id("agentRuns")),
    type: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentMessages", {
      missionId: args.missionId,
      fromAgentId: args.fromAgentId,
      toAgentId: args.toAgentId,
      type: args.type as any,
      content: args.content,
      isRead: false,
      timestamp: Date.now(),
    });
  },
});

export const updateMissionStatus = internalMutation({
  args: { missionId: v.id("missions"), status: v.string() },
  handler: async (ctx, { missionId, status }) => {
    await ctx.db.patch(missionId, { status: status as any });
  },
});

export const updateMissionComplete = internalMutation({
  args: {
    missionId: v.id("missions"),
    status: v.string(),
    totalAgents: v.number(),
    totalFiles: v.number(),
    totalCost: v.number(),
  },
  handler: async (ctx, { missionId, status, totalAgents, totalFiles, totalCost }) => {
    await ctx.db.patch(missionId, {
      status: status as any,
      totalAgents,
      totalFiles,
      totalCost,
      completedAt: Date.now(),
    });
  },
});

export const getRelevantMemories = internalQuery({
  args: { projectId: v.id("projects"), limit: v.number() },
  handler: async (ctx, { projectId, limit }) => {
    return await ctx.db
      .query("memories")
      .withIndex("by_project_active", (q) => q.eq("projectId", projectId).eq("isActive", true))
      .order("desc")
      .take(limit);
  },
});

export const getAgentMessagesFor = internalQuery({
  args: { missionId: v.id("missions"), agentRunId: v.id("agentRuns") },
  handler: async (ctx, { missionId, agentRunId }) => {
    // Get messages sent to this agent or broadcast
    const direct = await ctx.db
      .query("agentMessages")
      .withIndex("by_recipient", (q) => q.eq("toAgentId", agentRunId))
      .collect();
    const broadcast = await ctx.db
      .query("agentMessages")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .filter((q) => q.eq(q.field("toAgentId"), undefined))
      .collect();
    return [...direct, ...broadcast].sort((a, b) => a.timestamp - b.timestamp);
  },
});

// ═══════════════════════════════════════════════════════════════════
// PUBLIC QUERIES — Used by Frontend for real-time subscriptions
// ═══════════════════════════════════════════════════════════════════

export const getMission = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db.get(missionId);
  },
});

export const listMissionAgents = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .collect();
  },
});

export const listMissionToolCalls = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("toolCalls")
      .withIndex("by_mission_time", (q) => q.eq("missionId", missionId))
      .order("desc")
      .take(100);
  },
});

export const listAgentThoughts = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("agentThoughts")
      .withIndex("by_mission_time", (q) => q.eq("missionId", missionId))
      .order("desc")
      .take(50);
  },
});

export const listAgentToolCalls = query({
  args: { agentRunId: v.id("agentRuns") },
  handler: async (ctx, { agentRunId }) => {
    return await ctx.db
      .query("toolCalls")
      .withIndex("by_agent", (q) => q.eq("agentRunId", agentRunId))
      .collect();
  },
});

// ─── Helpers ────────────────────────────────────────────────────

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescriptreact", js: "javascript", jsx: "javascriptreact",
    py: "python", rs: "rust", go: "go", java: "java", c: "c", cpp: "cpp",
    css: "css", scss: "scss", html: "html", json: "json", yaml: "yaml", yml: "yaml",
    md: "markdown", sql: "sql", sh: "shell", bash: "shell", toml: "toml",
    xml: "xml", svg: "svg", graphql: "graphql", prisma: "prisma",
  };
  return map[ext] || "plaintext";
}

function matchGlob(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(path);
}
