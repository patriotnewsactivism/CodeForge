/**
 * AUTONOMOUS AGENT SWARM ENGINE
 *
 * The core of CodeForge's self-spawning agent system.
 * Agents can plan, code, review, debug, and spawn child agents.
 * Everything is logged to the activity stream for real-time visibility.
 */
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

// ─── Model Configuration ────────────────────────────────────────
const MODELS = [
  {
    id: "grok-4.1-fast",
    model: "grok-4-1-fast-reasoning",
    endpoint: () => process.env.GROK_ENDPOINT || "",
    apiKey: () => process.env.GROK_API_KEY || "",
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5,
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    role: "lead", // Best for orchestration & complex tasks
  },
  {
    id: "deepseek-v3.2",
    model: "DeepSeek-V3-0324",
    endpoint: () => process.env.DEEPSEEK_ENDPOINT || "",
    apiKey: () => process.env.DEEPSEEK_API_KEY || "",
    inputCostPer1M: 0.28,
    outputCostPer1M: 0.42,
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    role: "coder", // Great at code generation
  },
  {
    id: "kimi-k2.6",
    model: "Kimi-K2.6",
    endpoint: () => process.env.KIMI_ENDPOINT || "",
    apiKey: () => process.env.KIMI_API_KEY || "",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.35,
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    role: "worker", // Cost-effective for sub-tasks
  },
] as const;

const getModel = (id: string) => MODELS.find((m) => m.id === id) || MODELS[0];

const MAX_DEPTH = 4; // Max agent spawn depth
const MAX_AGENTS_PER_MISSION = 20; // Safety cap

// ─── Agent Role Definitions ─────────────────────────────────────
const AGENT_ROLES: Record<
  string,
  { emoji: string; description: string; preferredModel: string }
> = {
  orchestrator: {
    emoji: "🧠",
    description: "Breaks down the mission and coordinates agents",
    preferredModel: "grok-4.1-fast",
  },
  planner: {
    emoji: "📋",
    description: "Creates detailed implementation plans",
    preferredModel: "grok-4.1-fast",
  },
  architect: {
    emoji: "🏗️",
    description: "Designs system architecture and file structure",
    preferredModel: "grok-4.1-fast",
  },
  coder: {
    emoji: "💻",
    description: "Writes production-ready code",
    preferredModel: "deepseek-v3.2",
  },
  reviewer: {
    emoji: "🔍",
    description: "Reviews code for bugs and improvements",
    preferredModel: "grok-4.1-fast",
  },
  debugger: {
    emoji: "🐛",
    description: "Finds and fixes bugs",
    preferredModel: "deepseek-v3.2",
  },
  tester: {
    emoji: "🧪",
    description: "Writes tests and validates functionality",
    preferredModel: "kimi-k2.6",
  },
  styler: {
    emoji: "🎨",
    description: "Handles CSS, UI polish, and design",
    preferredModel: "kimi-k2.6",
  },
};

// ─── Queries ────────────────────────────────────────────────────

// Get active mission for a project
export const getActiveMission = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const missions = await ctx.db
      .query("missions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    // Return most recent non-completed mission, or most recent overall
    return (
      missions.find((m) => m.status === "running" || m.status === "planning") ||
      missions[missions.length - 1] ||
      null
    );
  },
});

// Get all missions for a project
export const listMissions = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("missions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

// Get all agent runs for a mission
export const listAgentRuns = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .collect();
  },
});

// Get children of a specific agent
export const listChildAgents = query({
  args: { parentAgentId: v.id("agentRuns") },
  handler: async (ctx, { parentAgentId }) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_parent", (q) => q.eq("parentAgentId", parentAgentId))
      .collect();
  },
});

