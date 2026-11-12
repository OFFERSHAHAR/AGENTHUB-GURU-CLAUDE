import type { NextFunction, Request, Response } from "express";
import {
  verifyTelegramInitData,
  initDataUserId,
  allowedMiniAppUserIds,
} from "../lib/telegram-init-data";

const COOKIE_NAME = "ah_auth";
const VALID_USERS = new Set(["offer", "or", "1"]);

function isPublicApiPath(method: string, path: string): boolean {
  if (method === "POST" && path === "/telegram/webhook") return true;
  if ((method === "GET" || method === "POST") && path.startsWith("/webhooks/trigger/")) return true;
  if (method === "POST" && path === "/email/inbound") return true;
  if (method === "POST" && path === "/public/chat/start") return true;
  return false;
}

// The only routes the Telegram Mini Apps (/gever, /jarvis) need. A verified
// Telegram session unlocks these and nothing else — no writes to clients,
// agents, settings, etc.
function isMiniAppPath(method: string, path: string): boolean {
  if (method === "GET") {
    return (
      path === "/clients" ||
      path === "/agents" ||
      path === "/logs" ||
      path === "/jarvis/status" ||
      path.startsWith("/jarvis/result/")
    );
  }
  return method === "POST" && path === "/jarvis/command";
}

function telegramInitData(req: Request): string {
  const header = req.get("x-telegram-init-data");
  if (header) return header;
  const body = req.body as { initData?: unknown } | undefined;
  return typeof body?.initData === "string" ? body.initData : "";
}

export function isAuthorizedMiniAppRequest(
  req: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isMiniAppPath(req.method, req.path)) return false;
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;
  const initData = telegramInitData(req);
  if (!initData || !verifyTelegramInitData(initData, botToken)) return false;
  const userId = initDataUserId(initData);
  return userId !== null && allowedMiniAppUserIds(env).has(userId);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isPublicApiPath(req.method, req.path)) {
    next();
    return;
  }

  const cookieVal = req.signedCookies?.[COOKIE_NAME] as string | undefined;
  if (cookieVal && VALID_USERS.has(cookieVal)) {
    next();
    return;
  }

  if (isAuthorizedMiniAppRequest(req)) {
    next();
    return;
  }

  res.status(401).json({ error: "auth_required" });
}
