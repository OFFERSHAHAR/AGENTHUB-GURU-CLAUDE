import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import express from "express";
import jarvisRouter from "./jarvis.js";

// ── Minimal app: mount ONLY the jarvis bridge router so we exercise the real
// command/result/poll protocol + SSE broadcast without booting the whole server
// (schedulers, log-processor, etc start on the full routes/index import).
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", jarvisRouter);
  return app;
}

interface SseFrame {
  id?: number;
  event?: string;
  data?: any;
}

// A live "desktop executor": holds the SSE stream open, captures the connect
// token, and exposes a queue of incoming `command` broadcasts. This mirrors what
// the real desktop Jarvis component does over the bridge.
class FakeDesktop {
  ctrl = new AbortController();
  token = "";
  id = "";
  baseUrl = "";
  private commands: SseFrame[] = [];
  private waiters: Array<(f: SseFrame) => void> = [];
  private buffer = "";
  private readerDone: Promise<void>;

  private constructor(private res: Response) {
    this.readerDone = this.pump();
  }

  static async connect(baseUrl: string): Promise<FakeDesktop> {
    const ctrl = new AbortController();
    const res = await fetch(`${baseUrl}/api/jarvis/stream`, {
      headers: { Accept: "text/event-stream" },
      signal: ctrl.signal,
    });
    assert.equal(res.status, 200);
    const d = new FakeDesktop(res);
    d.ctrl = ctrl;
    d.baseUrl = baseUrl;
    // Wait for the `connected` hello so the executor token is available.
    await d.waitForConnected();
    return d;
  }

