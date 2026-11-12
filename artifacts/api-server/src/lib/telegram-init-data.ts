import { createHmac, timingSafeEqual } from "node:crypto";

// Telegram Mini App initData verification (core.telegram.org/bots/webapps).
// The Mini App proves the request comes from a real Telegram user by sending
// the signed `initData` string; we check the HMAC with the bot token.

export const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60; // replay protection

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  nowSec: number = Date.now() / 1000,
): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;
    params.delete("hash");

    const authDate = Number(params.get("auth_date") ?? 0);
    if (!authDate || nowSec - authDate > INIT_DATA_MAX_AGE_SEC) return false;

    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Telegram user id from initData (call only after verifying it). */
export function initDataUserId(initData: string): string | null {
  try {
    const raw = new URLSearchParams(initData).get("user");
    if (!raw) return null;
    const id = (JSON.parse(raw) as { id?: unknown }).id;
    return typeof id === "number" || typeof id === "string" ? String(id) : null;
  } catch {
    return null;
  }
}

/**
 * Telegram user ids allowed to use the Mini Apps. TELEGRAM_MINIAPP_USER_IDS
 * (comma-separated) wins; otherwise the managers' private chat ids are used
 * (for a private chat, chat id === user id). Empty list → nobody.
 */
export function allowedMiniAppUserIds(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const explicit = env.TELEGRAM_MINIAPP_USER_IDS;
  const source = explicit
    ? explicit.split(",")
    : [env.ADMIN_TELEGRAM_CHAT_ID, env.TELEGRAM_CHAT_ID];
  return new Set(
    source
      .map((s) => (s ?? "").trim())
      .filter((s) => /^\d+$/.test(s)), // groups/channels are negative → never users
  );
}
