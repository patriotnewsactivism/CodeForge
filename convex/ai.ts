/**
 * ai.ts — CodeForge AI Router (BYOK update)
 *
 * CHANGES FROM ORIGINAL:
 * - getApiKey() now accepts an optional userKeys map (for lifetime users)
 * - callAI() accepts optional callerPlan + userKeys
 * - callAIWithFallback() enforces BYOK-only fallback for lifetime users
 *   (does NOT fall back to platform keys if a lifetime user's key fails)
 * - New exported helper: checkByokRequirement()
 *
 * All other code (MODELS, DEFAULT_MODEL, AGENT_MODELS, etc.) unchanged.
 */

declare const process: { env: Record<string, string | undefined> };

// ─── MODEL REGISTRY ────────────────────────────────────────────────────────
// (unchanged from original — copy as-is)

export interface ModelConfig {
  id: string;
  name: string;
  provider:
    | "deepseek"
    | "xai"
    | "moonshot"
    | "openai"
    | "azure"
    | "openrouter";
  apiModel: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  maxTokens: number;
  tier: "strong" | "balanced" | "fast";
}

export const MODELS: Record<string, ModelConfig> = {
  "deepseek-v3": {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "deepseek",
    apiModel: "deepseek-chat",
    inputCostPer1M: 0.27,
    outputCostPer1M: 1.1,
    maxTokens: 8192,
    tier: "balanced",
  },
  "deepseek-chat": {
    id: "deepseek-chat",
    name: "DeepSeek V3",
    provider: "deepseek",
    apiModel: "deepseek-chat",
    inputCostPer1M: 0.27,
    outputCostPer1M: 1.1,
    maxTokens: 8192,
    tier: "balanced",
  },
  "deepseek-reasoner": {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    provider: "deepseek",
    apiModel: "deepseek-reasoner",
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
    maxTokens: 8192,
    tier: "strong",
  },
  "grok-3-fast": {
    id: "grok-3-fast",
    name: "Grok 3 Fast",
    provider: "xai",
    apiModel: "grok-3-fast",
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    maxTokens: 8192,
    tier: "fast",
  },
  "grok-4": {
    id: "grok-4",
    name: "Grok 4",
    provider: "xai",
    apiModel: "grok-4",
    inputCostPer1M: 5.0,
    outputCostPer1M: 25.0,
    maxTokens: 16384,
    tier: "strong",
  },
  "kimi-k2": {
    id: "kimi-k2",
    name: "Kimi K2",
    provider: "moonshot",
    apiModel: "moonshot-v1-8k",
    inputCostPer1M: 0.12,
    outputCostPer1M: 0.12,
    maxTokens: 8192,
    tier: "fast",
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    apiModel: "gpt-4o-mini",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    maxTokens: 8192,
    tier: "fast",
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    apiModel: "gpt-4o",
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    maxTokens: 8192,
    tier: "strong",
  },

  // ─── OpenRouter models (100+ models via single API key) ────────────────
  "or/anthropic/claude-sonnet-4": {
    id: "or/anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4 (OR)",
    provider: "openrouter",
    apiModel: "anthropic/claude-sonnet-4-20250514",
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    maxTokens: 8192,
    tier: "strong",
  },
  "or/anthropic/claude-3.5-haiku": {
    id: "or/anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku (OR)",
    provider: "openrouter",
    apiModel: "anthropic/claude-3.5-haiku",
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
    maxTokens: 8192,
    tier: "fast",
  },
  "or/google/gemini-2.5-pro": {
    id: "or/google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro (OR)",
    provider: "openrouter",
    apiModel: "google/gemini-2.5-pro-preview",
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.0,
    maxTokens: 8192,
    tier: "strong",
  },
  "or/google/gemini-2.5-flash": {
    id: "or/google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash (OR)",
    provider: "openrouter",
    apiModel: "google/gemini-2.5-flash-preview",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    maxTokens: 8192,
    tier: "fast",
  },
  "or/meta-llama/llama-4-maverick": {
    id: "or/meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick (OR)",
    provider: "openrouter",
    apiModel: "meta-llama/llama-4-maverick",
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.6,
    maxTokens: 8192,
    tier: "balanced",
  },
  "or/qwen/qwen3-235b": {
    id: "or/qwen/qwen3-235b",
    name: "Qwen 3 235B (OR)",
    provider: "openrouter",
    apiModel: "qwen/qwen3-235b-a22b",
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.6,
    maxTokens: 8192,
    tier: "balanced",
  },
  "or/mistralai/codestral": {
    id: "or/mistralai/codestral",
    name: "Codestral (OR)",
    provider: "openrouter",
    apiModel: "mistralai/codestral-2501",
    inputCostPer1M: 0.3,
    outputCostPer1M: 0.9,
    maxTokens: 8192,
    tier: "fast",
  },
  "or/deepseek/deepseek-r1": {
    id: "or/deepseek/deepseek-r1",
    name: "DeepSeek R1 (OR)",
    provider: "openrouter",
    apiModel: "deepseek/deepseek-r1",
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
    maxTokens: 8192,
    tier: "strong",
  },
  "or/openai/gpt-4.1": {
    id: "or/openai/gpt-4.1",
    name: "GPT-4.1 (OR)",
    provider: "openrouter",
    apiModel: "openai/gpt-4.1",
    inputCostPer1M: 2.0,
    outputCostPer1M: 8.0,
    maxTokens: 8192,
    tier: "strong",
  },
  "or/openai/o3-mini": {
    id: "or/openai/o3-mini",
    name: "o3-mini (OR)",
    provider: "openrouter",
    apiModel: "openai/o3-mini",
    inputCostPer1M: 1.1,
    outputCostPer1M: 4.4,
    maxTokens: 8192,
    tier: "balanced",
  },
  "or/nousresearch/hermes-3-llama-3.1-405b": {
    id: "or/nousresearch/hermes-3-llama-3.1-405b",
    name: "Hermes 3 405B (OR)",
    provider: "openrouter",
    apiModel: "nousresearch/hermes-3-llama-3.1-405b",
    inputCostPer1M: 0.8,
    outputCostPer1M: 0.8,
    maxTokens: 8192,
    tier: "balanced",
  },
};

