/**
 * CODEBASE RAG — Vector Search for Codebase Understanding
 *
 * Indexes all project files into searchable chunks so agents can find
 * relevant code across the entire codebase without seeing every file.
 * Uses text-based search (Convex search indexes) with smart chunking.
 */
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// ─── Code Chunk Management ──────────────────────────────────────

// Upsert a code chunk for a file (called when files change)
export const indexFile = mutation({
  args: {
    projectId: v.id("projects"),
    filePath: v.string(),
    fileName: v.string(),
    language: v.optional(v.string()),
    chunks: v.array(v.object({
      content: v.string(),
      startLine: v.number(),
      endLine: v.number(),
      chunkType: v.string(), // "function", "class", "import", "block", "full"
      symbolName: v.optional(v.string()), // function/class name if applicable
    })),
  },
  returns: v.number(), // chunks indexed
  handler: async (ctx, { projectId, filePath, fileName, language, chunks }) => {
    // Delete existing chunks for this file
    const existing = await ctx.db
      .query("codeChunks")
      .withIndex("by_project_file", (q) =>
        q.eq("projectId", projectId).eq("filePath", filePath)
      )
      .collect();

    for (const chunk of existing) {
      await ctx.db.delete(chunk._id);
    }

    // Insert new chunks
    for (const chunk of chunks) {
      await ctx.db.insert("codeChunks", {
        projectId,
        filePath,
        fileName,
        language: language || "unknown",
        content: chunk.content,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        chunkType: chunk.chunkType,
        symbolName: chunk.symbolName,
        searchText: `${filePath} ${chunk.symbolName || ""} ${chunk.content}`.toLowerCase(),
        indexedAt: Date.now(),
      });
    }

    return chunks.length;
  },
});

// Remove all chunks for a file (when deleted)
export const removeFile = mutation({
  args: {
    projectId: v.id("projects"),
    filePath: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, { projectId, filePath }) => {
    const existing = await ctx.db
      .query("codeChunks")
      .withIndex("by_project_file", (q) =>
        q.eq("projectId", projectId).eq("filePath", filePath)
      )
      .collect();

    for (const chunk of existing) {
      await ctx.db.delete(chunk._id);
    }

    return existing.length;
  },
});

// ─── Smart Chunking Logic ───────────────────────────────────────

