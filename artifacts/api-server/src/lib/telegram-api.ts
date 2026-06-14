/**
 * Low-level Telegram Bot API helpers shared across routes/services.
 * Adds inline-button + callback support on top of plain text messages.
 * All failures are swallowed — callers never crash due to Telegram issues.
 * Never hits the real Telegram API under the test runner (shared bot token).
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export function getOpsChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_CHAT_ID || null;
}

export function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test";
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

/**
 * Send a message with one or more rows of inline callback buttons.
 * Returns the Telegram message_id on success (so callers can edit it later),
 * or null when skipped/failed.
 */
export async function sendMessageWithButtons(
  chatId: string | number,
  text: string,
  buttons: InlineButton[][],
): Promise<string | null> {
  if (isTestEnv()) return null;
  const token = getBotToken();
  if (!token) return null;
  try {
    const r = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      }),
    });
    const data = (await r.json()) as { ok?: boolean; result?: { message_id?: number } };
    return data.ok && data.result?.message_id != null ? String(data.result.message_id) : null;
  } catch (err) {
    console.error("[telegram-api] sendMessageWithButtons failed:", err);
    return null;
  }
}

/** Acknowledge a callback_query so Telegram stops the loading spinner on the button. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (isTestEnv()) return;
  const token = getBotToken();
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) {
    console.error("[telegram-api] answerCallbackQuery failed:", err);
  }
}

/** Replace the text of an existing message and strip its buttons. */
export async function editMessageText(
  chatId: string | number,
  messageId: string | number,
  text: string,
): Promise<void> {
  if (isTestEnv()) return;
  const token = getBotToken();
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      }),
    });
  } catch (err) {
    console.error("[telegram-api] editMessageText failed:", err);
  }
}
