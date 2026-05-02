/**
 * GIT INTEGRATION — Branch per Task, Auto-PR
 *
 * Each mission gets its own branch. Agents commit their work.
 * When a mission completes, an auto-PR is created for review.
 * Uses GitHub API via user's stored PAT.
 */
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

// ─── Types ──────────────────────────────────────────────────────

type GitHubFile = {
  path: string;
  content: string;
  sha?: string;
};

// ─── GitHub API Helpers ─────────────────────────────────────────

async function ghFetch(
  token: string,
  path: string,
  method = "GET",
  body?: unknown
): Promise<unknown> {
  const resp = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text}`);
  }

  return resp.json();
}

// ─── Branch Operations ──────────────────────────────────────────

export const createBranch = action({
  args: {
    projectId: v.id("projects"),
    missionId: v.id("missions"),
    branchName: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    branchName: v.string(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { projectId, missionId, branchName }) => {
    const project = await ctx.runQuery(api.projects.getWithToken, { projectId });
    if (!project?.githubRepo || !project.githubToken) {
      return { success: false, branchName, error: "GitHub not connected" };
    }

    try {
      // Get default branch SHA
      const repo = await ghFetch(project.githubToken, `/repos/${project.githubRepo}`) as { default_branch: string };
      const ref = await ghFetch(
        project.githubToken,
        `/repos/${project.githubRepo}/git/ref/heads/${repo.default_branch}`
      ) as { object: { sha: string } };

      // Create branch
      await ghFetch(
        project.githubToken,
        `/repos/${project.githubRepo}/git/refs`,
        "POST",
        {
          ref: `refs/heads/${branchName}`,
          sha: ref.object.sha,
        }
      );

      // Record the branch
      await ctx.runMutation(api.gitops.recordBranch, {
        missionId,
        projectId,
        branchName,
        baseSha: ref.object.sha,
        baseBranch: repo.default_branch,
      });

      return { success: true, branchName };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, branchName, error: msg };
    }
  },
});

// Record a branch in the DB
export const recordBranch = mutation({
  args: {
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    branchName: v.string(),
    baseSha: v.string(),
    baseBranch: v.string(),
  },
  returns: v.id("gitBranches"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("gitBranches", {
      ...args,
      status: "active",
      commits: 0,
      prNumber: undefined,
      prUrl: undefined,
      createdAt: Date.now(),
    });
  },
});

// ─── Commit Agent Work ──────────────────────────────────────────

export const commitFiles = action({
  args: {
    projectId: v.id("projects"),
    missionId: v.id("missions"),
    branchName: v.string(),
    message: v.string(),
    files: v.array(v.object({
      path: v.string(),
      content: v.string(),
    })),
  },
  returns: v.object({
    success: v.boolean(),
    commitSha: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { projectId, missionId, branchName, message, files }) => {
    const project = await ctx.runQuery(api.projects.getWithToken, { projectId });
    if (!project?.githubRepo || !project.githubToken) {
      return { success: false, error: "GitHub not connected" };
    }

    const token = project.githubToken;
    const repo = project.githubRepo;

    try {
      // Get current branch head
      const ref = await ghFetch(token, `/repos/${repo}/git/ref/heads/${branchName}`) as {
        object: { sha: string };
      };
      const currentSha = ref.object.sha;

      // Get the current tree
      const commit = await ghFetch(token, `/repos/${repo}/git/commits/${currentSha}`) as {
        tree: { sha: string };
      };

      // Create blobs for each file
      const treeEntries = [];
      for (const file of files) {
        const blob = await ghFetch(token, `/repos/${repo}/git/blobs`, "POST", {
          content: file.content,
          encoding: "utf-8",
        }) as { sha: string };

        treeEntries.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }

      // Create new tree
      const tree = await ghFetch(token, `/repos/${repo}/git/trees`, "POST", {
        base_tree: commit.tree.sha,
        tree: treeEntries,
      }) as { sha: string };

      // Create commit
      const newCommit = await ghFetch(token, `/repos/${repo}/git/commits`, "POST", {
        message,
        tree: tree.sha,
        parents: [currentSha],
      }) as { sha: string };

      // Update branch ref
      await ghFetch(token, `/repos/${repo}/git/refs/heads/${branchName}`, "PATCH", {
        sha: newCommit.sha,
        force: false,
      });

      // Update commit count
      await ctx.runMutation(api.gitops.incrementCommits, {
        missionId,
        branchName,
      });

      return { success: true, commitSha: newCommit.sha };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  },
});

export const incrementCommits = mutation({
  args: {
    missionId: v.id("missions"),
    branchName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { missionId, branchName }) => {
    const branches = await ctx.db
      .query("gitBranches")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .collect();

    const branch = branches.find((b) => b.branchName === branchName);
    if (branch) {
      await ctx.db.patch(branch._id, { commits: (branch.commits || 0) + 1 });
    }
    return null;
  },
});

// ─── Auto-PR ────────────────────────────────────────────────────

export const createPR = action({
  args: {
    projectId: v.id("projects"),
    missionId: v.id("missions"),
    branchName: v.string(),
    title: v.string(),
    body: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    prNumber: v.optional(v.number()),
    prUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { projectId, missionId, branchName, title, body }) => {
    const project = await ctx.runQuery(api.projects.getWithToken, { projectId });
    if (!project?.githubRepo || !project.githubToken) {
      return { success: false, error: "GitHub not connected" };
    }

    try {
      const repo = await ghFetch(project.githubToken, `/repos/${project.githubRepo}`) as {
        default_branch: string;
      };

      const pr = await ghFetch(
        project.githubToken,
        `/repos/${project.githubRepo}/pulls`,
        "POST",
        {
          title,
          body,
          head: branchName,
          base: repo.default_branch,
        }
      ) as { number: number; html_url: string };

      // Update branch record
      await ctx.runMutation(api.gitops.updatePR, {
        missionId,
        branchName,
        prNumber: pr.number,
        prUrl: pr.html_url,
      });

      return { success: true, prNumber: pr.number, prUrl: pr.html_url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  },
});

export const updatePR = mutation({
  args: {
    missionId: v.id("missions"),
    branchName: v.string(),
    prNumber: v.number(),
    prUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { missionId, branchName, prNumber, prUrl }) => {
    const branches = await ctx.db
      .query("gitBranches")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .collect();

    const branch = branches.find((b) => b.branchName === branchName);
    if (branch) {
      await ctx.db.patch(branch._id, {
        prNumber,
        prUrl,
        status: "pr_created",
      });
    }
    return null;
  },
});

// ─── Queries ────────────────────────────────────────────────────

export const getBranches = query({
  args: { missionId: v.id("missions") },
  returns: v.array(v.object({
    _id: v.id("gitBranches"),
    _creationTime: v.number(),
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    branchName: v.string(),
    baseSha: v.string(),
    baseBranch: v.string(),
    status: v.string(),
    commits: v.number(),
    prNumber: v.optional(v.number()),
    prUrl: v.optional(v.string()),
    createdAt: v.number(),
  })),
  handler: async (ctx, { missionId }) => {
    return await ctx.db
      .query("gitBranches")
      .withIndex("by_mission", (q) => q.eq("missionId", missionId))
      .collect();
  },
});

export const getProjectBranches = query({
  args: { projectId: v.id("projects") },
  returns: v.array(v.object({
    _id: v.id("gitBranches"),
    _creationTime: v.number(),
    missionId: v.id("missions"),
    projectId: v.id("projects"),
    branchName: v.string(),
    baseSha: v.string(),
    baseBranch: v.string(),
    status: v.string(),
    commits: v.number(),
    prNumber: v.optional(v.number()),
    prUrl: v.optional(v.string()),
    createdAt: v.number(),
  })),
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("gitBranches")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(20);
  },
});

// ─── Auto-Branch Name Generator ─────────────────────────────────

export const generateBranchName = action({
  args: {
    missionPrompt: v.string(),
  },
  returns: v.string(),
  handler: async (_ctx, { missionPrompt }) => {
    // Generate a clean branch name from the mission prompt
    const slug = missionPrompt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40)
      .replace(/-+$/, "");

    const timestamp = Date.now().toString(36).slice(-4);
    return `codeforge/${slug}-${timestamp}`;
  },
});
