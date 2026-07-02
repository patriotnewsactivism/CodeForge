/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE — FORENSIC AGENT
 * ═══════════════════════════════════════════════════════════════════
 *
 * Automated root cause analysis of build errors, test failures, and
 * runtime crashes. Analyzes error output, traces through the codebase,
 * and produces a structured diagnosis with suggested fixes.
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

interface ForensicReport {
  rootCause: string;
  confidence: number;
  affectedFiles: { path: string; issue: string; suggestedFix: string }[];
  category: "type_error" | "import_error" | "syntax_error" | "runtime_error" | "test_failure" | "config_error" | "unknown";
  severity: "low" | "medium" | "high" | "critical";
  traceBack: string[];
  suggestedCommands: string[];
  preventionTips: string[];
}

function getModelConfig() {
  const models: { url: () => string; key: () => string; model: string }[] = [
    { url: () => process.env.GROK_ENDPOINT || "", key: () => process.env.GROK_API_KEY || "", model: "grok-4-1-fast-reasoning" },
    { url: () => process.env.DEEPSEEK_ENDPOINT || "", key: () => process.env.DEEPSEEK_API_KEY || "", model: "DeepSeek-V3-0324" },
    { url: () => process.env.KIMI_ENDPOINT || "", key: () => process.env.KIMI_API_KEY || "", model: "Kimi-K2.6" },
  ];
  return models.find((m) => m.key()) || models[0];
}

async function callAI(prompt: string, systemMsg: string): Promise<string> {
  const config = getModelConfig();
  const endpoint = config.url();
  const apiKey = config.key();

  if (!endpoint || !apiKey) {
    return JSON.stringify({
      rootCause: "Unable to analyze — AI service not configured.",
      confidence: 0,
      affectedFiles: [],
      category: "unknown",
      severity: "medium",
      traceBack: [],
      suggestedCommands: [],
      preventionTips: [],
    });
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`AI service error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    return JSON.stringify({
      rootCause: `AI service unavailable: ${err instanceof Error ? err.message : "unknown"}`,
      confidence: 0,
      affectedFiles: [],
      category: "unknown",
      severity: "medium",
      traceBack: [],
      suggestedCommands: [],
      preventionTips: [],
    });
  }
}

// ─── Classify error category ─────────────────────────────────────
function classifyError(errorOutput: string): ForensicReport["category"] {
  const lower = errorOutput.toLowerCase();
  if (lower.includes("type error") || lower.includes("typeerror") || lower.includes("ts2322") || lower.includes("ts2345")) return "type_error";
  if (lower.includes("cannot find module") || lower.includes("module not found") || lower.includes("import error") || lower.includes("ts2307")) return "import_error";
  if (lower.includes("syntaxerror") || lower.includes("syntax error") || lower.includes("unexpected token")) return "syntax_error";
  if (lower.includes("test failed") || lower.includes("test failure") || lower.includes("assert") || lower.includes("expect(") || lower.includes("jest") || lower.includes("vitest")) return "test_failure";
  if (lower.includes("cannot read") || lower.includes("is not defined") || lower.includes("null") || lower.includes("undefined") || lower.includes("referenceerror")) return "runtime_error";
  if (lower.includes("config") || lower.includes("env") || lower.includes("missing") && lower.includes("variable")) return "config_error";
  return "unknown";
}

// ─── Run forensic analysis ───────────────────────────────────────
export const analyzeError = action({
  args: {
    sessionId: v.id("sessions"),
    errorOutput: v.string(),
    fileContext: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  returns: v.object({
    rootCause: v.string(),
    confidence: v.number(),
    affectedFiles: v.array(v.object({
      path: v.string(),
      issue: v.string(),
      suggestedFix: v.string(),
    })),
    category: v.string(),
    severity: v.string(),
    traceBack: v.array(v.string()),
    suggestedCommands: v.array(v.string()),
    preventionTips: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<ForensicReport> => {
    const { sessionId, errorOutput, fileContext, language } = args;
    const category = classifyError(errorOutput);

    const systemMsg = `You are a Forensic Agent — an expert at root cause analysis of build errors and runtime failures.
Analyze the error output and provide a structured diagnosis. Be precise about which files are affected and what specific changes would fix the issue.
Always respond in JSON format.`;

    const prompt = `Analyze this build/runtime error and provide a forensic diagnosis.

Error output:
${errorOutput.slice(0, 5000)}

${fileContext ? `File context:\n${fileContext.slice(0, 2000)}` : ""}
${language ? `Language: ${language}` : ""}

Error category (pre-classified): ${category}

Respond with JSON:
{
  "rootCause": "precise root cause in 1-2 sentences",
  "confidence": 0.0-1.0,
  "affectedFiles": [
    { "path": "file path", "issue": "what's wrong", "suggestedFix": "specific code change" }
  ],
  "severity": "low|medium|high|critical",
  "traceBack": ["step 1 in the failure chain", "step 2", "etc"],
  "suggestedCommands": ["npm install X", "fix command 2"],
  "preventionTips": ["how to prevent this in the future"]
}

Be specific. Cite exact file paths and line numbers when possible. If the error is in a dependency, identify which one.`;

    const response = await callAI(prompt, systemMsg);

    let report: ForensicReport;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        report = {
          rootCause: parsed.rootCause || "Unable to determine root cause.",
          confidence: parsed.confidence || 0.5,
          affectedFiles: parsed.affectedFiles || [],
          category,
          severity: parsed.severity || "medium",
          traceBack: parsed.traceBack || [],
          suggestedCommands: parsed.suggestedCommands || [],
          preventionTips: parsed.preventionTips || [],
        };
      } else {
        report = {
          rootCause: response,
          confidence: 0.3,
          affectedFiles: [],
          category,
          severity: "medium",
          traceBack: [],
          suggestedCommands: [],
          preventionTips: [],
        };
      }
    } catch {
      report = {
        rootCause: response.slice(0, 500),
        confidence: 0.3,
        affectedFiles: [],
        category,
        severity: "medium",
        traceBack: [],
        suggestedCommands: [],
        preventionTips: [],
      };
    }

    // Save forensic report
    await ctx.runMutation(api.forensic.saveReport, {
      sessionId,
      errorOutput: errorOutput.slice(0, 5000),
      rootCause: report.rootCause,
      confidence: report.confidence,
      category: report.category,
      severity: report.severity,
      affectedFilesCount: report.affectedFiles.length,
    });

    return report;
  },
});

// ─── Save forensic report ────────────────────────────────────────
export const saveReport = mutation({
  args: {
    sessionId: v.id("sessions"),
    errorOutput: v.string(),
    rootCause: v.string(),
    confidence: v.number(),
    category: v.string(),
    severity: v.string(),
    affectedFilesCount: v.number(),
  },
  returns: v.id("forensicReports"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("forensicReports", {
      sessionId: args.sessionId,
      userId,
      errorOutput: args.errorOutput,
      rootCause: args.rootCause,
      confidence: args.confidence,
      category: args.category,
      severity: args.severity,
      affectedFilesCount: args.affectedFilesCount,
      createdAt: Date.now(),
    });
  },
});

// ─── List forensic reports ───────────────────────────────────────
export const listReports = query({
  args: { sessionId: v.id("sessions") },
  returns: v.array(v.any()),
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("forensicReports")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(50);
  },
});
