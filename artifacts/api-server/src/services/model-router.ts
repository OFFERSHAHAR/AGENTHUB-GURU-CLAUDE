/**
 * Model Router — Multi-tier AI provider abstraction
 *
 * Tier routing:
 *   free       → Ollama (local, $0) — dev/test only
 *   fallback   → Groq Llama 3.1 8B (ultra-light)
 *   starter    → Groq Llama 3.3 70B (fast, cheap)
 *   pro        → OpenAI GPT-4o
 *   enterprise → OpenAI GPT-4o with higher limits
 *
 * Production fallback policy:
 *   When a primary model fails in a client-facing context, we fall back:
 *     primary=8B  → try 70B (different Groq rate-limit bucket)
 *     primary=70B → try 8B
 *     primary=OpenAI → try Groq 8B
 *   If fallback is also the same model that just failed we skip it to avoid
 *   pointless 429 retries on the same account/bucket.
 *   A Telegram alert is sent when fallback activates.
 */

import { notifyModelFallback } from "../lib/telegram-notify.js";

export type ModelTier = "free" | "fallback" | "starter" | "pro" | "enterprise";

export interface ModelResult {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  wasFallback: boolean;
  fallbackReason?: string;
}

// Token cost per 1M tokens in USD
const TOKEN_COSTS: Record<string, { input: number; output: number; label: string }> = {
  "ollama/llama3.2":              { input: 0,    output: 0,     label: "Ollama llama3.2 (Local)" },
  "ollama/llama3.1":              { input: 0,    output: 0,     label: "Ollama llama3.1 (Local)" },
  "ollama/mistral":               { input: 0,    output: 0,     label: "Ollama Mistral (Local)" },
  "ollama/phi3":                  { input: 0,    output: 0,     label: "Ollama Phi-3 (Local)" },
  "groq/llama-3.3-70b-versatile": { input: 0.59, output: 0.79,  label: "Groq Llama 3.3 70B" },
  "groq/llama-3.1-8b-instant":    { input: 0.05, output: 0.08,  label: "Groq Llama 3.1 8B (Fallback)" },
  "openai/gpt-4o":                { input: 2.50, output: 10.00, label: "OpenAI GPT-4o" },
  "openai/gpt-4o-mini":           { input: 0.15, output: 0.60,  label: "OpenAI GPT-4o Mini" },
  "anthropic/claude-3-5-sonnet":  { input: 3.00, output: 15.00, label: "Anthropic Claude 3.5 Sonnet" },
  "template/none":                { input: 0,    output: 0,     label: "Template (No AI)" },
};

// Groq fallback models in priority order — each has its own rate-limit bucket
const GROQ_FALLBACK_CHAIN = [
  "llama-3.1-8b-instant",      // fastest, highest RPM
  "llama-3.3-70b-versatile",   // different TPM bucket from 8B
  "llama3-70b-8192",           // older 70B — separate limit
  "llama3-8b-8192",            // older 8B — separate limit
] as const;

// Quick helper — is this a rate-limit error?
function isRateLimit(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("rate_limit");
}

