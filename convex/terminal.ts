/**
 * CODEFORGE v2 — REAL TERMINAL EXECUTION via E2B Cloud Sandboxes
 * ─────────────────────────────────────────────────────────────────
 * Uses E2B (e2b.dev) sandboxed cloud VMs for real shell execution.
 * Each project gets its own isolated sandbox. Output streams live.
 *
 * Required env var (Convex dashboard → Settings → Env Variables):
 *   E2B_API_KEY = your E2B API key (free tier: 100 hrs/month)
 */
import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

// Blocked patterns (security)
const BLOCKED_CMDS = ["sudo su", "passwd", "userdel", "usermod", "init 0"];

function isSafeCommand(cmd: string): { safe: boolean; reason?: string } {
  const lower = cmd.toLowerCase().trim();
  for (const blocked of BLOCKED_CMDS) {
    if (lower.startsWith(blocked)) {
      return { safe: false, reason: "Command not permitted" };
    }
  }
  return { safe: true };
}

export const getOutput = query({
  args: { projectId: v.id("projects"), terminalId: v.string() },
  handler: async (ctx, { projectId, terminalId }) => {
    const output = await ctx.db
      .query("terminalOutput" as any)
      .withIndex("by_terminal", (q: any) => q.eq("projectId", projectId).eq("terminalId", terminalId))
      .order("desc")
      .first();
    return output || { lines: [], done: true };
  },
});

export const clearOutput = mutation({
  args: { projectId: v.id("projects"), terminalId: v.string() },
  handler: async (ctx, { projectId, terminalId }) => {
    const existing = await ctx.db
      .query("terminalOutput" as any)
      .withIndex("by_terminal", (q: any) => q.eq("projectId", projectId).eq("terminalId", terminalId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lines: [{ text: "Terminal cleared.", type: "info" }],
        done: true, updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("terminalOutput" as any, {
        projectId, terminalId,
        lines: [{ text: "Terminal cleared.", type: "info" }],
        done: true, updatedAt: Date.now(),
      });
    }
  },
});

export const writeOutput = internalMutation({
  args: {
    projectId: v.id("projects"),
    terminalId: v.string(),
    lines: v.array(v.object({ text: v.string(), type: v.string() })),
    done: v.boolean(),
    append: v.optional(v.boolean()),
  },
  handler: async (ctx, { projectId, terminalId, lines, done, append }) => {
    const existing = await ctx.db
      .query("terminalOutput" as any)
      .withIndex("by_terminal", (q: any) => q.eq("projectId", projectId).eq("terminalId", terminalId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lines: append ? [...(existing.lines || []).slice(-200), ...lines] : lines,
        done,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("terminalOutput" as any, {
        projectId, terminalId, lines, done, updatedAt: Date.now(),
      });
    }
  },
});

export const execute = action({
  args: {
    projectId: v.id("projects"),
    command: v.string(),
    terminalId: v.string(),
  },
  handler: async (ctx, { projectId, command, terminalId }) => {
    if (command === "__KILL__") {
      await ctx.runMutation(internal.terminal.writeOutput, {
        projectId, terminalId,
        lines: [{ text: "^C  (process interrupted)", type: "warn" }],
        done: true, append: true,
      });
      return;
    }

    const safety = isSafeCommand(command);
    if (!safety.safe) {
      await ctx.runMutation(internal.terminal.writeOutput, {
        projectId, terminalId,
        lines: [{ text: "Permission denied: " + safety.reason, type: "error" }],
        done: true, append: true,
      });
      return;
    }

    await ctx.runMutation(internal.terminal.writeOutput, {
      projectId, terminalId,
      lines: [{ text: "$ " + command, type: "command" }],
      done: false, append: true,
    });

    const e2bKey = process.env.E2B_API_KEY;

    if (!e2bKey) {
      const builtIn = runBuiltIn(command);
      await ctx.runMutation(internal.terminal.writeOutput, {
        projectId, terminalId, lines: builtIn, done: true, append: true,
      });
      return;
    }

    try {
      const sandboxId = await getOrCreateSandbox(e2bKey, projectId);
      const result = await runInSandbox(e2bKey, sandboxId, command);

      const outputLines: { text: string; type: string }[] = [];
      if (result.stdout) {
        result.stdout.split("\n").filter(Boolean).forEach((line: string) => {
          outputLines.push({ text: line, type: "info" });
        });
      }
      if (result.stderr) {
        result.stderr.split("\n").filter(Boolean).forEach((line: string) => {
          outputLines.push({ text: line, type: result.exitCode !== 0 ? "error" : "warn" });
        });
      }
      if (outputLines.length === 0) {
        outputLines.push({
          text: result.exitCode === 0 ? "[completed successfully]" : "[exit code " + result.exitCode + "]",
          type: result.exitCode === 0 ? "success" : "error",
        });
      }

      await ctx.runMutation(internal.terminal.writeOutput, {
        projectId, terminalId, lines: outputLines, done: true, append: true,
      });
    } catch (err: any) {
      await ctx.runMutation(internal.terminal.writeOutput, {
        projectId, terminalId,
        lines: [{ text: "Execution error: " + (err.message || "Unknown error"), type: "error" }],
        done: true, append: true,
      });
    }
  },
});

async function getOrCreateSandbox(apiKey: string, projectId: string): Promise<string> {
  const listRes = await fetch("https://api.e2b.dev/sandboxes", {
    headers: { "X-API-Key": apiKey },
  });
  if (listRes.ok) {
    const sandboxes = await listRes.json();
    const existing = (sandboxes as any[]).find(
      (s) => s.metadata?.projectId === projectId && s.state === "running"
    );
    if (existing) return existing.sandboxId;
  }

  const createRes = await fetch("https://api.e2b.dev/sandboxes", {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      templateId: "base",
      metadata: { projectId },
      timeoutMs: 3600000,
    }),
  });
  if (!createRes.ok) throw new Error("Sandbox create failed: " + await createRes.text());
  const sandbox = await createRes.json();
  return sandbox.sandboxId;
}

async function runInSandbox(
  apiKey: string,
  sandboxId: string,
  command: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const res = await fetch("https://api.e2b.dev/sandboxes/" + sandboxId + "/process", {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ cmd: command, timeoutMs: 30000 }),
  });
  if (!res.ok) throw new Error("Process failed: " + await res.text());
  const data = await res.json();
  return { stdout: data.stdout || "", stderr: data.stderr || "", exitCode: data.exitCode ?? 0 };
}

function runBuiltIn(command: string): { text: string; type: string }[] {
  const cmd = command.trim();
  if (cmd === "pwd") return [{ text: "/workspace", type: "info" }];
  if (cmd === "whoami") return [{ text: "codeforge-agent", type: "info" }];
  if (cmd === "date") return [{ text: new Date().toString(), type: "info" }];
  if (cmd === "node --version" || cmd === "node -v") return [{ text: "v20.11.0", type: "info" }];
  if (cmd === "npm --version" || cmd === "npm -v") return [{ text: "10.2.4", type: "info" }];
  if (cmd.startsWith("echo ")) return [{ text: cmd.slice(5).replace(/['"]/g, ""), type: "info" }];
  return [
    { text: "Live shell requires E2B_API_KEY in Convex environment variables.", type: "warn" },
    { text: "Free tier available at https://e2b.dev (100 hrs/month)", type: "info" },
    { text: "Add E2B_API_KEY to: Convex Dashboard → Settings → Environment Variables", type: "info" },
  ];
}
