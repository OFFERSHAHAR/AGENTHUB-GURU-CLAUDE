import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import { MAX_PER_KEY } from "../lib/login-limiter.js";

// Exercises the real auth router (login / session) without booting the app.
process.env.APP_ACCESS_PASSWORD = "test-pass-offer";

let server: Server;
let baseUrl = "";

before(async () => {
  const { default: authRouter } = await import("./auth.js");
  const app = express();
  app.set("trust proxy", true);
  app.use(cookieParser("test-secret"));
  app.use(express.json());
  app.use("/api", authRouter);
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));

const login = (password: string, ip: string) =>
  fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ password }),
  });

describe("POST /auth/login", () => {
  it("rejects a missing password with 400", async () => {
    assert.equal((await login("", "10.0.0.1")).status, 400);
  });

  it("accepts the right password and sets a signed httpOnly cookie", async () => {
    const res = await login("test-pass-offer", "10.0.0.2");
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie") ?? "";
    assert.match(cookie, /ah_auth=/);
    assert.match(cookie, /HttpOnly/i);

    const session = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    const body = (await session.json()) as { authenticated: boolean; user: string };
    assert.equal(body.authenticated, true);
    assert.equal(body.user, "offer");
  });

  it("returns 401 for a wrong password, then 429 after too many attempts", async () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < MAX_PER_KEY; i++) {
      assert.equal((await login("nope", ip)).status, 401);
    }
    const blocked = await login("test-pass-offer", ip);
    assert.equal(blocked.status, 429, "even the right password waits out the lockout");
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    // A different client is not locked out.
    assert.equal((await login("test-pass-offer", "10.0.0.4")).status, 200);
  });
});
