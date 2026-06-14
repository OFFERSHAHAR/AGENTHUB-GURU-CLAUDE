/**
 * Shared Telegram notification helper.
 * Reads TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID from env.
 * All failures are swallowed — callers never crash due to Telegram issues.
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

function getOpsChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_CHAT_ID || null;
}

// When running under the test runner we must never hit the real Telegram API.
// TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are shared across every work environment,
// so a test that fires a webhook would otherwise spam the live ops chat.
function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test";
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
): Promise<void> {
  if (isTestEnv()) return;
  const token = getBotToken();
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.error("[telegram-notify] sendMessage failed:", err);
  }
}

/**
 * Internal contexts that should never trigger user-facing Telegram notifications.
 * These are background/tool calls — spamming ops chat for them is harmful.
 */
const SILENT_CONTEXTS = [
  "journal-qa-extract",
  "journal-qa",
  "spec-agent",
  "lead-classifier-internal",
  "internal",
];

/**
 * Notify the maintenance agent when a model fallback fires in production.
 * Called automatically by model-router when primary model fails.
 */
export async function notifyModelFallback(opts: {
  failedProvider: string;
  failedModel: string;
  fallbackModel: string;
  reason: string;
  context?: string;
}): Promise<void> {
  const chatId = getOpsChatId();
  if (!chatId) return;

  // Suppress noisy internal-tool fallbacks — only alert for user-facing flows.
  if (opts.context && SILENT_CONTEXTS.some((s) => opts.context!.includes(s))) return;

  const timeStr = new Date().toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const text = [
    "⚠️ <b>MODEL FALLBACK — סוכן תחזוקה</b>",
    "",
    `🕐 <b>זמן:</b> ${timeStr}`,
    `❌ <b>מודל נכשל:</b> <code>${opts.failedProvider}/${opts.failedModel}</code>`,
    `✅ <b>Fallback פעיל:</b> <code>${opts.fallbackModel}</code>`,
    `📋 <b>סיבה:</b> ${opts.reason.slice(0, 200)}`,
    opts.context ? `🔍 <b>הקשר:</b> ${opts.context}` : "",
    "",
    "🔧 זרימת המשתמש נשמרה — נא לבדוק ולתקן את המודל הראשי",
  ].filter(Boolean).join("\n");

  await sendTelegramMessage(chatId, text);
}

/**
 * Notify the ops Telegram chat when a webhook trigger fires.
 * Fails silently — webhook response is never blocked by this.
 */
export async function notifyWebhookFired(opts: {
  clientName: string;
  agentName: string;
  firedAt: Date;
  payload: unknown;
}): Promise<void> {
  const chatId = getOpsChatId();
  if (!chatId) return;

  const payloadStr = JSON.stringify(opts.payload);
  const payloadSummary = payloadStr.length > 100
    ? payloadStr.slice(0, 100) + "…"
    : payloadStr;

  const timeStr = opts.firedAt.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const text = [
    "🔔 <b>Webhook Triggered</b>",
    "",
    `👤 <b>לקוח:</b> ${opts.clientName}`,
    `🤖 <b>סוכן:</b> ${opts.agentName}`,
    `🕐 <b>זמן:</b> ${timeStr}`,
    `📦 <b>Payload:</b> <code>${payloadSummary}</code>`,
  ].join("\n");

  await sendTelegramMessage(chatId, text);
}