// Get activity log for a mission (real-time feed)
export const getActivityLog = query({
  args: {
    missionId: v.id("missions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { missionId, limit }) => {
    const logs = await ctx.db
      .query("activityLog")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .order("desc")
      .take(limit || 100);
    return logs.reverse(); // Return chronological order
  },
});

// Get activity log for a specific agent
export const getAgentActivity = query({
  args: { agentRunId: v.id("agentRuns") },
  handler: async (ctx, { agentRunId }) => {
    return await ctx.db
      .query("activityLog")
      .withIndex("by_agent", (q) => q.eq("agentRunId", agentRunId))
      .collect();
  },
});

// ─── Mutations ──────────────────────────────────────────────────

// Create a new mission
export const createMission = mutation({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("missions", {
      ...args,
      status: "planning",
      totalAgentsSpawned: 0,
      totalFilesCreated: 0,
      totalCost: 0,
      startedAt: Date.now(),
    });
  },
});

// Update mission
export const updateMission = mutation({
  args: {
    missionId: v.id("missions"),
    status: v.optional(
      v.union(
        v.literal("planning"),
        v.literal("running"),
        v.literal("paused"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    plan: v.optional(v.string()),
    totalAgentsSpawned: v.optional(v.number()),
    totalFilesCreated: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, { missionId, ...updates }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(missionId, clean);
  },
});

// Create an agent run
export const createAgentRun = mutation({
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
    // Increment mission agent count
    const mission = await ctx.db.get(args.missionId);
    if (mission) {
      await ctx.db.patch(args.missionId, {
        totalAgentsSpawned: (mission.totalAgentsSpawned || 0) + 1,
      });
    }

    return await ctx.db.insert("agentRuns", {
      ...args,
      status: "queued",
      childCount: 0,
      filesCreated: 0,
      filesModified: 0,
    });
  },
});

// Update agent run status
export const updateAgentRun = mutation({
  args: {
    agentRunId: v.id("agentRuns"),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("thinking"),
        v.literal("coding"),
        v.literal("reviewing"),
        v.literal("spawning"),
        v.literal("waiting"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    childCount: v.optional(v.number()),
    filesCreated: v.optional(v.number()),
    filesModified: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, { agentRunId, ...updates }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(agentRunId, clean);
  },
});

// Log an activity
export const logActivity = mutation({
  args: {
    missionId: v.id("missions"),
    agentRunId: v.id("agentRuns"),
    type: v.union(
      v.literal("thinking"),
      v.literal("plan"),
      v.literal("spawn"),
      v.literal("file_create"),
      v.literal("file_modify"),
      v.literal("file_delete"),
      v.literal("code"),
      v.literal("test"),
      v.literal("error"),
      v.literal("fix"),
      v.literal("review"),
      v.literal("complete"),
      v.literal("message")
    ),
    title: v.string(),
    detail: v.optional(v.string()),
    filePath: v.optional(v.string()),
    agentRole: v.string(),
    agentModel: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityLog", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// ─── Actions (AI Execution) ─────────────────────────────────────

// Launch a mission — the entry point
export const launchMission = action({
  args: {
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    prompt: v.string(),
  },
  handler: async (ctx, { projectId, sessionId, prompt }) => {
    // Get the session to find the userId
    const session = await ctx.runQuery(api.sessions.get, { sessionId });
    if (!session) throw new Error("Session not found");
    const userId = session.userId;

    // Create the mission
    const missionId = await ctx.runMutation(api.swarm.createMission, {
      userId,
      projectId,
      sessionId,
      prompt,
    });

    // Create the root orchestrator agent
    const orchestratorId = await ctx.runMutation(api.swarm.createAgentRun, {
      missionId,
      projectId,
      role: "orchestrator",
      title: "Mission Orchestrator",
      description: `Decompose and execute: ${prompt}`,
      model: "grok-4.1-fast",
      depth: 0,
    });

    // Log the start
    await ctx.runMutation(api.swarm.logActivity, {
      missionId,
      agentRunId: orchestratorId,
      type: "thinking",
      title: "🧠 Orchestrator analyzing your request...",
      detail: prompt,
      agentRole: "orchestrator",
      agentModel: "grok-4.1-fast",
    });

    // Post a message in chat
    await ctx.runMutation(api.chatMessages.send, {
      sessionId,
      content: `🚀 **Mission launched!** The swarm is spinning up.\n\nWatch the Activity Feed for real-time progress as agents plan, code, review, and debug autonomously.\n\n> ${prompt}`,
      role: "assistant",
      model: "orchestrator",
    });

    // Schedule the orchestrator to run (non-blocking)
    await ctx.scheduler.runAfter(0, api.swarm.runOrchestrator, {
      missionId,
      orchestratorId,
      projectId,
      sessionId,
      prompt,
    });

    return { missionId, orchestratorId };
  },
});

// The orchestrator: plans the mission and spawns agents
export const runOrchestrator = action({
  args: {
    missionId: v.id("missions"),
    orchestratorId: v.id("agentRuns"),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    prompt: v.string(),
  },
  handler: async (
    ctx,
    { missionId, orchestratorId, projectId, sessionId, prompt }
  ) => {
    try {
      // Mark orchestrator as thinking
      await ctx.runMutation(api.swarm.updateAgentRun, {
        agentRunId: orchestratorId,
        status: "thinking",
        startedAt: Date.now(),
      });

      // Get project files for context
      const files = await ctx.runQuery(api.files.listWithContent, {
        projectId,
      });
      const fileList = files
        .filter((f: { type: string }) => f.type === "file")
        .map((f: { path: string; content?: string | null }) => {
          const preview = (f.content || "").slice(0, 500);
          return `📄 ${f.path}\n${preview}${(f.content || "").length > 500 ? "\n..." : ""}`;
        })
        .join("\n\n");

      // Step 1: Create the plan
      await ctx.runMutation(api.swarm.logActivity, {
        missionId,
        agentRunId: orchestratorId,
        type: "plan",
        title: "📋 Creating execution plan...",
        agentRole: "orchestrator",
        agentModel: "grok-4.1-fast",
      });

      const planPrompt = `You are the Orchestrator of an autonomous AI agent swarm in CodeForge.

Your job: Analyze the user's request and create a detailed execution plan that will be carried out by specialized AI agents working IN PARALLEL.

Available agent roles:
- "architect" — Designs system architecture, file structure, data models
- "coder" — Writes production-ready code for specific files/features
- "styler" — Handles CSS, UI components, design system
- "tester" — Writes tests, validates functionality
- "reviewer" — Reviews code quality, finds bugs
- "debugger" — Fixes bugs and issues

RULES:
1. Create 2-8 agents. Each must work on DIFFERENT files/aspects (they run in parallel and can't see each other's output).
2. Be SPECIFIC about which files each agent should create/modify.
3. Assign the best model for each role:
   - "grok-4.1-fast" for architecture, planning, review
   - "deepseek-v3.2" for code generation
   - "kimi-k2.6" for smaller tasks (styling, tests, utilities)
4. Agents CAN spawn their own sub-agents if their task is complex enough.

Current project files:
${fileList || "(empty project — start from scratch)"}

USER REQUEST: ${prompt}

Respond with ONLY a JSON object:
{
  "plan_summary": "Brief description of what will be built",
  "agents": [
    {
      "role": "architect|coder|styler|tester|reviewer|debugger",
      "title": "Short task name",
      "description": "Detailed instructions for this agent. Include SPECIFIC file paths to create/modify.",
      "model": "grok-4.1-fast|deepseek-v3.2|kimi-k2.6",
      "can_spawn_children": true/false
    }
  ]
}`;

      const modelConfig = getModel("grok-4.1-fast");
      const planResponse = await callAI(modelConfig, planPrompt, prompt);

      // Parse the plan
      let plan: {
        plan_summary: string;
        agents: Array<{
          role: string;
          title: string;
          description: string;
          model: string;
          can_spawn_children?: boolean;
        }>;
      };

      try {
        let content = planResponse.content;
        if (content.startsWith("```")) {
          content = content
            .replace(/^```(?:json)?\n?/, "")
            .replace(/\n?```$/, "");
        }
        plan = JSON.parse(content);
      } catch {
        plan = {
          plan_summary: "Building the project",
          agents: [
            {
              role: "architect",
              title: "Design architecture",
              description: `Design and create the file structure for: ${prompt}`,
              model: "grok-4.1-fast",
            },
            {
              role: "coder",
              title: "Build core features",
              description: `Implement the main functionality for: ${prompt}`,
              model: "deepseek-v3.2",
            },
            {
              role: "styler",
              title: "Style the UI",
              description: `Create the CSS and UI components for: ${prompt}`,
              model: "kimi-k2.6",
            },
          ],
        };
      }

      // Update mission with plan
      await ctx.runMutation(api.swarm.updateMission, {
        missionId,
        status: "running",
        plan: JSON.stringify(plan),
      });

      // Update orchestrator cost
      await ctx.runMutation(api.swarm.updateAgentRun, {
        agentRunId: orchestratorId,
        status: "spawning",
        inputTokens: planResponse.inputTokens,
        outputTokens: planResponse.outputTokens,
        cost: planResponse.cost,
      });

      // Log the plan
      await ctx.runMutation(api.swarm.logActivity, {
        missionId,
        agentRunId: orchestratorId,
        type: "plan",
        title: `📋 Plan: ${plan.plan_summary}`,
        detail: `Spawning ${plan.agents.length} agents:\n${plan.agents.map((a, i) => `${i + 1}. ${AGENT_ROLES[a.role]?.emoji || "🤖"} ${a.title} (${a.role})`).join("\n")}`,
        agentRole: "orchestrator",
        agentModel: "grok-4.1-fast",
      });

      // Step 2: Spawn all agents in parallel
      const agentIds: string[] = [];
      for (const agentDef of plan.agents.slice(0, 8)) {
        const agentId = await ctx.runMutation(api.swarm.createAgentRun, {
          missionId,
          projectId,
          parentAgentId: orchestratorId,
          role: agentDef.role || "coder",
          title: agentDef.title,
          description: agentDef.description,
          model: agentDef.model || "deepseek-v3.2",
          depth: 1,
        });
        agentIds.push(agentId);

        // Log spawn
        await ctx.runMutation(api.swarm.logActivity, {
          missionId,
          agentRunId: orchestratorId,
          type: "spawn",
          title: `${AGENT_ROLES[agentDef.role]?.emoji || "🤖"} Spawned: ${agentDef.title}`,
          detail: `Role: ${agentDef.role} | Model: ${agentDef.model}`,
          agentRole: "orchestrator",
          agentModel: "grok-4.1-fast",
        });

        // Launch each agent independently (truly parallel!)
        await ctx.scheduler.runAfter(0, api.swarm.runAgent, {
          agentRunId: agentId as any,
          missionId,
          projectId,
          sessionId,
          userPrompt: prompt,
          canSpawnChildren: agentDef.can_spawn_children ?? false,
        });
      }

      // Update orchestrator
      await ctx.runMutation(api.swarm.updateAgentRun, {
        agentRunId: orchestratorId,
        status: "waiting",
        childCount: agentIds.length,
      });

      // Update session cost
      await ctx.runMutation(api.sessions.addCost, {
        sessionId,
        inputTokens: planResponse.inputTokens,
        outputTokens: planResponse.outputTokens,
        cost: planResponse.cost,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(api.swarm.updateAgentRun, {
        agentRunId: orchestratorId,
        status: "failed",
        error: errMsg,
        completedAt: Date.now(),
      });
      await ctx.runMutation(api.swarm.logActivity, {
        missionId,
        agentRunId: orchestratorId,
        type: "error",
        title: "❌ Orchestrator failed",
        detail: errMsg,
        agentRole: "orchestrator",
        agentModel: "grok-4.1-fast",
      });
      await ctx.runMutation(api.swarm.updateMission, {
        missionId,
        status: "failed",
      });
    }
  },
});

// Execute a single agent
export const runAgent = action({
  args: {
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    userPrompt: v.string(),
    canSpawnChildren: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { agentRunId, missionId, projectId, sessionId, userPrompt, canSpawnChildren }
  ) => {
    // Fetch this agent's details
    const agents = await ctx.runQuery(api.swarm.listAgentRuns, { missionId });
    const agent = agents.find((a) => a._id === agentRunId);
    if (!agent) return null;

    const roleInfo = AGENT_ROLES[agent.role] || AGENT_ROLES.coder;

    try {
      // Mark as thinking
      await ctx.runMutation(api.swarm.updateAgentRun, {
        agentRunId,
        status: "thinking",
        startedAt: Date.now(),
      });

      await ctx.runMutation(api.swarm.logActivity, {
        missionId,
        agentRunId,
        type: "thinking",
        title: `${roleInfo.emoji} ${agent.title} — Analyzing...`,
        agentRole: agent.role,
        agentModel: agent.model,
      });

      // Get project files
      const files = await ctx.runQuery(api.files.listWithContent, { projectId });
      const fileSummary = files
        .filter((f: { type: string }) => f.type === "file")
        .slice(0, 30)
        .map(
          (f: { path: string; content?: string | null }) =>
            `--- ${f.path} ---\n${(f.content || "").slice(0, 1500)}`
        )
        .join("\n\n");

      // Build role-specific prompt
      const systemPrompt = buildAgentPrompt(
        agent.role,
        agent.title,
        agent.description,
        userPrompt,
        fileSummary,
        agent.depth,
        canSpawnChildren ?? false
      );

      // Mark as coding
      await ctx.runMutation(api.swarm.updateAgentRun, {
        agentRunId,
        status: "coding",
      });

      await ctx.runMutation(api.swarm.logActivity, {
        missionId,
        agentRunId,
        type: "code",
        title: `${roleInfo.emoji} ${agent.title} — Generating code...`,
        agentRole: agent.role,
        agentModel: agent.model,
      });

      // Call the AI
      const modelConfig = getModel(agent.model);
      const result = await callAI(
        modelConfig,
        systemPrompt,
        `Execute your task: ${agent.title}\n\nDetails: ${agent.description}`
      );

      // Parse and create files
      let filesCreated = 0;
      const fileBlockRegex = /```[a-zA-Z]*:([^\n]+)\n([\s\S]*?)```/g;
      let match;
      while ((match = fileBlockRegex.exec(result.content)) !== null) {
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

          // Log each file creation
          await ctx.runMutation(api.swarm.logActivity, {
            missionId,
            agentRunId,
            type: "file_create",
            title: `📄 Created ${filePath}`,
            detail: fileContent.slice(0, 200) + (fileContent.length > 200 ? "..." : ""),
            filePath,
            agentRole: agent.role,
            agentModel: agent.model,
          });
        } catch (e) {
          await ctx.runMutation(api.swarm.logActivity, {
            missionId,
            agentRunId,
            type: "error",
            title: `⚠️ Failed to create ${filePath}`,
            detail: e instanceof Error ? e.message : String(e),
            filePath,
            agentRole: agent.role,
            agentModel: agent.model,
          });
        }
      }

      // Check if agent wants to spawn children
      if (canSpawnChildren && agent.depth < MAX_DEPTH) {
        const spawnMatch = result.content.match(
          /\[SPAWN_AGENTS\]([\s\S]*?)\[\/SPAWN_AGENTS\]/
        );
        if (spawnMatch) {
          try {
            const childDefs = JSON.parse(spawnMatch[1]);
            if (Array.isArray(childDefs)) {
              await ctx.runMutation(api.swarm.updateAgentRun, {
                agentRunId,
                status: "spawning",
              });

              let spawned = 0;
              for (const child of childDefs.slice(0, 4)) {
                // Check global limit
                const mission = await ctx.runQuery(api.swarm.getActiveMission, { projectId });
                if (
                  mission &&
                  (mission.totalAgentsSpawned || 0) >= MAX_AGENTS_PER_MISSION
                ) break;

                const childId = await ctx.runMutation(api.swarm.createAgentRun, {
                  missionId,
                  projectId,
                  parentAgentId: agentRunId,
                  role: child.role || "coder",
                  title: child.title || "Sub-task",
                  description: child.description || "Execute sub-task",
                  model: child.model || "kimi-k2.6",
                  depth: agent.depth + 1,
                });

                await ctx.runMutation(api.swarm.logActivity, {
                  missionId,
                  agentRunId,
                  type: "spawn",
                  title: `🔀 Spawned child: ${child.title}`,
                  detail: `Depth ${agent.depth + 1} | Role: ${child.role}`,
                  agentRole: agent.role,
                  agentModel: agent.model,
                });

                await ctx.scheduler.runAfter(0, api.swarm.runAgent, {
                  agentRunId: childId as any,
                  missionId,
                  projectId,
                  sessionId,
                  userPrompt,
                  canSpawnChildren: agent.depth + 1 < MAX_DEPTH - 1,
                });
                spawned++;
              }

              await ctx.runMutation(api.swarm.updateAgentRun, {
                agentRunId,
                childCount: spawned,
              });
            }
          } catch {
            // Spawn parsing failed, not critical
          }
        }
      }

      // Update cost on session
      await ctx.runMutation(api.sessions.addCost, {
        sessionId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost,
      });

      // Update mission total cost
      const currentMission = await ctx.runQuery(api.swarm.getActiveMission, { projectId });
      if (currentMission) {
        await ctx.runMutation(api.swarm.updateMission, {
          missionId,
          totalCost: (currentMission.totalCost || 0) + result.cost,
          totalFilesCreated: (currentMission.totalFilesCreated || 0) + filesCreated,
        });
      }

      // Mark completed
      await ctx.runMutation(api.swarm.updateAgentRun, {
        agentRunId,
        status: "completed",
        filesCreated,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost,
        result: result.content.slice(0, 3000),
        completedAt: Date.now(),
      });

      await ctx.runMutation(api.swarm.logActivity, {
        missionId,
        agentRunId,
        type: "complete",
        title: `✅ ${agent.title} — Done! (${filesCreated} files)`,
        detail: `Cost: $${result.cost.toFixed(4)} | Tokens: ${result.inputTokens + result.outputTokens}`,
        agentRole: agent.role,
        agentModel: agent.model,
      });

      // Check if mission is complete (all agents done)
      await ctx.scheduler.runAfter(2000, api.swarm.checkMissionComplete, {
        missionId,
        sessionId,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(api.swarm.updateAgentRun, {
        agentRunId,
        status: "failed",
        error: errMsg,
        completedAt: Date.now(),
      });
      await ctx.runMutation(api.swarm.logActivity, {
        missionId,
        agentRunId,
        type: "error",
        title: `❌ ${agent.title} — Failed`,
        detail: errMsg,
        agentRole: agent.role,
        agentModel: agent.model,
      });

      // Still check if mission can complete
      await ctx.scheduler.runAfter(2000, api.swarm.checkMissionComplete, {
        missionId,
        sessionId,
      });
    }

    return null;
  },
});

// Check if all agents are done and complete the mission
export const checkMissionComplete = action({
  args: {
    missionId: v.id("missions"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, { missionId, sessionId }) => {
    const agents = await ctx.runQuery(api.swarm.listAgentRuns, { missionId });
    const pending = agents.filter(
      (a) =>
        a.status !== "completed" && a.status !== "failed"
    );

    if (pending.length === 0 && agents.length > 0) {
      const completed = agents.filter((a) => a.status === "completed").length;
      const failed = agents.filter((a) => a.status === "failed").length;
      const totalFiles = agents.reduce(
        (sum, a) => sum + (a.filesCreated || 0),
        0
      );
      const totalCost = agents.reduce((sum, a) => sum + (a.cost || 0), 0);

      await ctx.runMutation(api.swarm.updateMission, {
        missionId,
        status: failed === agents.length ? "failed" : "completed",
        completedAt: Date.now(),
        totalCost,
        totalFilesCreated: totalFiles,
      });

      // Post completion message
      await ctx.runMutation(api.chatMessages.send, {
        sessionId,
        content: `🏁 **Mission Complete!**\n\n✅ ${completed} agents finished | ❌ ${failed} failed\n📄 ${totalFiles} files created | 💰 $${totalCost.toFixed(4)} total cost\n\nAll agents: ${agents.map((a) => `${AGENT_ROLES[a.role]?.emoji || "🤖"} ${a.title} (${a.status})`).join(", ")}`,
        role: "assistant",
        model: "swarm",
      });
    }
  },
});

// Pause a running mission
export const pauseMission = mutation({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    await ctx.db.patch(missionId, { status: "paused" });
  },
});

// ─── Helper Functions ───────────────────────────────────────────

function buildAgentPrompt(
  role: string,
  title: string,
  description: string,
  userPrompt: string,
  fileSummary: string,
  depth: number,
  canSpawnChildren: boolean
): string {
  const roleInfo = AGENT_ROLES[role] || AGENT_ROLES.coder;

  let spawnInstructions = "";
  if (canSpawnChildren) {
    spawnInstructions = `

SPAWNING SUB-AGENTS:
If your task is complex and would benefit from multiple specialists, you can spawn child agents by including this block at the END of your response:

[SPAWN_AGENTS]
[{"role": "coder", "title": "Build X component", "description": "...", "model": "deepseek-v3.2"},
 {"role": "styler", "title": "Style X component", "description": "...", "model": "kimi-k2.6"}]
[/SPAWN_AGENTS]

Only spawn if the task genuinely needs it. Max 4 children. Each must work on DIFFERENT files.`;
  }

  return `You are ${roleInfo.emoji} Agent "${title}" in CodeForge's autonomous swarm.

ROLE: ${role.toUpperCase()} — ${roleInfo.description}
DEPTH: ${depth} (you are ${depth === 0 ? "the root agent" : `a level-${depth} sub-agent`})

YOUR SPECIFIC TASK: ${description}

THE OVERALL MISSION: ${userPrompt}

FILE CREATION FORMAT (CRITICAL):
When you create code files, use EXACTLY this format:

\`\`\`lang:path/to/file.ext
file content here
\`\`\`

Examples:
\`\`\`tsx:src/App.tsx
import React from 'react';
...
\`\`\`

\`\`\`css:src/styles.css
body { margin: 0; }
\`\`\`

RULES:
1. Generate COMPLETE, WORKING, PRODUCTION-READY code
2. ALWAYS use the \`\`\`lang:path format — this creates real files
3. Focus ONLY on YOUR assigned task — other agents handle other parts
4. Be thorough — write the full file, not snippets
5. Include all imports, types, error handling
${spawnInstructions}

CURRENT PROJECT FILES:
${fileSummary || "(empty project — creating from scratch)"}

Now execute your task. Generate the code.`;
}

async function callAI(
  modelConfig: (typeof MODELS)[number],
  systemPrompt: string,
  userMessage: string
): Promise<{
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}> {
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
        { role: "user", content: userMessage },
      ],
      max_tokens: 16384,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `${modelConfig.id} API error ${response.status}: ${errText.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices[0]?.message?.content || "No response.";
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost =
    (inputTokens / 1_000_000) * modelConfig.inputCostPer1M +
    (outputTokens / 1_000_000) * modelConfig.outputCostPer1M;

  return { content, inputTokens, outputTokens, cost };
}