  private async pump(): Promise<void> {
    const reader = this.res.body!.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        this.buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = this.buffer.indexOf("\n\n")) !== -1) {
          const raw = this.buffer.slice(0, sep);
          this.buffer = this.buffer.slice(sep + 2);
          if (!raw.trim() || raw.startsWith(":")) continue; // heartbeat/comment
          const frame: SseFrame = {};
          for (const line of raw.split("\n")) {
            if (line.startsWith("id:")) frame.id = parseInt(line.slice(3).trim(), 10);
            else if (line.startsWith("event:")) frame.event = line.slice(6).trim();
            else if (line.startsWith("data:")) frame.data = JSON.parse(line.slice(5).trim());
          }
          this.handleFrame(frame);
        }
      }
    } catch {
      // aborted — expected on teardown
    }
  }

  private connectedResolve: (() => void) | null = null;
  private connectedPromise = new Promise<void>((r) => (this.connectedResolve = r));

  private handleFrame(frame: SseFrame) {
    if (frame.event === "connected") {
      this.token = frame.data?.token ?? "";
      this.id = frame.data?.id ?? "";
      this.connectedResolve?.();
      return;
    }
    if (frame.event === "command") {
      const waiter = this.waiters.shift();
      if (waiter) waiter(frame);
      else this.commands.push(frame);
    }
  }

  private waitForConnected(): Promise<void> {
    return this.connectedPromise;
  }

  // Resolve the next `command` broadcast (already-queued or future), or reject.
  nextCommand(timeoutMs = 4000): Promise<SseFrame> {
    const queued = this.commands.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise<SseFrame>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for command frame")), timeoutMs);
      this.waiters.push((f) => {
        clearTimeout(timer);
        resolve(f);
      });
    });
  }

  async close(): Promise<void> {
    this.ctrl.abort();
    await this.readerDone.catch(() => {});
    // Aborting the client socket is asynchronous server-side: the bridge removes
    // the desktop from its map on the request `close` event. Wait until this
    // connection is actually gone so the next test sees a clean slate.
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      try {
        const s = await fetch(`${this.baseUrl}/api/jarvis/status`).then((r) => r.json());
        if (!s.connections) break;
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

let server: Server;
let baseUrl: string;
let savedBotToken: string | undefined;

before(async () => {
  // The bridge gates command injection behind Telegram initData verification
  // *only when* a bot token is configured. The protocol/SSE tests below run
  // with command injection open (no token); the dedicated initData describe
  // block sets its own token. Save + clear the real env token so a token that
  // happens to be present in the dev environment can't break these tests.
  savedBotToken = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;

  server = createServer(buildApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (savedBotToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = savedBotToken;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function postCommand(body: unknown) {
  const res = await fetch(`${baseUrl}/api/jarvis/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function postResult(body: unknown) {
  const res = await fetch(`${baseUrl}/api/jarvis/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function poll(commandId: string) {
  const res = await fetch(`${baseUrl}/api/jarvis/result/${commandId}`);
  return { status: res.status, json: await res.json() };
}

describe("jarvis bridge — command broadcast", () => {
  it("forwards select_trigger + choiceIndex to a connected desktop", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const cmdPromise = desk.nextCommand();
      const { json } = await postCommand({
        text: "הפעל trigger Acme",
        action: "select_trigger",
        choiceIndex: 2,
      });
      assert.equal(json.ok, true);
      assert.equal(json.desktopConnected, true);

      const frame = await cmdPromise;
      assert.equal(frame.event, "command");
      assert.equal(frame.data.commandId, json.commandId);
      assert.equal(frame.data.text, "הפעל trigger Acme");
      // select_trigger is allow-listed; the picked index rides alongside it.
      assert.equal(frame.data.action, "select_trigger");
      assert.equal(frame.data.choiceIndex, 2);
    } finally {
      await desk.close();
    }
  });

  it("allows confirm_trigger / cancel_trigger and drops unknown action verbs", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      for (const action of ["confirm_trigger", "cancel_trigger"]) {
        const cmdPromise = desk.nextCommand();
        await postCommand({ text: "x", action });
        const frame = await cmdPromise;
        assert.equal(frame.data.action, action);
      }
      // Anything outside the allow-list is dropped to null (treated as plain text).
      const cmdPromise = desk.nextCommand();
      await postCommand({ text: "x", action: "delete_everything" });
      const frame = await cmdPromise;
      assert.equal(frame.data.action, null);
    } finally {
      await desk.close();
    }
  });

  it("sanitises choiceIndex: only a non-negative integer survives", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const cases: Array<[unknown, number | null]> = [
        [0, 0],
        [3, 3],
        [-1, null],
        [1.5, null],
        ["2", null],
      ];
      for (const [input, expected] of cases) {
        const cmdPromise = desk.nextCommand();
        await postCommand({ text: "x", action: "select_trigger", choiceIndex: input });
        const frame = await cmdPromise;
        assert.equal(frame.data.choiceIndex, expected, `choiceIndex ${JSON.stringify(input)}`);
      }
    } finally {
      await desk.close();
    }
  });

  it("fast-fails a command when no desktop is connected", async () => {
    const { json } = await postCommand({ text: "status" });
    assert.equal(json.ok, true);
    assert.equal(json.desktopConnected, false);
    const polled = await poll(json.commandId);
    assert.equal(polled.json.status, "done");
    assert.match(polled.json.result, /הדסקטופ לא מחובר/);
  });

  it("rejects an empty command text", async () => {
    const { status, json } = await postCommand({ text: "   " });
    assert.equal(status, 400);
    assert.equal(json.ok, false);
  });
});

describe("jarvis bridge — result + poll protocol", () => {
  it("round-trips a choices pick-list payload from desktop to Mini App", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const cmdPromise = desk.nextCommand();
      const { json: cmd } = await postCommand({ text: "הפעל trigger Acme" });
      const frame = await cmdPromise;
      const commandId = frame.data.commandId;
      assert.equal(commandId, cmd.commandId);

      // Desktop matched >1 trigger → posts a choices pick-list (no confirm yet).
      const r = await postResult({
        commandId,
        executorToken: desk.token,
        result: "נמצאו 2 טריגרים. בחר איזה סוכן להפעיל:",
        choices: [{ label: "Agent A · Acme" }, { label: "Agent B · Acme" }],
      });
      assert.equal(r.json.ok, true);

      const polled = await poll(commandId);
      assert.equal(polled.json.status, "done");
      assert.equal(polled.json.confirm, null);
      assert.deepEqual(polled.json.choices, [
        { label: "Agent A · Acme" },
        { label: "Agent B · Acme" },
      ]);
    } finally {
      await desk.close();
    }
  });

  it("round-trips a single-trigger confirm payload (no choices)", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const cmdPromise = desk.nextCommand();
      const { json: cmd } = await postCommand({ text: "הפעל trigger Acme" });
      await cmdPromise;

      const r = await postResult({
        commandId: cmd.commandId,
        executorToken: desk.token,
        result: "⚡ לאשר הפעלת trigger עבור Agent A · Acme?",
        confirm: { label: "Agent A · Acme" },
      });
      assert.equal(r.json.ok, true);

      const polled = await poll(cmd.commandId);
      assert.deepEqual(polled.json.confirm, { label: "Agent A · Acme" });
      assert.equal(polled.json.choices, null);
    } finally {
      await desk.close();
    }
  });

  it("filters malformed choice entries, keeping only {label}", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const cmdPromise = desk.nextCommand();
      const { json: cmd } = await postCommand({ text: "run" });
      await cmdPromise;

      await postResult({
        commandId: cmd.commandId,
        executorToken: desk.token,
        result: "pick",
        choices: [{ label: "Good" }, { nope: 1 }, "string", null, { label: 5 }],
      });
      const polled = await poll(cmd.commandId);
      assert.deepEqual(polled.json.choices, [{ label: "Good" }]);
    } finally {
      await desk.close();
    }
  });

  it("treats an empty choices array as no pick-list (null)", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const cmdPromise = desk.nextCommand();
      const { json: cmd } = await postCommand({ text: "run" });
      await cmdPromise;
      await postResult({ commandId: cmd.commandId, executorToken: desk.token, result: "x", choices: [] });
      const polled = await poll(cmd.commandId);
      assert.equal(polled.json.choices, null);
    } finally {
      await desk.close();
    }
  });

  it("returns 404 when polling an unknown / expired command", async () => {
    const polled = await poll("does-not-exist");
    assert.equal(polled.status, 404);
    assert.equal(polled.json.status, "expired");
  });
});