export function estimateCost(providerModel: string, inputTokens: number, outputTokens: number): number {
  const costs = TOKEN_COSTS[providerModel];
  if (!costs) return 0;
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

export function getModelForTier(tier: ModelTier): { provider: string; model: string; baseUrl?: string; apiKey?: string } {
  switch (tier) {
    case "free":
      return {
        provider: "ollama",
        model: process.env.OLLAMA_MODEL || "llama3.2",
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      };
    case "fallback":
      return {
        provider: "groq",
        model: "llama-3.1-8b-instant",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
      };
    case "starter":
      return {
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
      };
    case "pro":
    case "enterprise":
      return {
        provider: "openai",
        model: "gpt-4o",
        baseUrl: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      };
  }
}

// ─── Low-level callers ────────────────────────────────────────────────────────

async function callOllama(baseUrl: string, model: string, systemPrompt: string, userMessage: string): Promise<ModelResult> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status} ${await response.text()}`);

  const data = await response.json() as any;
  const content = data.message?.content || "";
  const inputTokens = data.prompt_eval_count || Math.ceil(systemPrompt.length / 4);
  const outputTokens = data.eval_count || Math.ceil(content.length / 4);
  const providerModel = `ollama/${model}`;

  return { content, provider: "ollama", model, inputTokens, outputTokens, estimatedCostUsd: estimateCost(providerModel, inputTokens, outputTokens), wasFallback: false };
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  provider: string,
  systemPrompt: string,
  userMessage: string,
): Promise<ModelResult> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) throw new Error(`${provider} error: ${response.status} ${await response.text()}`);

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || "";
  const inputTokens = data.usage?.prompt_tokens || Math.ceil(systemPrompt.length / 4);
  const outputTokens = data.usage?.completion_tokens || Math.ceil(content.length / 4);
  const providerModel = `${provider}/${model}`;

  return { content, provider, model, inputTokens, outputTokens, estimatedCostUsd: estimateCost(providerModel, inputTokens, outputTokens), wasFallback: false };
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  provider?: string;
  model?: string;
  tokens?: number;
}

// ─── Production fallback helper ───────────────────────────────────────────────

/**
 * Try Groq fallback models in turn, skipping any that was the primary that
 * just failed to avoid 429-on-429 loops on the same account.
 *
 * Strategy:
 *   1. Try OpenAI (Replit integration) if configured — completely separate account.
 *   2. Walk GROQ_FALLBACK_CHAIN, skip `failedModel` (different buckets).
 *
 * Returns null only when every option is exhausted.
 */
async function tryProdFallback(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  failedProvider: string,
  failedModel: string,
  reason: string,
  context?: string,
): Promise<ModelResult | null> {
  const groqKey = process.env.GROQ_API_KEY;

  // ── 1. Try OpenAI integration first (completely different provider) ──────────
  const openaiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const openaiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (openaiBase && openaiKey && failedProvider !== "openai") {
    try {
      const response = await fetch(`${openaiBase}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: maxTokens, temperature: 0.3 }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`openai fallback error: ${response.status}`);
      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || "";
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const fallbackReason = `${failedProvider}/${failedModel} failed: ${reason}`;
      console.warn(`[model-router] ⚠️ FALLBACK: ${failedProvider}/${failedModel} → openai/gpt-4o-mini | ${reason}`);
      notifyModelFallback({ failedProvider, failedModel, fallbackModel: "openai/gpt-4o-mini", reason, context }).catch(() => {});
      return { content, provider: "openai", model: "gpt-4o-mini", inputTokens, outputTokens,
               estimatedCostUsd: estimateCost("openai/gpt-4o-mini", inputTokens, outputTokens), wasFallback: true, fallbackReason };
    } catch {
      /* fall through to Groq chain */
    }
  }

  // ── 2. Walk Groq fallback chain, skipping the model that just failed ─────────
  if (!groqKey) return null;

  for (const model of GROQ_FALLBACK_CHAIN) {
    if (failedProvider === "groq" && model === failedModel) continue; // skip same bucket

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model, messages, max_tokens: Math.min(maxTokens, 2048), temperature: 0.3 }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errText = await response.text();
        // 429 on this model too — try the next one in the chain
        if (response.status === 429) {
          console.warn(`[model-router] groq/${model} also rate-limited, trying next…`);
          continue;
        }
        throw new Error(`Groq ${model} error: ${response.status} ${errText}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || "";
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const providerModel = `groq/${model}`;
      const fallbackReason = `${failedProvider}/${failedModel} failed: ${reason}`;

      console.warn(`[model-router] ⚠️ FALLBACK: ${failedProvider}/${failedModel} → groq/${model} | ${reason}`);
      notifyModelFallback({ failedProvider, failedModel, fallbackModel: providerModel, reason, context }).catch(() => {});

      return {
        content, provider: "groq", model, inputTokens, outputTokens,
        estimatedCostUsd: estimateCost(providerModel, inputTokens, outputTokens),
        wasFallback: true, fallbackReason,
      };
    } catch (err) {
      if (isRateLimit(err)) {
        console.warn(`[model-router] groq/${model} rate-limited, trying next…`);
        continue;
      }
      console.error(`[model-router] groq/${model} error:`, err instanceof Error ? err.message : err);
      // non-429 error — stop trying Groq
      break;
    }
  }

  console.error(`[model-router] ❌ All fallbacks exhausted for ${failedProvider}/${failedModel}`);
  return null;
}

function templateFallback(systemPrompt: string, userMessage: string, failedProvider?: string, reason?: string): ModelResult {
  const tokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
  const fallbackReason = failedProvider ? `${failedProvider} failed: ${reason}. Groq fallback also unavailable.` : undefined;
  return {
    content: "__TEMPLATE__",
    provider: "template",
    model: "none",
    inputTokens: tokens,
    outputTokens: 0,
    estimatedCostUsd: 0,
    wasFallback: !!fallbackReason,
    fallbackReason,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a prompt through the appropriate model for the given tier.
 * In production (non-free tier), always falls back to Groq 8B on failure.
 * Sends a Telegram alert to the maintenance agent when fallback activates.
 *
 * @param context - optional description of what triggered this call (for alert message)
 */
export async function runModel(
  tier: ModelTier,
  systemPrompt: string,
  userMessage: string,
  context?: string,
): Promise<ModelResult> {
  const config = getModelForTier(tier);

  try {
    if (config.provider === "ollama") {
      return await callOllama(config.baseUrl!, config.model, systemPrompt, userMessage);
    }

    if (!config.apiKey) {
      // No key configured — go straight to prod fallback (or Ollama in dev)
      if (tier === "free") {
        try {
          return await callOllama(getModelForTier("free").baseUrl!, getModelForTier("free").model, systemPrompt, userMessage);
        } catch {
          return templateFallback(systemPrompt, userMessage);
        }
      }

      const fallback = await tryProdFallback(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        4096,
        config.provider,
        config.model,
        `API key missing for ${config.provider}`,
        context,
      );
      return fallback ?? templateFallback(systemPrompt, userMessage, config.provider, "API key missing");
    }

    return await callOpenAICompatible(config.baseUrl!, config.apiKey, config.model, config.provider, systemPrompt, userMessage);

  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[model-router] ${config.provider} failed:`, reason);

    if (tier === "free") {
      // Dev mode — no alert, just return template
      return templateFallback(systemPrompt, userMessage, config.provider, reason);
    }

    // Production: try Groq 8B fallback before giving up
    const fallback = await tryProdFallback(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
      4096,
      config.provider,
      config.model,
      reason,
      context,
    );
    return fallback ?? templateFallback(systemPrompt, userMessage, config.provider, reason);
  }
}

