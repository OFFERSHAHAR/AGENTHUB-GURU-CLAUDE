import { Router, type IRouter, type Response } from "express";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { runModel } from "../services/model-router.js";

const router: IRouter = Router();

// ─── Telegram WebApp initData verification ─────────────────────────────────────
// The Mini App must prove the request really comes from a Telegram user by
// sending the signed `initData` string. We validate the HMAC using the bot token
// per Telegram's spec. This is the access control for who may inject commands.
const AUTH_MAX_AGE_SEC = 24 * 60 * 60; // reject initData older than 24h

function verifyTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;
    params.delete("hash");

    // Freshness check (replay protection)
    const authDate = Number(params.get("auth_date") ?? 0);
    if (!authDate || Date.now() / 1000 - authDate > AUTH_MAX_AGE_SEC) return false;

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

/**
 * Jarvis Command Bridge
 * ─────────────────────
 * Connects the Telegram Mini App (remote) to the desktop Jarvis (executor).
 *
 *   Mini App  --POST /jarvis/command-->  [bridge]  --SSE /jarvis/stream-->  Desktop
 *   Desktop   --POST /jarvis/result--->  [bridge]  <--GET /jarvis/result/:id-- Mini App
 *
 * Everything is in-memory (no DB). Connections + pending commands live for the
 * lifetime of the process only.
 */

// ─── In-memory state ───────────────────────────────────────────────────────────
interface DesktopConn {
  id: string;
  res: Response;
  // Per-connection secret issued at connect time. The desktop must echo this
  // back when posting results, so only a live executor can resolve a command.
  token: string;
}

interface PendingCommand {
  id: string;
  text: string;
  createdAt: number;
  status: "pending" | "done";
  result?: string;
  // When set, the desktop is asking the Mini App to surface a confirm prompt
  // before a write action (e.g. firing a trigger) is actually executed.
  confirm?: { label: string } | null;
  // When set, the client matched more than one configured trigger and the
  // desktop is asking the Mini App to render a pick-list so ops can choose
  // which agent to run before the confirm step. Each option carries the agent's
  // live trigger status (idle / running / triggered) so ops can avoid firing an
  // agent that is already busy.
  choices?: { label: string; status?: string }[] | null;
}

// Write actions from Telegram are gated behind an explicit confirm step. Only
// these allow-listed action verbs are accepted; anything else is ignored and
// treated as a plain read/navigate command. `select_trigger` picks one agent
// from a multi-trigger pick-list and leads into the confirm step.
// `refresh_choices` is a read-only poll: while the pick-list is open the Mini
// App asks the desktop to re-read the held candidates' live statuses and send
// them back, so the badges stay current without rebuilding the list.
const ALLOWED_ACTIONS = new Set(["confirm_trigger", "cancel_trigger", "select_trigger", "refresh_choices"]);

const desktops = new Map<string, DesktopConn>();
const commands = new Map<string, PendingCommand>();

const COMMAND_TTL_MS = 5 * 60 * 1000;

function pruneCommands(): void {
  const now = Date.now();
  for (const [id, cmd] of commands) {
    if (now - cmd.createdAt > COMMAND_TTL_MS) commands.delete(id);
  }
}

function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const conn of desktops.values()) {
    try {
      conn.res.write(payload);
    } catch {
      // dead connection — will be cleaned up on close
    }
  }
}

// ─── SSE stream — desktop connects here ────────────────────────────────────────
router.get("/jarvis/stream", (req, res): void => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const id = randomUUID();
  const token = randomUUID();
  desktops.set(id, { id, res, token });

  // Initial hello so the client knows it's connected. The token authorizes this
  // desktop to post results back; it never leaves the executor's runtime.
  res.write(`event: connected\ndata: ${JSON.stringify({ id, token })}\n\n`);

  // Heartbeat to keep the proxy connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      // ignore
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    desktops.delete(id);
  });
});

// ─── Mini App submits a command ────────────────────────────────────────────────
router.post("/jarvis/command", (req, res): void => {
  pruneCommands();

  // Access control: when a bot token is configured, the caller must present a
  // valid, fresh Telegram initData signature. This blocks anonymous callers
  // from injecting commands into a connected desktop executor.
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  if (botToken) {
    const initData = typeof req.body?.initData === "string" ? req.body.initData : "";
    if (!verifyTelegramInitData(initData, botToken)) {
      res.status(401).json({ ok: false, error: "unauthorized — invalid Telegram session" });
      return;
    }
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ ok: false, error: "text is required" });
    return;
  }

  // Optional write-action verb (confirm/cancel a pending trigger run). Anything
  // outside the allow-list is dropped so the desktop treats it as plain text.
  const action =
    typeof req.body?.action === "string" && ALLOWED_ACTIONS.has(req.body.action)
      ? req.body.action
      : null;

  // Optional zero-based index identifying which agent was picked from a
  // multi-trigger pick-list. Only meaningful alongside `select_trigger`.
  const choiceIndex =
    typeof req.body?.choiceIndex === "number" &&
    Number.isInteger(req.body.choiceIndex) &&
    req.body.choiceIndex >= 0
      ? req.body.choiceIndex
      : null;

  const id = randomUUID();
  const cmd: PendingCommand = { id, text, createdAt: Date.now(), status: "pending" };
  commands.set(id, cmd);

  const desktopConnected = desktops.size > 0;
  broadcast("command", { commandId: id, text, action, choiceIndex });

  // If no desktop is listening, fail the command quickly so the Mini App can
  // tell the user instead of polling forever.
  if (!desktopConnected) {
    cmd.status = "done";
    cmd.result = "⚠️ הדסקטופ לא מחובר. פתח את AgentHub במחשב כדי שג׳ארביס יוכל לבצע פקודות.";
  }

  res.json({ ok: true, commandId: id, desktopConnected });
});