function chunkCode(content: string, language: string): Array<{
  content: string;
  startLine: number;
  endLine: number;
  chunkType: string;
  symbolName?: string;
}> {
  const lines = content.split("\n");
  const chunks: Array<{
    content: string;
    startLine: number;
    endLine: number;
    chunkType: string;
    symbolName?: string;
  }> = [];

  // For small files, index as single chunk
  if (lines.length <= 50) {
    chunks.push({
      content,
      startLine: 1,
      endLine: lines.length,
      chunkType: "full",
    });
    return chunks;
  }

  // Extract imports block
  const importLines: string[] = [];
  let importEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("import ") || line.startsWith("from ") ||
        line.startsWith("require(") || line.startsWith("const ") && line.includes("require(") ||
        line === "" || line.startsWith("//") || line.startsWith("export {")) {
      importLines.push(lines[i]);
      importEnd = i;
    } else if (importLines.length > 0) {
      break;
    }
  }

  if (importLines.length > 0) {
    chunks.push({
      content: importLines.join("\n"),
      startLine: 1,
      endLine: importEnd + 1,
      chunkType: "import",
    });
  }

  // Pattern-based chunking for functions/classes
  const funcPatterns = [
    // JS/TS patterns
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?:=>|:\s*\w)/,
    /^(?:export\s+)?class\s+(\w+)/,
    /^(?:export\s+)?(?:default\s+)?function\s+(\w+)/,
    // Python patterns
    /^def\s+(\w+)/,
    /^class\s+(\w+)/,
    /^async\s+def\s+(\w+)/,
  ];

  let currentChunkStart = importEnd + 1;
  let currentSymbol: string | undefined;
  let braceDepth = 0;
  let inChunk = false;

  for (let i = importEnd + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for new function/class definition
    let isNewSymbol = false;
    let symbolName: string | undefined;
    for (const pattern of funcPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        isNewSymbol = true;
        symbolName = match[1];
        break;
      }
    }

    if (isNewSymbol && !inChunk) {
      // Save previous block if any
      if (i > currentChunkStart) {
        const blockContent = lines.slice(currentChunkStart, i).join("\n").trim();
        if (blockContent.length > 10) {
          chunks.push({
            content: blockContent,
            startLine: currentChunkStart + 1,
            endLine: i,
            chunkType: "block",
            symbolName: currentSymbol,
          });
        }
      }
      currentChunkStart = i;
      currentSymbol = symbolName;
      inChunk = true;
      braceDepth = 0;
    }

    // Track brace depth for JS/TS
    if (["javascript", "typescript", "tsx", "jsx", "ts", "js"].includes(language)) {
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      // End of function/class body
      if (inChunk && braceDepth <= 0 && i > currentChunkStart) {
        const blockContent = lines.slice(currentChunkStart, i + 1).join("\n").trim();
        if (blockContent.length > 10) {
          chunks.push({
            content: blockContent,
            startLine: currentChunkStart + 1,
            endLine: i + 1,
            chunkType: symbolName ? "function" : "block",
            symbolName: currentSymbol,
          });
        }
        currentChunkStart = i + 1;
        currentSymbol = undefined;
        inChunk = false;
      }
    }

    // For Python (indentation-based) — chunk every 40 lines
    if (["python", "py"].includes(language) && (i - currentChunkStart) >= 40) {
      const blockContent = lines.slice(currentChunkStart, i + 1).join("\n").trim();
      if (blockContent.length > 10) {
        chunks.push({
          content: blockContent,
          startLine: currentChunkStart + 1,
          endLine: i + 1,
          chunkType: "block",
          symbolName: currentSymbol,
        });
      }
      currentChunkStart = i + 1;
      currentSymbol = undefined;
      inChunk = false;
    }
  }

  // Remaining content
  if (currentChunkStart < lines.length) {
    const blockContent = lines.slice(currentChunkStart).join("\n").trim();
    if (blockContent.length > 10) {
      chunks.push({
        content: blockContent,
        startLine: currentChunkStart + 1,
        endLine: lines.length,
        chunkType: "block",
        symbolName: currentSymbol,
      });
    }
  }

  // Fallback: if no chunks found, split into ~40-line blocks
  if (chunks.length === 0) {
    for (let i = 0; i < lines.length; i += 40) {
      const end = Math.min(i + 40, lines.length);
      const blockContent = lines.slice(i, end).join("\n");
      chunks.push({
        content: blockContent,
        startLine: i + 1,
        endLine: end,
        chunkType: "block",
      });
    }
  }

  return chunks;
}

// ─── Index Entire Project ───────────────────────────────────────

export const indexProject = action({
  args: { projectId: v.id("projects") },
  returns: v.object({
    filesIndexed: v.number(),
    chunksCreated: v.number(),
  }),
  handler: async (ctx, { projectId }) => {
    const files = await ctx.runQuery(api.files.listWithContent, { projectId });

    let filesIndexed = 0;
    let chunksCreated = 0;

    for (const file of files) {
      if (file.type !== "file" || !file.content) continue;

      const lang = file.language || detectLanguage(file.path);
      const chunks = chunkCode(file.content, lang);

      const count = await ctx.runMutation(api.rag.indexFile, {
        projectId,
        filePath: file.path,
        fileName: file.name,
        language: lang,
        chunks,
      });

      filesIndexed++;
      chunksCreated += count;
    }

    return { filesIndexed, chunksCreated };
  },
});

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", java: "java",
    css: "css", html: "html", json: "json", md: "markdown",
    yml: "yaml", yaml: "yaml", toml: "toml", sql: "sql",
    sh: "bash", bash: "bash", dockerfile: "dockerfile",
  };
  return map[ext] || ext;
}

