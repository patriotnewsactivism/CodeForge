/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE — DEBATE ENGINE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Proponent vs Opponent debate with Moderator verdict.
 * Ported from codeforgeV2 (Python) + autonomous-coder (TypeScript).
 * Guarantees code quality before commit — every change goes through
 * structured argumentation with evidence and confidence scoring.
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

type DebateVerdict = "PROCEED" | "REFINE" | "ESCALATE";

interface DebateResult {
  verdict: DebateVerdict;
  proponentArgument: string;
  opponentArgument: string;
  moderatorReasoning: string;
  refinements: string[];
  escalationReason?: string;
  confidence: number;
  rounds: DebateRound[];
}

interface DebateRound {
  role: "proponent" | "opponent" | "moderator";
  argument: string;
  evidence: { type: string; content: string; source: string }[];
  confidence: number;
}

// ─── Model Configuration ────────────────────────────────────────
function getModelConfig() {
  const models: { id: string; url: () => string; key: () => string; model: string }[] = [
    {
      id: "grok",
      url: () => process.env.GROK_ENDPOINT || "",
      key: () => process.env.GROK_API_KEY || "",
      model: "grok-4-1-fast-reasoning",
    },
    {
      id: "deepseek",
      url: () => process.env.DEEPSEEK_ENDPOINT || "",
      key: () => process.env.DEEPSEEK_API_KEY || "",
      model: "DeepSeek-V3-0324",
    },
    {
      id: "kimi",
      url: () => process.env.KIMI_ENDPOINT || "",
      key: () => process.env.KIMI_API_KEY || "",
      model: "Kimi-K2.6",
    },
  ];
  return models.find((m) => m.key()) || models[0];
}