// Helper: get all OpenRouter model IDs for multi-model swarming
export function getOpenRouterModels(): ModelConfig[] {
  return Object.values(MODELS).filter(m => m.provider === "openrouter");
}

export const DEFAULT_MODEL = "deepseek-v3";

export const AGENT_MODELS: Record<string, string> = {
  orchestrator: "grok-4",
  architect: "grok-4",
  coder: "deepseek-v3",
  reviewer: "grok-3-fast",
  debugger: "deepseek-v3",
  tester: "deepseek-v3",
  devops: "deepseek-v3",
  sentry: "grok-3-fast",
  forensic: "grok-4",
  reflection: "grok-4",
  strategist: "grok-4",
  default: "deepseek-v3",
};

// ─── PROVIDER BASE URLS ────────────────────────────────────────────────────

function getBaseUrl(provider: ModelConfig["provider"]): string {
  switch (provider) {
    case "deepseek":
      return "https://api.deepseek.com/v1";
    case "xai":
      return "https://api.x.ai/v1";
    case "moonshot":
      return "https://api.moonshot.cn/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "azure":
      return process.env.AZURE_OPENAI_ENDPOINT ?? "";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
  }
}

// Provider → userApiKeys field mapping
const PROVIDER_KEY_MAP: Record<ModelConfig["provider"], string> = {
  deepseek: "deepseek",
  xai: "xai",
  moonshot: "moonshot",
  openai: "openai",
  azure: "openai", // azure falls back to openai key in BYOK
  openrouter: "openrouter",
};

/**
 * getApiKey — resolves the API key for a provider.
 *
 * For lifetime users: reads from their supplied userKeys map.
 * For weekly/monthly/free: reads from process.env (platform keys).
 *
 * @param provider    - the AI provider
 * @param callerPlan  - "lifetime" | "monthly" | "weekly" | "free"
 * @param userKeys    - map of provider → decrypted key (for lifetime users)
 */
function getApiKey(
  provider: ModelConfig["provider"],
  callerPlan?: string,
  userKeys?: Record<string, string>,
): string {
  if (callerPlan === "lifetime" && userKeys) {
    const providerSlug = PROVIDER_KEY_MAP[provider];
    const userKey = userKeys[providerSlug];
    if (userKey) return userKey;
    // No user key for this provider — return empty so the caller can handle it
    return "";
  }

  // Platform keys for weekly/monthly/free
  switch (provider) {
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY ?? "";
    case "xai":
      return process.env.XAI_API_KEY ?? "";
    case "moonshot":
      return process.env.MOONSHOT_API_KEY ?? "";
    case "openai":
      return process.env.OPENAI_API_KEY ?? "";
    case "azure":
      return process.env.AZURE_OPENAI_API_KEY ?? "";
    case "openrouter":
      return process.env.OPENROUTER_API_KEY ?? "";
  }
}

// ─── COST ESTIMATION ──────────────────────────────────────────────────────

export function estimateCost(
  text: string,
  modelId: string,
  isOutput: boolean,
): { tokens: number; cost: number } {
  const tokens = Math.ceil(text.length / 4);
  const config = MODELS[modelId] ?? MODELS[DEFAULT_MODEL];
  const costPer1M = isOutput ? config.outputCostPer1M : config.inputCostPer1M;
  return { tokens, cost: (tokens / 1_000_000) * costPer1M };
}

// ─── BYOK REQUIREMENT CHECK ────────────────────────────────────────────────

/**
 * checkByokRequirement — determines if a lifetime user is blocked from AI use.
 *
 * Returns { blocked: false } if the user can proceed.
 * Returns { blocked: true, message } if they need to add keys first.
 */