describe("jarvis bridge — executor-token gating on results", () => {
  it("rejects a result with no executor token", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const cmdPromise = desk.nextCommand();
      const { json: cmd } = await postCommand({ text: "run" });
      await cmdPromise;
      const r = await postResult({ commandId: cmd.commandId, result: "forged" });
      assert.equal(r.status, 401);
      assert.equal(r.json.ok, false);
    } finally {
      await desk.close();
    }
  });

  it("rejects a result with a wrong executor token", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const cmdPromise = desk.nextCommand();
      const { json: cmd } = await postCommand({ text: "run" });
      await cmdPromise;
      const r = await postResult({
        commandId: cmd.commandId,
        executorToken: "not-a-real-token",
        result: "forged",
      });
      assert.equal(r.status, 401);
    } finally {
      await desk.close();
    }
  });

  it("returns 404 when a live executor posts to an unknown command", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const r = await postResult({
        commandId: "missing",
        executorToken: desk.token,
        result: "x",
      });
      assert.equal(r.status, 404);
    } finally {
      await desk.close();
    }
  });
});

describe("jarvis bridge — status endpoint", () => {
  it("reports whether a desktop is listening", async () => {
    const before = await fetch(`${baseUrl}/api/jarvis/status`).then((r) => r.json());
    const baseline = before.connections as number;
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const during = await fetch(`${baseUrl}/api/jarvis/status`).then((r) => r.json());
      assert.equal(during.desktopConnected, true);
      assert.ok(during.connections > baseline);
    } finally {
      await desk.close();
    }
  });
});

describe("jarvis bridge — Telegram initData gating on command injection", () => {
  const BOT_TOKEN = "123456:test-bot-token";

  // Build a valid signed initData string the way the Telegram WebApp would,
  // matching the server's HMAC scheme (key = HMAC('WebAppData', botToken)).
  function signInitData(fields: Record<string, string>): string {
    const params = new URLSearchParams(fields);
    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    params.set("hash", hash);
    return params.toString();
  }

  before(() => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  });
  after(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it("rejects a command with no / invalid initData when a bot token is set", async () => {
    const missing = await postCommand({ text: "status" });
    assert.equal(missing.status, 401);
    const bogus = await postCommand({ text: "status", initData: "user=x&hash=deadbeef" });
    assert.equal(bogus.status, 401);
  });

  it("rejects a command whose initData auth_date is stale (replay protection)", async () => {
    const stale = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000) - 48 * 60 * 60),
      user: "tony",
    });
    const res = await postCommand({ text: "status", initData: stale });
    assert.equal(res.status, 401);
  });

  it("accepts a command with fresh, correctly-signed initData", async () => {
    const desk = await FakeDesktop.connect(baseUrl);
    try {
      const cmdPromise = desk.nextCommand();
      const fresh = signInitData({
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: "tony",
      });
      const res = await postCommand({ text: "status", initData: fresh });
      assert.equal(res.status, 200);
      assert.equal(res.json.ok, true);
      const frame = await cmdPromise;
      assert.equal(frame.data.text, "status");
    } finally {
      await desk.close();
    }
  });
});
