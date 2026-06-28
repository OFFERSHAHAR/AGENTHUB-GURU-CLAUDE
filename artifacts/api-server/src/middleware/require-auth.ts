import type { NextFunction, Request, Response } from "express";

const COOKIE_NAME = "ah_auth";
const VALID_USERS = new Set(["offer", "or", "1"]);

function isPublicApiPath(method: string, path: string): boolean {
  if (method === "POST" && path === "/telegram/webhook") return true;
  if ((method === "GET" || method === "POST") && path.startsWith("/webhooks/trigger/")) return true;
  if (method === "POST" && path === "/email/inbound") return true;
  if (method === "POST" && path === "/public/chat/start") return true;
  return false;
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

  res.status(401).json({ error: "auth_required" });
}
