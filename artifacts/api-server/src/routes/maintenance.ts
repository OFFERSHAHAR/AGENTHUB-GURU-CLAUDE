import { Router, type IRouter } from "express";
import { db, clientsTable, agentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const TELEGRAM_API = "https://api.telegram.org/bot";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

function getAdminChatId(): string | null {
  return process.env.ADMIN_TELEGRAM_CHAT_ID || null;
}

// Never hit the real Telegram API under the test runner — the bot token/chat id
// are shared across every work environment, so tests would spam the live chat.
function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test";
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (isTestEnv()) return;
  const token = getBotToken();
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {
    console.error("[maintenance] Telegram send failed");
  }
}

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
  duration: number;
}

interface RunLog {
  id: string;
  startedAt: string;
  finishedAt: string;
  checks: CheckResult[];
  passed: number;
  failed: number;
  warnings: number;
  reportSent: boolean;
}

const runHistory: RunLog[] = [];
const MAX_HISTORY = 100;

async function runCheck(name: string, fn: () => Promise<{ status: "ok" | "warn" | "error"; message: string }>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return { name, ...result, duration: Date.now() - start };
  } catch (err) {
    return { name, status: "error", message: `Exception: ${err instanceof Error ? err.message : String(err)}`, duration: Date.now() - start };
  }
}

async function runAllChecks(): Promise<RunLog> {
  const startedAt = new Date().toISOString();
  const id = `run-${Date.now()}`;

  const checks: CheckResult[] = await Promise.all([
    runCheck("DB Connectivity", async () => {
      await db.execute(sql`SELECT 1`);
      return { status: "ok", message: "PostgreSQL — חיבור תקין" };
    }),

    runCheck("Clients Table", async () => {
      const rows = await db.select().from(clientsTable).limit(1);
      const count = rows.length;
      return { status: "ok", message: `Clients table — נגישה (${count} רשומות בדוגמה)` };
    }),

    runCheck("Agents Table", async () => {
      const agents = await db.select().from(agentsTable);
      const badNames = agents.filter(a => !a.name || a.name.trim().length === 0);
      if (badNames.length > 0) {
        return { status: "warn", message: `${badNames.length} סוכנים ללא שם` };
      }
      return { status: "ok", message: `${agents.length} סוכנים — שמות תקינים` };
    }),

    runCheck("n8n Webhook Health", async () => {
      const n8nUrl = process.env.N8N_BASE_URL;
      if (!n8nUrl) return { status: "warn", message: "N8N_BASE_URL לא מוגדר — לא ניתן לבדוק" };
      try {
        const resp = await fetch(`${n8nUrl}/healthz`, { signal: AbortSignal.timeout(5000) });
        if (resp.ok) return { status: "ok", message: `n8n זמין (${resp.status})` };
        return { status: "warn", message: `n8n ענה ${resp.status}` };
      } catch {
        return { status: "error", message: "n8n לא מגיב — בדוק חיבור" };
      }
    }),

    runCheck("Telegram Bot", async () => {
      const token = getBotToken();
      if (!token) return { status: "warn", message: "TELEGRAM_BOT_TOKEN לא מוגדר" };
      const resp = await fetch(`${TELEGRAM_API}${token}/getMe`, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json() as { ok: boolean; result?: { username?: string } };
      if (data.ok) return { status: "ok", message: `Bot פעיל: @${data.result?.username}` };
      return { status: "error", message: "Bot לא מגיב" };
    }),

    runCheck("System Version", async () => {
      return { status: "ok", message: "AgentHub v2.0 — יוני 2026" };
    }),
  ]);

  const passed = checks.filter(c => c.status === "ok").length;
  const warnings = checks.filter(c => c.status === "warn").length;
  const failed = checks.filter(c => c.status === "error").length;
  const finishedAt = new Date().toISOString();

  const log: RunLog = {
    id,
    startedAt,
    finishedAt,
    checks,
    passed,
    failed,
    warnings,
    reportSent: false,
  };

  runHistory.unshift(log);
  if (runHistory.length > MAX_HISTORY) runHistory.pop();

  return log;
}

async function sendTelegramReport(log: RunLog): Promise<void> {
  const chatId = getAdminChatId();
  if (!chatId) return;

  const statusEmoji = log.failed > 0 ? "🔴" : log.warnings > 0 ? "🟡" : "🟢";
  const time = new Date(log.startedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const lines = [
    `${statusEmoji} <b>AgentHub — דוח תחזוקה יומי</b>`,
    `🕐 ${time} | ✅ ${log.passed} | ⚠️ ${log.warnings} | ❌ ${log.failed}`,
    ``,
    ...log.checks.map(c => {
      const e = c.status === "ok" ? "✅" : c.status === "warn" ? "⚠️" : "❌";
      return `${e} <b>${c.name}</b>\n   ${c.message} (${c.duration}ms)`;
    }),
  ];

  if (log.failed > 0) {
    lines.push(`\n🚨 <b>נדרשת התערבות</b> — ${log.failed} בדיקות נכשלו`);
  } else if (log.warnings > 0) {
    lines.push(`\n⚠️ המערכת פועלת עם ${log.warnings} אזהרות`);
  } else {
    lines.push(`\n✨ המערכת תקינה לחלוטין`);
  }

  await sendTelegramMessage(chatId, lines.join("\n"));
  log.reportSent = true;
}

router.post("/maintenance/run", async (req, res) => {
  try {
    const log = await runAllChecks();
    const sendReport = req.body?.sendReport !== false;
    if (sendReport) {
      await sendTelegramReport(log);
    }
    res.json({ ok: true, run: log });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/maintenance/logs", (_req, res) => {
  res.json({ ok: true, logs: runHistory });
});

router.get("/maintenance/status", (_req, res) => {
  const lastRun = runHistory[0] ?? null;

  const now = new Date();
  const next = new Date();
  next.setHours(5, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const msUntilNext = next.getTime() - now.getTime();

  res.json({
    ok: true,
    lastRun,
    nextRunAt: next.toISOString(),
    msUntilNext,
  });
});

export function startMaintenanceScheduler(): void {
  function scheduleNext() {
    const now = new Date();
    const next = new Date();
    next.setHours(5, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const ms = next.getTime() - now.getTime();

    console.log(`[maintenance] Next run scheduled in ${Math.round(ms / 60000)} minutes (${next.toISOString()})`);

    setTimeout(async () => {
      console.log("[maintenance] Running daily checks...");
      try {
        const log = await runAllChecks();
        await sendTelegramReport(log);
        console.log(`[maintenance] Done. Passed: ${log.passed}, Warnings: ${log.warnings}, Failed: ${log.failed}`);
      } catch (err) {
        console.error("[maintenance] Daily run failed:", err);
      }
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}

export default router;
