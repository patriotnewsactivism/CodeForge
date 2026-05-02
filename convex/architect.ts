/**
 * MISSION ARCHITECT — Intelligent Prompt Engineering Engine
 *
 * Transforms rough user ideas into deeply detailed mission specifications.
 * Uses project context, memories, and iterative refinement to generate
 * battle-tested prompts that produce superior results.
 *
 * Flow:
 *   1. User types rough idea
 *   2. Architect analyzes: project state, tech stack, memories, patterns
 *   3. Generates clarifying questions (optional fast path skips this)
 *   4. Produces detailed mission spec with per-agent refined prompts
 *   5. Agents can self-refine prompts mid-execution via promptRefinement
 */
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

// ─── Schema for Architect Specs ─────────────────────────────────
// Stored in the "missionSpecs" table (added to schema.ts)

export const getSpec = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("missionSpecs")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .first();
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("missionSpecs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(20);
  },
});

export const storeSpec = mutation({
  args: {
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    originalPrompt: v.string(),
    expandedSpec: v.string(),
    techDecisions: v.array(v.object({
      area: v.string(),
      decision: v.string(),
      reasoning: v.string(),
    })),
    architecture: v.string(),
    agentPrompts: v.array(v.object({
      role: v.string(),
      title: v.string(),
      refinedPrompt: v.string(),
      model: v.string(),
      priority: v.number(),
      dependencies: v.array(v.string()),
      acceptanceCriteria: v.array(v.string()),
    })),
    edgeCases: v.array(v.string()),
    qualityGates: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("missionSpecs", {
      ...args,
      createdAt: Date.now(),
      version: 1,
    });
  },
});

// ─── Prompt Refinement (agents self-update mid-mission) ─────────