// ─── Desktop posts a result back ───────────────────────────────────────────────
router.post("/jarvis/result", (req, res): void => {
  // Only a live desktop executor (holding the token issued at /stream connect)
  // may resolve a command. This prevents arbitrary callers from injecting fake
  // results / hijacking a Mini App's pending command.
  const executorToken = typeof req.body?.executorToken === "string" ? req.body.executorToken : "";
  const isLiveExecutor = [...desktops.values()].some((d) => d.token === executorToken);
  if (!executorToken || !isLiveExecutor) {
    res.status(401).json({ ok: false, error: "unauthorized — not a live executor" });
    return;
  }

  const commandId = typeof req.body?.commandId === "string" ? req.body.commandId : "";
  const result = typeof req.body?.result === "string" ? req.body.result : "";
  if (!commandId) {
    res.status(400).json({ ok: false, error: "commandId is required" });
    return;
  }
  const cmd = commands.get(commandId);
  if (!cmd) {
    res.status(404).json({ ok: false, error: "command not found or expired" });
    return;
  }
  // Optional confirm prompt: when present, the Mini App renders a one-tap
  // confirm/cancel UI instead of treating the result as a final answer.
  const confirm =
    req.body?.confirm && typeof req.body.confirm === "object" && typeof req.body.confirm.label === "string"
      ? { label: req.body.confirm.label }
      : null;

  // Optional pick-list: when the matched client has more than one configured
  // trigger, the desktop sends the agent labels so the Mini App can let ops
  // choose which one to run before the confirm step.
  const choices = Array.isArray(req.body?.choices)
    ? (req.body.choices as unknown[])
        .filter(
          (c): c is { label: string; status?: unknown } =>
            !!c && typeof c === "object" && typeof (c as { label?: unknown }).label === "string",
        )
        .map((c) => ({
          label: c.label,
          ...(typeof c.status === "string" ? { status: c.status } : {}),
        }))
    : null;

  cmd.status = "done";
  cmd.result = result;
  cmd.confirm = confirm;
  cmd.choices = choices && choices.length > 0 ? choices : null;
  res.json({ ok: true });
});

// ─── Mini App polls for the result ─────────────────────────────────────────────
router.get("/jarvis/result/:commandId", (req, res): void => {
  const cmd = commands.get(req.params.commandId);
  if (!cmd) {
    res.status(404).json({ ok: false, status: "expired" });
    return;
  }
  res.json({ ok: true, status: cmd.status, result: cmd.result ?? null, confirm: cmd.confirm ?? null, choices: cmd.choices ?? null });
});

// ─── Status — is a desktop listening? ──────────────────────────────────────────
router.get("/jarvis/status", (_req, res): void => {
  res.json({ desktopConnected: desktops.size > 0, connections: desktops.size });
});

// ─── LLM interpretation for unrecognised commands ──────────────────────────────
const JARVIS_SYSTEM_PROMPT = `אתה ג'ארביס (JARVIS), עוזר AI מתוחכם בסגנון טוני סטארק, המשרת את מנהל פלטפורמת AgentHub — מערכת לניהול סוכני AI ולקוחות.
ענה תמיד בעברית, בקצרה (משפט-שניים), בטון מקצועי, חד ומעט שנון. פנה למשתמש "מר סטארק".
אם נשאלת על נתונים שאין לך גישה אליהם, הצע איך אפשר לקבל אותם בממשק. אל תמציא נתונים.`;

router.post("/jarvis/interpret", async (req, res): Promise<void> => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ ok: false, error: "text is required" });
    return;
  }
  try {
    const result = await runModel("starter", JARVIS_SYSTEM_PROMPT, text, "jarvis-command");
    let reply = result.content?.trim() || "";
    if (!reply || reply === "__TEMPLATE__") {
      reply = `קיבלתי: "${text}". כרגע אין לי מודל זמין לפרשנות חופשית, מר סטארק — נסה פקודה מוגדרת.`;
    }
    res.json({ ok: true, reply, provider: result.provider, model: result.model });
  } catch (err) {
    res.json({
      ok: false,
      reply: `לא הצלחתי לעבד את הבקשה, מר סטארק. (${err instanceof Error ? err.message : "שגיאה"})`,
    });
  }
});

export default router;