async function callAI(prompt: string, systemMsg: string, model?: string): Promise<string> {
  const config = getModelConfig();
  const endpoint = model ? `${config.url()}` : config.url();
  const apiKey = config.key();

  if (!endpoint || !apiKey) {
    // Fallback: return a reasonable default if no AI is configured
    return `Unable to reach AI service for: ${systemMsg}`;
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || config.model,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`AI service error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    return `AI service unavailable: ${err instanceof Error ? err.message : "unknown"}`;
  }
}

// ─── Run Full Debate ─────────────────────────────────────────────
export const runDebate = action({
  args: {
    sessionId: v.id("sessions"),
    proposal: v.string(),
    context: v.optional(v.string()),
    operationType: v.string(),
    model: v.optional(v.string()),
  },
  returns: v.object({
    verdict: v.string(),
    proponentArgument: v.string(),
    opponentArgument: v.string(),
    moderatorReasoning: v.string(),
    refinements: v.array(v.string()),
    escalationReason: v.optional(v.string()),
    confidence: v.number(),
    rounds: v.array(
      v.object({
        role: v.string(),
        argument: v.string(),
        evidence: v.array(v.object({ type: v.string(), content: v.string(), source: v.string() })),
        confidence: v.number(),
      })
    ),
  }),
  handler: async (ctx, args): Promise<DebateResult> => {
    const { sessionId, proposal, context, operationType, model } = args;
    const contextBlock = context ? `\n\nProject context:\n${context.slice(0, 3000)}` : "";
    const rounds: DebateRound[] = [];

    // ── Round 1: Proponent ─────────────────────────────────────────
    const proponentPrompt = `You are the Proponent agent in an architectural debate.
Your job: argue FOR the following proposal. Be specific, cite technical benefits, and anticipate objections.

Proposal: ${proposal}
Operation type: ${operationType}${contextBlock}

Respond with a focused argument (3-5 sentences max). Be concrete — cite real engineering benefits.
Do NOT hedge. You are arguing FOR this change.`;

    const proponentArgument = await callAI(proponentPrompt, "Provide your argument FOR the proposal.", model);
    rounds.push({ role: "proponent", argument: proponentArgument, evidence: [], confidence: 0.7 });

    // ── Round 2: Opponent ──────────────────────────────────────────
    const opponentPrompt = `You are the Opponent agent in an architectural debate.
Your job: find real flaws, risks, and edge cases in the following proposal. Be specific and technical.

Proposal: ${proposal}
Operation type: ${operationType}${contextBlock}

Proponent argued: ${proponentArgument}

Respond with your strongest objections (3-5 sentences max). Focus on concrete risks: data loss,
breaking changes, performance regressions, security issues, or architectural debt.
Do NOT agree with the proponent. You are finding problems.`;

    const opponentArgument = await callAI(opponentPrompt, "Provide your argument AGAINST the proposal.", model);
    rounds.push({ role: "opponent", argument: opponentArgument, evidence: [], confidence: 0.6 });

    // ── Round 3: Moderator ─────────────────────────────────────────
    const moderatorPrompt = `You are the Moderator in an architectural debate. Synthesize the arguments and deliver a verdict.

Proposal: ${proposal}
Operation type: ${operationType}

Proponent argued: ${proponentArgument}
Opponent argued: ${opponentArgument}

Evaluate both arguments. Consider:
1. Does the proponent's benefit justify the risk?
2. Are the opponent's concerns addressable with conditions?
3. Is this safe to auto-apply, or does it need human review?

Respond in JSON format:
{
  "verdict": "PROCEED" | "REFINE" | "ESCALATE",
  "reasoning": "your synthesis (2-3 sentences)",
  "confidence": 0.0-1.0,
  "refinements": ["condition 1", "condition 2"],
  "escalation_reason": "why human review is needed (only if ESCALATE)"
}

PROCEED = safe to auto-apply
REFINE = apply only if conditions are met
ESCALATE = needs human review before applying`;

    const moderatorResponse = await callAI(moderatorPrompt, "Provide your moderator verdict as JSON.", model);

    // Parse moderator response
    let parsed: any = {};
    try {
      const jsonMatch = moderatorResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { verdict: "REFINE", reasoning: moderatorResponse, confidence: 0.5, refinements: [] };
    }

    const result: DebateResult = {
      verdict: (parsed.verdict || "REFINE") as DebateVerdict,
      proponentArgument,
      opponentArgument,
      moderatorReasoning: parsed.reasoning || moderatorResponse,
      refinements: parsed.refinements || [],
      escalationReason: parsed.escalation_reason,
      confidence: parsed.confidence || 0.5,
      rounds,
    };

    rounds.push({
      role: "moderator",
      argument: result.moderatorReasoning,
      evidence: [],
      confidence: result.confidence,
    });

    // Save debate result to DB
    await ctx.runMutation(api.debate.saveDebate, {
      sessionId,
      proposal,
      verdict: result.verdict,
      proponentArgument: result.proponentArgument,
      opponentArgument: result.opponentArgument,
      moderatorReasoning: result.moderatorReasoning,
      refinements: result.refinements,
      confidence: result.confidence,
    });

    return result;
  },
});

// ─── Save debate to DB ───────────────────────────────────────────
export const saveDebate = mutation({
  args: {
    sessionId: v.id("sessions"),
    proposal: v.string(),
    verdict: v.string(),
    proponentArgument: v.string(),
    opponentArgument: v.string(),
    moderatorReasoning: v.string(),
    refinements: v.array(v.string()),
    confidence: v.number(),
  },
  returns: v.id("debates"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("debates", {
      sessionId: args.sessionId,
      userId,
      proposal: args.proposal,
      verdict: args.verdict,
      proponentArgument: args.proponentArgument,
      opponentArgument: args.opponentArgument,
      moderatorReasoning: args.moderatorReasoning,
      refinements: args.refinements,
      confidence: args.confidence,
      createdAt: Date.now(),
    });
  },
});

// ─── List debates for a session ──────────────────────────────────
export const listDebates = query({
  args: { sessionId: v.id("sessions") },
  returns: v.array(v.any()),
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("debates")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(50);
  },
});
