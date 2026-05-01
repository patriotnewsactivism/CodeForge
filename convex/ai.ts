import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

// Endpoints and keys — set these as Convex environment variables
// See .env.example for required variables
const DEFAULTS = {
  DEEPSEEK_ENDPOINT: "",
  DEEPSEEK_API_KEY: "",
  GROK_ENDPOINT: "",
  GROK_API_KEY: "",
  AZURE_OPENAI_ENDPOINT: "",
};

// Model configurations
const MODELS = {
  "deepseek-v3.2": {
    name: "DeepSeek V3.2",
    endpoint: () =>
      process.env.DEEPSEEK_ENDPOINT || DEFAULTS.DEEPSEEK_ENDPOINT,
    apiKey: () => process.env.DEEPSEEK_API_KEY || DEFAULTS.DEEPSEEK_API_KEY,
    model: "DeepSeek-V3-0324",
    inputCostPer1M: 0.28,
    outputCostPer1M: 0.42,
    maxTokens: 8192,
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  "grok-4.1-fast": {
    name: "Grok 4.1 Fast",
    endpoint: () => process.env.GROK_ENDPOINT || DEFAULTS.GROK_ENDPOINT,
    apiKey: () => process.env.GROK_API_KEY || DEFAULTS.GROK_API_KEY,
    model: "grok-4-1-fast-reasoning",
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.5,
    maxTokens: 8192,
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  "gpt-5-mini": {
    name: "GPT-5 Mini",
    endpoint: () =>
      `${process.env.AZURE_OPENAI_ENDPOINT || DEFAULTS.AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-5-mini/chat/completions?api-version=2025-04-28`,
    apiKey: () => process.env.AZURE_OPENAI_API_KEY || "",
    model: "gpt-5-mini",
    inputCostPer1M: 2.0,
    outputCostPer1M: 4.0,
    maxTokens: 4096,
    authHeader: "api-key",
    authPrefix: "",
  },
  "kimi-k2.6": {
    name: "Kimi K2.6",
    endpoint: () =>
      process.env.KIMI_ENDPOINT || DEFAULTS.DEEPSEEK_ENDPOINT,
    apiKey: () => process.env.KIMI_API_KEY || DEFAULTS.DEEPSEEK_API_KEY,
    model: "Kimi-K2.6",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.35,
    maxTokens: 8192,
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
} as const;

type ModelId = keyof typeof MODELS;

const MODEL_FALLBACK_ORDER: ModelId[] = [
  "deepseek-v3.2",
  "grok-4.1-fast",
  "kimi-k2.6",
  "gpt-5-mini",
];

function calculateCost(
  modelId: ModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const model = MODELS[modelId];
  return (
    (inputTokens / 1_000_000) * model.inputCostPer1M +
    (outputTokens / 1_000_000) * model.outputCostPer1M
  );
}

async function callModel(
  modelId: ModelId,
  messages: Array<{ role: string; content: string }>,
  maxTokens?: number
): Promise<{
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}> {
  const config = MODELS[modelId];
  const endpoint = config.endpoint();
  const apiKey = config.apiKey();

  if (!endpoint || !apiKey) {
    throw new Error(`${config.name}: endpoint or API key not configured`);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [config.authHeader]: `${config.authPrefix}${apiKey}`,
  };

  const body = {
    messages,
    max_tokens: maxTokens || config.maxTokens,
    temperature: 0.3,
    ...(modelId !== "gpt-5-mini" ? { model: config.model } : {}),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${config.name} API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content || "No response generated.",
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    model: modelId,
  };
}

export const chat = action({
  args: {
    sessionId: v.id("sessions"),
    projectId: v.optional(v.id("projects")),
    userMessage: v.string(),
    model: v.string(),
    fileContext: v.optional(v.string()),
    fileContent: v.optional(v.string()),
    conversationHistory: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  returns: v.object({
    content: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cost: v.number(),
    filesCreated: v.number(),
  }),
  handler: async (ctx, args) => {
    const systemPrompt = `You are CodeForge AI — the built-in AI engine of CodeForge, a full-stack coding platform. You are NOT a generic chatbot. You are embedded inside a real development environment with file management, live preview, and GitHub integration.

Your capabilities inside CodeForge:
- Generate complete applications — frontend, backend, databases, APIs
- Create, edit, and manage project files (the user can see them in the file tree)
- Build deployable web apps, servers, APIs, dashboards, and full-stack projects
- Work with any language or framework: React, Next.js, Node, Python, HTML/CSS/JS, etc.
- Generate configuration files (Dockerfile, package.json, railway.json, vercel.json, etc.)
- Help deploy projects — provide deployment configs, build scripts, and setup instructions
- Import and modify GitHub repositories
- Debug issues by analyzing code and suggesting fixes

Key behaviors:
- When asked to build something, generate ALL the necessary files with complete, working code
- Write production-ready code with proper error handling, not just snippets
- Proactively create supporting files (package.json, configs, styles, etc.)
- When given file context, reference specific line numbers and patterns
- Suggest improvements and optimizations proactively
- Use markdown code blocks with language tags for all code
- Be direct and action-oriented — build it, don't just describe it
- If the user wants to deploy, provide the exact deployment configuration needed
- Never say you "cannot" do things like create servers, build websites, or deploy — you generate all the code and configs needed, and the user deploys from CodeForge

CRITICAL — File Creation Format:
When you generate code files, you MUST use this exact format so files are automatically created in the project:

\`\`\`lang:path/to/filename.ext
file content here
\`\`\`

Examples:
\`\`\`html:index.html
<!DOCTYPE html>...
\`\`\`

\`\`\`css:styles/main.css
body { margin: 0; }
\`\`\`

\`\`\`javascript:src/app.js
console.log("hello");
\`\`\`

Always use the \`lang:path\` format for ANY code you generate. This automatically creates the files in the user's project file tree. Without this format, files will NOT be created. Every code block that represents a project file MUST include the filepath after the language tag with a colon separator.${args.fileContext ? `\n\nCurrently active file: ${args.fileContext}` : ""}${args.fileContent ? `\n\nFile contents:\n\`\`\`\n${args.fileContent}\n\`\`\`` : ""}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...args.conversationHistory.slice(-20), // Keep last 20 messages for context
      { role: "user", content: args.userMessage },
    ];

    // Save user message
    await ctx.runMutation(api.chatMessages.send, {
      sessionId: args.sessionId,
      content: args.userMessage,
      role: "user",
      fileContext: args.fileContext,
    });

    // Try models in order (preferred model first, then fallbacks)
    const preferredModel = args.model as ModelId;
    const tryOrder: ModelId[] = [
      preferredModel,
      ...MODEL_FALLBACK_ORDER.filter((m) => m !== preferredModel),
    ];

    let lastError = "";
    for (const modelId of tryOrder) {
      if (!(modelId in MODELS)) continue;
      try {
        const result = await callModel(modelId, messages);
        const cost = calculateCost(
          modelId,
          result.inputTokens,
          result.outputTokens
        );

        // Save assistant message
        await ctx.runMutation(api.chatMessages.send, {
          sessionId: args.sessionId,
          content: result.content,
          role: "assistant",
          model: modelId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cost,
          fileContext: args.fileContext,
        });

        // Update session cost
        await ctx.runMutation(api.sessions.addCost, {
          sessionId: args.sessionId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cost,
        });

        // Parse code blocks and create files in the project
        let filesCreated = 0;
        if (args.projectId) {
          const fileBlockRegex = /```[a-zA-Z]*:([^\n]+)\n([\s\S]*?)```/g;
          let match;
          while ((match = fileBlockRegex.exec(result.content)) !== null) {
            const filePath = match[1].trim();
            const fileContent = match[2];
            const fileName = filePath.split("/").pop() || filePath;
            try {
              await ctx.runMutation(api.files.createFromAI, {
                projectId: args.projectId,
                path: filePath,
                name: fileName,
                content: fileContent,
              });
              filesCreated++;
            } catch (e) {
              console.error(`Failed to create file ${filePath}:`, e);
            }
          }
        }

        return {
          content: result.content,
          model: modelId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cost,
          filesCreated,
        };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error(`Model ${modelId} failed:`, lastError);
        continue;
      }
    }

    // All models failed
    const errorContent = `⚠️ All AI models are currently unavailable. Last error: ${lastError}`;
    await ctx.runMutation(api.chatMessages.send, {
      sessionId: args.sessionId,
      content: errorContent,
      role: "assistant",
    });

    return {
      content: errorContent,
      model: "none",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      filesCreated: 0,
    };
  },
});

export const listModels = action({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      inputCostPer1M: v.number(),
      outputCostPer1M: v.number(),
      available: v.boolean(),
    })
  ),
  handler: async () => {
    return Object.entries(MODELS).map(([id, config]) => ({
      id,
      name: config.name,
      inputCostPer1M: config.inputCostPer1M,
      outputCostPer1M: config.outputCostPer1M,
      available: !!(config.endpoint() && config.apiKey()),
    }));
  },
});