/**
 * Run a full multi-turn conversation through the appropriate model.
 * Same fallback policy as runModel.
 */
export async function runModelWithHistory(
  tier: ModelTier,
  systemPrompt: string,
  history: ChatMessage[],
  maxTokens = 2048,
  context?: string,
): Promise<ModelResult> {
  const config = getModelForTier(tier);
  const apiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  try {
    if (config.provider === "ollama") {
      return await callOllamaWithHistory(config.baseUrl!, config.model, apiMessages, maxTokens);
    }

    if (!config.apiKey) {
      if (tier === "free") {
        try {
          const ollamaConfig = getModelForTier("free");
          return await callOllamaWithHistory(ollamaConfig.baseUrl!, ollamaConfig.model, apiMessages, maxTokens);
        } catch {
          return templateFallback(systemPrompt, history[history.length - 1]?.content || "");
        }
      }

      const fallback = await tryProdFallback(apiMessages, maxTokens, config.provider, config.model, `API key missing for ${config.provider}`, context);
      return fallback ?? templateFallback(systemPrompt, history[history.length - 1]?.content || "", config.provider, "API key missing");
    }

    return await callOpenAICompatibleWithHistory(config.baseUrl!, config.apiKey, config.model, config.provider, apiMessages, maxTokens);

  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[model-router] ${config.provider} history failed:`, reason);

    if (tier === "free") {
      return templateFallback(systemPrompt, history[history.length - 1]?.content || "", config.provider, reason);
    }

    const fallback = await tryProdFallback(apiMessages, maxTokens, config.provider, config.model, reason, context);
    return fallback ?? templateFallback(systemPrompt, history[history.length - 1]?.content || "", config.provider, reason);
  }
}

async function callOllamaWithHistory(
  baseUrl: string,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
): Promise<ModelResult> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, options: { num_predict: maxTokens } }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
  const data = await response.json() as any;
  const content = data.message?.content || "";
  const inputTokens = data.prompt_eval_count || Math.ceil(messages.reduce((a, m) => a + m.content.length, 0) / 4);
  const outputTokens = data.eval_count || Math.ceil(content.length / 4);
  return { content, provider: "ollama", model, inputTokens, outputTokens, estimatedCostUsd: estimateCost(`ollama/${model}`, inputTokens, outputTokens), wasFallback: false };
}

async function callOpenAICompatibleWithHistory(
  baseUrl: string,
  apiKey: string,
  model: string,
  provider: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
): Promise<ModelResult> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.5 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`${provider} error: ${response.status} ${await response.text()}`);
  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || "";
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  return { content, provider, model, inputTokens, outputTokens, estimatedCostUsd: estimateCost(`${provider}/${model}`, inputTokens, outputTokens), wasFallback: false };
}

/** Pricing comparison table for the business plan */
export function getPricingComparison(inputTokens: number, outputTokens: number) {
  return [
    { tier: "free",       label: "Ollama (מקומי)",    cost: 0,                                                                       note: "פיתוח ובדיקות בלבד" },
    { tier: "fallback",   label: "Groq Llama 3.1 8B", cost: estimateCost("groq/llama-3.1-8b-instant", inputTokens, outputTokens),    note: "Fallback אוטומטי בפרודקשן" },
    { tier: "starter",    label: "Groq Llama 3.3 70B", cost: estimateCost("groq/llama-3.3-70b-versatile", inputTokens, outputTokens), note: "מהיר מאוד, חינמי עד מכסה" },
    { tier: "pro",        label: "GPT-4o",             cost: estimateCost("openai/gpt-4o", inputTokens, outputTokens),               note: "איכות מקסימלית" },
    { tier: "enterprise", label: "GPT-4o (Enterprise)", cost: estimateCost("openai/gpt-4o", inputTokens * 10, outputTokens * 10),    note: "בסקייל × 10" },
  ];
}
