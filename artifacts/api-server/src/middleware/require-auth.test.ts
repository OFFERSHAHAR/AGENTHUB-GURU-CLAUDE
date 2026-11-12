import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import { requireAuth } from "./require-auth.js";

const BOT = "123456:TEST-BOT-TOKEN";
process.env.TELEGRAM_BOT_TOKEN = BOT;
process.env.TELEGRAM_MINIAPP_USER_IDS = "111,222";

// Build initData exactly the way Telegram signs it.
function signInitData(userId: number, authDate = Math.floor(Date.now() / 1000), token = BOT) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAE",
    user: JSON.stringify({ id: userId, first_name: "Test" }),
  });
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(dcs).digest("hex"));
  return params.toString();
}

let server: Server;
let base = "";
before(async () => {
  const app = express();
  app.use(cookieParser("s"));
  app.use(express.json());
  app.use(requireAuth);
  app.all(/.*/, (_req, res) => { res.json({ ok: true }); });
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));

const get = (path: string, initData?: string) =>
  fetch(base + path, { headers: initData ? { "X-Telegram-Init-Data": initData } : {} });

describe("requireAuth — Telegram Mini App sessions", () => {
  it("anonymous requests are rejected", async () => {
    assert.equal((await get("/clients")).status, 401);
  });

  it("an allowlisted, validly signed Telegram user can read mini-app routes", async () => {
    const d = signInitData(111);
    assert.equal((await get("/clients", d)).status, 200);
    assert.equal((await get("/logs?limit=50", d)).status, 200);
    assert.equal((await get("/jarvis/status", d)).status, 200);
  });

  it("a verified session does NOT unlock other routes or writes", async () => {
    const d = signInitData(111);
    assert.equal((await get("/settings", d)).status, 401);
    const del = await fetch(base + "/clients/5", { method: "DELETE", headers: { "X-Telegram-Init-Data": d } });
    assert.equal(del.status, 401);
  });

  it("rejects a user not on the allowlist, a forged hash, and stale initData", async () => {
    assert.equal((await get("/clients", signInitData(999))).status, 401);
    assert.equal((await get("/clients", signInitData(111, undefined, "other:token"))).status, 401);
    const stale = Math.floor(Date.now() / 1000) - 2 * 24 * 3600;
    assert.equal((await get("/clients", signInitData(111, stale))).status, 401);
  });

  it("POST /jarvis/command accepts initData in the body", async () => {
    const res = await fetch(base + "/jarvis/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hi", initData: signInitData(222) }),
    });
    assert.equal(res.status, 200);
  });
});