export function checkByokRequirement(
  callerPlan: string,
  userKeys?: Record<string, string>,
): { blocked: boolean; message?: string } {
  if (callerPlan !== "lifetime") return { blocked: false };

  const hasAtLeastOneKey = userKeys && Object.keys(userKeys).length > 0;
  if (!hasAtLeastOneKey) {
    return {
      blocked: true,
      message:
        "Lifetime plan requires your own API key — add one in Settings → API Keys.",
    };
  }
  return { blocked: false };
}

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICallOptions {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** The calling user's plan key — determines platform vs BYOK keys */
  callerPlan?: string;
  /** Decrypted user-supplied API keys — required when callerPlan === "lifetime" */
  userKeys?: Record<string, string>;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  text: string;
  usage?: AIUsage;
}

// ─── CORE AI CALL ─────────────────────────────────────────────────────────

/**
 * callAI — single entry point for all AI calls.
 *
 * For lifetime users: inject their own API keys.
 * For others: use platform environment keys.
 */
export async function callAI(
  promptOrMessages: string | Message[],
  options: AICallOptions = {},
): Promise<AIResponse> {
  const modelId = options.model ?? DEFAULT_MODEL;
  const config = MODELS[modelId] ?? MODELS[DEFAULT_MODEL];

  // BYOK gate
  const byokCheck = checkByokRequirement(
    options.callerPlan ?? "free",
    options.userKeys,
  );
  if (byokCheck.blocked) {
    throw new Error(byokCheck.message!);
  }

  const messages: Message[] =
    typeof promptOrMessages === "string"
      ? [
          ...(options.systemPrompt
            ? [{ role: "system" as const, content: options.systemPrompt }]
            : []),
          { role: "user" as const, content: promptOrMessages },
        ]
      : promptOrMessages;

  const baseUrl = getBaseUrl(config.provider);
  const apiKey = getApiKey(
    config.provider,
    options.callerPlan,
    options.userKeys,
  );

  if (!apiKey) {
    if (options.callerPlan === "lifetime") {
      throw new Error(
        `No ${config.name} API key configured. Add your ${config.provider.toUpperCase()} key in Settings → API Keys.`,
      );
    }
    throw new Error(
      `No API key configured for provider "${config.provider}". ` +
        `Set ${config.provider.toUpperCase()}_API_KEY in your Convex environment.`,
    );
  }

  // OpenRouter needs extra headers for ranking/attribution
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://codeforge.dev";
    headers["X-Title"] = "CodeForge AI";
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.apiModel,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? config.maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `${config.name} API error ${res.status}: ${body.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    error?: { message?: string };
  };

  if (json.error) throw new Error(`${config.name}: ${json.error.message}`);

  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${config.name} returned empty response`);

  return {
    text: content,
    usage: json.usage
      ? {
          promptTokens: json.usage.prompt_tokens,
          completionTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
        }
      : undefined,
  };
}

/**
 * callAIWithFallback — tries the requested model, then falls back.
 *
 * BYOK users (lifetime): fallback only cycles through THEIR available keys.
 *   If primary model fails and they have no key for the fallback provider,
 *   that fallback is skipped. If ALL fail, surfaces the error — does NOT
 *   fall back to platform keys.
 *
 * Platform users (weekly/monthly/free): standard fallback chain using platform keys.
 */
export async function callAIWithFallback(
  promptOrMessages: string | Message[],
  options: AICallOptions = {},
): Promise<AIResponse & { modelUsed: string }> {
  const requested = options.model ?? DEFAULT_MODEL;
  const isLifetime = options.callerPlan === "lifetime";

  // Build fallback chain
  const fullChain = [requested, "deepseek-v3", "gpt-4o-mini"].filter(
    (m, i, arr) => arr.indexOf(m) === i && MODELS[m],
  );

  // For lifetime users: filter chain to only models their keys can serve
  const chain =
    isLifetime && options.userKeys
      ? fullChain.filter(modelId => {
          const providerSlug = PROVIDER_KEY_MAP[MODELS[modelId].provider];
          return !!options.userKeys![providerSlug];
        })
      : fullChain;

  if (isLifetime && chain.length === 0) {
    throw new Error(
      "No API keys configured for any supported model. " +
        "Add at least one key in Settings → API Keys to use AI features.",
    );
  }

  const errors: string[] = [];

  for (const modelId of chain) {
    try {
      const response = await callAI(promptOrMessages, {
        ...options,
        model: modelId,
      });
      return { ...response, modelUsed: modelId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${modelId}: ${msg}`);

      // For lifetime users: don't swallow auth errors — surface immediately
      if (
        isLifetime &&
        (msg.includes("401") || msg.includes("Invalid API key"))
      ) {
        throw new Error(
          `Your ${MODELS[modelId].name} API key is invalid. ` +
            `Please update it in Settings → API Keys.\n\nError: ${msg}`,
        );
      }
    }
  }

  throw new Error(`All models failed:\n${errors.join("\n")}`);
}

/**
 * getModelForRole — returns the best model ID for a given agent role.
 * If userAgentModels is provided (from their saved profile), use those first.
 */
export function getModelForRole(
  role: string,
  userAgentModels?: Record<string, string>,
): string {
  const r = role.toLowerCase();
  if (userAgentModels?.[r]) return userAgentModels[r];
  return AGENT_MODELS[r] ?? AGENT_MODELS.default;
}