// ─── Search ─────────────────────────────────────────────────────

export const search = query({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
    fileFilter: v.optional(v.string()), // glob pattern
  },
  returns: v.array(v.object({
    _id: v.id("codeChunks"),
    filePath: v.string(),
    fileName: v.string(),
    language: v.string(),
    content: v.string(),
    startLine: v.number(),
    endLine: v.number(),
    chunkType: v.string(),
    symbolName: v.optional(v.string()),
    score: v.number(),
  })),
  handler: async (ctx, { projectId, query: searchQuery, limit, fileFilter }) => {
    const allChunks = await ctx.db
      .query("codeChunks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const queryLower = searchQuery.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(Boolean);

    // Score each chunk by relevance
    const scored = allChunks
      .filter((chunk) => {
        if (fileFilter) {
          const pattern = fileFilter.replace(/\*/g, ".*");
          if (!new RegExp(pattern).test(chunk.filePath)) return false;
        }
        return true;
      })
      .map((chunk) => {
        let score = 0;
        const text = chunk.searchText;

        for (const term of queryTerms) {
          // Exact match in symbol name (highest weight)
          if (chunk.symbolName?.toLowerCase().includes(term)) score += 10;
          // Match in file path
          if (chunk.filePath.toLowerCase().includes(term)) score += 5;
          // Match in content
          const contentMatches = (text.match(new RegExp(term, "g")) || []).length;
          score += contentMatches * 2;
        }

        // Boost functions/classes over blocks
        if (chunk.chunkType === "function") score *= 1.5;
        if (chunk.chunkType === "class") score *= 1.3;

        return { ...chunk, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit || 10);

    return scored.map((c) => ({
      _id: c._id,
      filePath: c.filePath,
      fileName: c.fileName,
      language: c.language,
      content: c.content,
      startLine: c.startLine,
      endLine: c.endLine,
      chunkType: c.chunkType,
      symbolName: c.symbolName,
      score: c.score,
    }));
  },
});

// ─── Build Context for Agent Prompts ────────────────────────────

export const buildContext = action({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    maxTokens: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, { projectId, query: searchQuery, maxTokens }) => {
    const results = await ctx.runQuery(api.rag.search, {
      projectId,
      query: searchQuery,
      limit: 15,
    });

    if (results.length === 0) {
      return "";
    }

    const tokenLimit = maxTokens || 4000;
    let context = "## Relevant Codebase Context\n\n";
    let estimatedTokens = 20;

    for (const result of results) {
      const chunk = `### ${result.filePath} (L${result.startLine}-${result.endLine})${result.symbolName ? ` — \`${result.symbolName}\`` : ""}\n\`\`\`${result.language}\n${result.content}\n\`\`\`\n\n`;
      const chunkTokens = Math.ceil(chunk.length / 4);

      if (estimatedTokens + chunkTokens > tokenLimit) break;
      context += chunk;
      estimatedTokens += chunkTokens;
    }

    return context;
  },
});

// ─── Stats ──────────────────────────────────────────────────────

export const getStats = query({
  args: { projectId: v.id("projects") },
  returns: v.object({
    totalChunks: v.number(),
    filesIndexed: v.number(),
    languages: v.any(),
    lastIndexedAt: v.optional(v.number()),
  }),
  handler: async (ctx, { projectId }) => {
    const chunks = await ctx.db
      .query("codeChunks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const files = new Set<string>();
    const languages: Record<string, number> = {};
    let lastIndexedAt: number | undefined;

    for (const c of chunks) {
      files.add(c.filePath);
      languages[c.language] = (languages[c.language] || 0) + 1;
      if (!lastIndexedAt || c.indexedAt > lastIndexedAt) {
        lastIndexedAt = c.indexedAt;
      }
    }

    return {
      totalChunks: chunks.length,
      filesIndexed: files.size,
      languages,
      lastIndexedAt,
    };
  },
});