export const storeRefinement = mutation({
  args: {
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    originalPrompt: v.string(),
    refinedPrompt: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("promptRefinements", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getRefinements = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("promptRefinements")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .order("desc")
      .collect();
  },
});

// ─── The Core Architect Action ──────────────────────────────────

export const analyzeAndExpand = action({
  args: {
    projectId: v.id("projects"),
    rawPrompt: v.string(),
    fastMode: v.optional(v.boolean()), // Skip clarifying questions
  },
  handler: async (ctx, { projectId, rawPrompt, fastMode: _fastMode }) => {
    // 1. Gather all context
    const files = await ctx.runQuery(api.files.listWithContent, { projectId });
    const fileIndex = files
      .filter((f: { type: string }) => f.type === "file")
      .map((f: { path: string; content?: string | null }) => {
        const ext = f.path.split(".").pop() || "";
        const lines = (f.content || "").split("\n").length;
        const preview = (f.content || "").slice(0, 800);
        return `📄 ${f.path} (${ext}, ${lines} lines)\n${preview}${(f.content || "").length > 800 ? "\n..." : ""}`;
      })
      .join("\n\n");

    // 2. Pull memories for context
    let memoryContext = "";
    try {
      const memories = await ctx.runQuery(api.memory.listByProject, { projectId });
      if (memories.length > 0) {
        const topMemories = memories
          .filter((m: { isActive: boolean }) => m.isActive)
          .sort((a: { confidence: number; useCount: number }, b: { confidence: number; useCount: number }) =>
            b.confidence * b.useCount - a.confidence * a.useCount
          )
          .slice(0, 15);
        memoryContext = topMemories
          .map((m: { category: string; title: string; content: string; confidence: number }) =>
            `[${m.category.toUpperCase()}] ${m.title}: ${m.content} (confidence: ${(m.confidence * 100).toFixed(0)}%)`
          )
          .join("\n");
      }
    } catch {
      // No memories yet, that's fine
    }

    // 3. Pull retrospective insights
    let retroContext = "";
    try {
      const retros = await ctx.runQuery(api.retrospective.listByProject, { projectId });
      if (retros.length > 0) {
        const recent = retros.slice(0, 3);
        retroContext = recent
          .map((r: { score: number; improvements: string[]; whatFailed: string[] }) =>
            `Score: ${r.score}/100 | Improvements: ${r.improvements.join(", ")} | Issues: ${r.whatFailed.join(", ")}`
          )
          .join("\n");
      }
    } catch {
      // No retros yet
    }

    // 4. Detect tech stack from files
    const techStack = detectTechStack(files);

    // 5. Call AI to analyze and expand the prompt
    const architectPrompt = `You are the Mission Architect for CodeForge, an autonomous AI coding platform.

Your job: Transform a rough user idea into a deeply detailed, battle-tested mission specification that will be executed by a swarm of AI coding agents working in parallel.

You must think like a senior tech lead who's built hundreds of projects. Consider EVERYTHING:

## YOUR ANALYSIS FRAMEWORK:

### 1. INTENT EXTRACTION
- What does the user REALLY want? (read between the lines)
- What would a perfect version of this look like?
- What adjacent features would make this 10x better?
- What's the MVP vs. the dream version?

### 2. TECHNICAL ARCHITECTURE
- Best tech stack choices for THIS specific project (justify each)
- File structure and component breakdown
- Data flow and state management approach
- API design and integration points
- Performance considerations (lazy loading, caching, etc.)

### 3. QUALITY & EDGE CASES
- Error handling strategy (not just try/catch — graceful UX)
- Loading/empty/error states for every component
- Mobile responsiveness (mobile-first?)
- Accessibility considerations
- Security (input validation, XSS, auth boundaries)

### 4. AGENT TASK DECOMPOSITION
For each agent, generate a REFINED prompt that is:
- Hyper-specific about what files to create/modify
- Clear about coding standards and patterns to follow
- Aware of what OTHER agents are building (to avoid conflicts)
- Includes acceptance criteria (how to know it's done right)

## CONTEXT:

**Detected Tech Stack:** ${techStack}

**Current Project Files:**
${fileIndex || "(empty project — building from scratch)"}

${memoryContext ? `**Learned Patterns & Preferences:**\n${memoryContext}\n` : ""}
${retroContext ? `**Recent Mission Insights:**\n${retroContext}\n` : ""}

## USER'S RAW IDEA:
"${rawPrompt}"

## RESPONSE FORMAT (STRICT JSON):
{
  "expandedSpec": "A detailed 3-5 paragraph specification expanding the user's idea into a complete vision. Include specific UX flows, interactions, and technical details the user didn't mention but would want.",
  "techDecisions": [
    {
      "area": "e.g., State Management",
      "decision": "e.g., Zustand over Redux",
      "reasoning": "e.g., Simpler API, less boilerplate, perfect for this scale"
    }
  ],
  "architecture": "Detailed architecture description — components, data flow, file structure, how pieces connect",
  "agentPrompts": [
    {
      "role": "architect|coder|styler|tester|reviewer|debugger",
      "title": "Short descriptive name",
      "refinedPrompt": "EXTREMELY detailed prompt for this specific agent. Include: exact file paths, code patterns to follow, how to integrate with other agents' work, edge cases to handle, specific libraries/APIs to use. This should be 200+ words.",
      "model": "grok-4.1-fast|deepseek-v3.2|kimi-k2.6",
      "priority": 1,
      "dependencies": ["other agent titles this depends on, if any"],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
    }
  ],
  "edgeCases": ["List of edge cases agents should handle"],
  "qualityGates": ["List of quality checks the final output must pass"],
  "suggestions": ["Optional improvements the user might want to consider"]
}`;

    const endpoint = process.env.GROK_ENDPOINT || "";
    const apiKey = process.env.GROK_API_KEY || "";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        messages: [
          { role: "system", content: architectPrompt },
          {
            role: "user",
            content: `Analyze and expand this idea into a full mission spec: "${rawPrompt}"`,
          },
        ],
        max_tokens: 16384,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Architect AI error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    let content = data.choices[0]?.message?.content || "";

    // Strip markdown code fences if present
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // Parse the spec
    try {
      const spec = JSON.parse(content);
      return {
        ...spec,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      };
    } catch {
      // If JSON parsing fails, return the raw content as expandedSpec
      return {
        expandedSpec: content,
        techDecisions: [],
        architecture: "Unable to parse structured response",
        agentPrompts: [],
        edgeCases: [],
        qualityGates: [],
        suggestions: [],
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      };
    }
  },
});

// ─── Enhanced Mission Launch (with Architect) ───────────────────

export const launchWithArchitect = action({
  args: {
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    prompt: v.string(),
    fastMode: v.optional(v.boolean()),
  },
  handler: async (ctx, { projectId, sessionId, prompt, fastMode }): Promise<{ missionId: string; orchestratorId: string; spec: Record<string, unknown> }> => {
    // Get the session
    const session = await ctx.runQuery(api.sessions.get, { sessionId });
    if (!session) throw new Error("Session not found");
    const userId = session.userId;

    // Post "thinking" message
    await ctx.runMutation(api.chatMessages.send, {
      sessionId,
      content: `🏗️ **Mission Architect activated!**\n\nAnalyzing your idea, researching best approaches, and generating detailed specs for each agent...\n\n> ${prompt}`,
      role: "assistant",
      model: "architect",
    });

    // Run the architect analysis
    const spec = await ctx.runAction(api.architect.analyzeAndExpand, {
      projectId,
      rawPrompt: prompt,
      fastMode: fastMode ?? false,
    });

    // Create the mission
    const missionId = await ctx.runMutation(api.swarm.createMission, {
      userId,
      projectId,
      sessionId,
      prompt: spec.expandedSpec || prompt,
    });

    // Store the spec
    await ctx.runMutation(api.architect.storeSpec, {
      missionId,
      projectId,
      originalPrompt: prompt,
      expandedSpec: spec.expandedSpec || "",
      techDecisions: (spec.techDecisions || []).slice(0, 10),
      architecture: spec.architecture || "",
      agentPrompts: (spec.agentPrompts || []).map((ap: {
        role?: string;
        title?: string;
        refinedPrompt?: string;
        model?: string;
        priority?: number;
        dependencies?: string[];
        acceptanceCriteria?: string[];
      }) => ({
        role: ap.role || "coder",
        title: ap.title || "Agent",
        refinedPrompt: ap.refinedPrompt || "",
        model: ap.model || "deepseek-v3.2",
        priority: ap.priority || 1,
        dependencies: ap.dependencies || [],
        acceptanceCriteria: ap.acceptanceCriteria || [],
      })),
      edgeCases: spec.edgeCases || [],
      qualityGates: spec.qualityGates || [],
    });

    // Post the expanded spec to chat
    const techSummary = (spec.techDecisions || [])
      .map((t: { area: string; decision: string }) => `• **${t.area}:** ${t.decision}`)
      .join("\n");

    const agentSummary = (spec.agentPrompts || [])
      .map((a: { role: string; title: string; model: string }, i: number) =>
        `${i + 1}. ${getRoleEmoji(a.role)} **${a.title}** (${a.role} → ${a.model})`
      )
      .join("\n");

    await ctx.runMutation(api.chatMessages.send, {
      sessionId,
      content: `🏗️ **Mission Spec Ready!**\n\n${spec.expandedSpec?.slice(0, 800) || ""}${(spec.expandedSpec?.length || 0) > 800 ? "..." : ""}\n\n**Tech Decisions:**\n${techSummary || "Using project defaults"}\n\n**Agent Squad (${(spec.agentPrompts || []).length} agents):**\n${agentSummary || "Generating..."}\n\n**Edge Cases Covered:** ${(spec.edgeCases || []).length}\n**Quality Gates:** ${(spec.qualityGates || []).length}\n\n🚀 Launching swarm with refined prompts...`,
      role: "assistant",
      model: "architect",
    });

    // Create the root orchestrator
    const orchestratorId = await ctx.runMutation(api.swarm.createAgentRun, {
      missionId,
      projectId,
      role: "orchestrator",
      title: "Mission Orchestrator",
      description: `Execute architect spec: ${spec.expandedSpec?.slice(0, 500) || prompt}`,
      model: "grok-4.1-fast",
      depth: 0,
    });

    // Log start
    await ctx.runMutation(api.swarm.logActivity, {
      missionId,
      agentRunId: orchestratorId,
      type: "plan",
      title: "🏗️ Architect spec generated — spawning specialized agents",
      detail: `${(spec.agentPrompts || []).length} agents with refined prompts`,
      agentRole: "orchestrator",
      agentModel: "grok-4.1-fast",
    });

    // Update mission with plan
    await ctx.runMutation(api.swarm.updateMission, {
      missionId,
      status: "running",
      plan: JSON.stringify(spec),
    });

    // Spawn agents with REFINED prompts (not generic ones)
    const agentPrompts = spec.agentPrompts || [];
    const agentIds: string[] = [];

    for (const ap of agentPrompts.slice(0, 8)) {
      const agentId = await ctx.runMutation(api.swarm.createAgentRun, {
        missionId,
        projectId,
        parentAgentId: orchestratorId,
        role: ap.role || "coder",
        title: ap.title || "Agent",
        description: ap.refinedPrompt || ap.title || "Execute task",
        model: ap.model || "deepseek-v3.2",
        depth: 1,
      });
      agentIds.push(agentId);

      await ctx.runMutation(api.swarm.logActivity, {
        missionId,
        agentRunId: orchestratorId,
        type: "spawn",
        title: `${getRoleEmoji(ap.role)} Spawned: ${ap.title}`,
        detail: `Role: ${ap.role} | Model: ${ap.model} | Criteria: ${(ap.acceptanceCriteria || []).join(", ")}`,
        agentRole: "orchestrator",
        agentModel: "grok-4.1-fast",
      });

      // Launch with the refined prompt (agents get much better instructions)
      await ctx.scheduler.runAfter(0, api.swarm.runAgent, {
        agentRunId: agentId as any,
        missionId,
        projectId,
        sessionId,
        userPrompt: ap.refinedPrompt || prompt,
        canSpawnChildren: true,
      });
    }

    // Update orchestrator
    await ctx.runMutation(api.swarm.updateAgentRun, {
      agentRunId: orchestratorId,
      status: "waiting",
      childCount: agentIds.length,
    });

    // Track architect cost on the session
    await ctx.runMutation(api.sessions.addCost, {
      sessionId,
      inputTokens: spec.inputTokens || 0,
      outputTokens: spec.outputTokens || 0,
      cost: calculateCost(spec.inputTokens || 0, spec.outputTokens || 0),
    });

    return { missionId, orchestratorId, spec };
  },
});

// ─── Agent Self-Refinement Action ───────────────────────────────

export const refinePrompt = action({
  args: {
    agentRunId: v.id("agentRuns"),
    missionId: v.id("missions"),
    currentPrompt: v.string(),
    issue: v.string(), // What problem the agent discovered
    context: v.string(), // What it learned
  },
  handler: async (ctx, { agentRunId, missionId, currentPrompt, issue, context }) => {
    const endpoint = process.env.GROK_ENDPOINT || "";
    const apiKey = process.env.GROK_API_KEY || "";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        messages: [
          {
            role: "system",
            content: `You are a prompt refinement agent. An AI coding agent discovered an issue while executing its task and needs its prompt updated.

Current prompt: ${currentPrompt}

Issue discovered: ${issue}

New context: ${context}

Generate an UPDATED prompt that:
1. Keeps all original requirements
2. Incorporates the new discovery
3. Adjusts the approach based on what was learned
4. Is even more specific and actionable

Respond with ONLY the refined prompt text, no explanation.`,
          },
          { role: "user", content: "Refine the prompt based on the discovered issue." },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Refinement AI error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const refinedPrompt = data.choices[0]?.message?.content || currentPrompt;

    // Store the refinement
    await ctx.runMutation(api.architect.storeRefinement, {
      agentRunId,
      missionId,
      originalPrompt: currentPrompt,
      refinedPrompt,
      reason: issue,
    });

    // Log it
    await ctx.runMutation(api.swarm.logActivity, {
      missionId,
      agentRunId,
      type: "thinking",
      title: "🔄 Self-refined prompt based on discovery",
      detail: `Issue: ${issue}\nAdjustment: ${refinedPrompt.slice(0, 200)}...`,
      agentRole: "architect",
      agentModel: "grok-4.1-fast",
    });

    return refinedPrompt;
  },
});

// ─── Helper Functions ───────────────────────────────────────────

function detectTechStack(files: Array<{ path: string; content?: string | null; type: string }>): string {
  const paths = files.map((f) => f.path.toLowerCase());
  const allContent = files
    .filter((f) => f.type === "file")
    .map((f) => f.content || "")
    .join("\n");

  const stack: string[] = [];

  // Framework detection
  if (paths.some((p) => p.includes("next.config"))) stack.push("Next.js");
  else if (paths.some((p) => p.includes("vite.config"))) stack.push("Vite");
  else if (paths.some((p) => p.includes("angular.json"))) stack.push("Angular");

  // UI library
  if (allContent.includes("from 'react'") || allContent.includes('from "react"'))
    stack.push("React");
  if (allContent.includes("from 'vue'")) stack.push("Vue");
  if (allContent.includes("from 'svelte'")) stack.push("Svelte");

  // CSS
  if (paths.some((p) => p.includes("tailwind"))) stack.push("Tailwind CSS");
  if (paths.some((p) => p.endsWith(".scss"))) stack.push("SCSS");

  // Backend
  if (paths.some((p) => p.startsWith("convex/"))) stack.push("Convex");
  if (paths.some((p) => p.includes("prisma"))) stack.push("Prisma");
  if (paths.some((p) => p.includes("drizzle"))) stack.push("Drizzle");

  // Language
  if (paths.some((p) => p.endsWith(".ts") || p.endsWith(".tsx")))
    stack.push("TypeScript");
  else if (paths.some((p) => p.endsWith(".js") || p.endsWith(".jsx")))
    stack.push("JavaScript");

  // State
  if (allContent.includes("zustand")) stack.push("Zustand");
  if (allContent.includes("@reduxjs")) stack.push("Redux");

  // Testing
  if (allContent.includes("vitest")) stack.push("Vitest");
  if (allContent.includes("jest")) stack.push("Jest");

  return stack.length > 0 ? stack.join(", ") : "Not yet determined";
}

function getRoleEmoji(role: string): string {
  const emojis: Record<string, string> = {
    orchestrator: "🧠",
    planner: "📋",
    architect: "🏗️",
    coder: "💻",
    reviewer: "🔍",
    debugger: "🐛",
    tester: "🧪",
    styler: "🎨",
  };
  return emojis[role] || "🤖";
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // Using Grok pricing for architect (it uses grok-4.1-fast)
  return (inputTokens * 0.2) / 1_000_000 + (outputTokens * 0.5) / 1_000_000;
}
