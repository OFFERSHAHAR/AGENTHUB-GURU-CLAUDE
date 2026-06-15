import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, clientsTable, tokenUsageTable, settingsTable, agentsTable, assignmentsTable } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { runAnalysis, extractClientInfo } from "../services/analysis.js";
import { approveAndApply, cancelApproval } from "../services/optima-sync.js";
import { answerCallbackQuery } from "../lib/telegram-api.js";
import { readSheet, compareWithDb, buildCompareReport, buildDailyReport, buildOccupancyFacts, parseDateFromQuery, parseReportIntent, parseRoomFilter } from "../services/sheets-reader.js";
import { palgatePermitsTable } from "@workspace/db";
import { runModelWithHistory } from "../services/model-router.js";
import { maybeAnswerFromJournal } from "../services/journal-qa.js";

const router: IRouter = Router();

/** Strip internal JSON/marker block — return only the human-readable Hebrew text */
function stripHumanSpec(text: string): string {
  if (!text) return text;
  const si = text.indexOf("<<<SPEC_OUTPUT_START>>>");
  if (si !== -1) return text.slice(0, si).trim();
  const ei = text.indexOf("<<<SPEC_OUTPUT_END>>>");
  if (ei !== -1) {
    const before = text.slice(0, ei);
    const lj = before.lastIndexOf("\n{");
    return (lj !== -1 ? before.slice(0, lj) : before).trim();
  }
  return text.trim();
}

const TELEGRAM_API = "https://api.telegram.org/bot";

// ─── In-memory sessions ────────────────────────────────────────────────────────
// specSessions: active /איפיון spec-agent conversations
const specSessions = new Map<string, Array<{ role: string; content: string }>>();
// chatSessions: general free-text chat history (non-spec)
const chatSessions = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();
const CHAT_MAX_TURNS = 20; // keep last N turns per chat to avoid unbounded growth
// clientContextSessions: active client for /לקוח context
const clientContextSessions = new Map<string, { id: number; name: string }>();
const WEBHOOK_SECRET_KEY = "telegram_webhook_secret";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

// Resolve the secret Telegram echoes back in the
// `x-telegram-bot-api-secret-token` header. Prefers an explicit env override,
// otherwise the value persisted in the settings table during webhook setup.
// Returns null when no secret has been provisioned yet.
async function getWebhookSecret(): Promise<string | null> {
  const envSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (envSecret) return envSecret;
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, WEBHOOK_SECRET_KEY))
    .limit(1);
  return row?.value ?? null;
}

// Persist a webhook secret. Only called once Telegram has accepted it via
// setWebhook, so a failed setup never leaves a dangling secret that would
// reject (401) every subsequent legitimate update.
async function persistWebhookSecret(secret: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key: WEBHOOK_SECRET_KEY, value: secret })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: secret, updatedAt: new Date() },
    });
}

// Never hit the real Telegram API under the test runner — the bot token/chat id
// are shared across every work environment, so tests would spam the live chat.
function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test";
}

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: object): Promise<void> {
  if (isTestEnv()) return;
  const token = getBotToken();
  if (!token) return;
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[telegram] sendMessage failed:", err);
  }
}

/**
 * Split text into chunks ≤ maxLen chars, breaking on paragraph boundaries (\n\n)
 * or sentence boundaries (. \n) so messages never cut mid-sentence.
 */
function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    // Try to break on a double-newline (paragraph) first
    let cutAt = remaining.lastIndexOf("\n\n", maxLen);
    if (cutAt < maxLen * 0.5) cutAt = remaining.lastIndexOf("\n", maxLen);
    if (cutAt < maxLen * 0.5) cutAt = remaining.lastIndexOf(". ", maxLen);
    if (cutAt < 0 || cutAt < maxLen * 0.3) cutAt = maxLen;
    chunks.push(remaining.slice(0, cutAt).trimEnd());
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/** Send a potentially long message, splitting into multiple Telegram messages if needed. */
async function sendLongMessage(chatId: string | number, text: string, replyMarkup?: object): Promise<void> {
  const parts = splitMessage(text);
  for (let i = 0; i < parts.length; i++) {
    // Only attach replyMarkup to the LAST part
    await sendTelegramMessage(chatId, parts[i], i === parts.length - 1 ? replyMarkup : undefined);
  }
}

// Reply-keyboard shown right after /איפיון — lets the user pick a domain or write freely.
const SPEC_KEYBOARD = {
  keyboard: [
    [{ text: "🏨 מלון / השכרה קצרת מועד" }, { text: "🏢 ניהול נכסים / ועד בית" }],
    [{ text: "🍽️ מסעדה / קייטרינג"       }, { text: "📦 לוגיסטיקה / שילוח"       }],
    [{ text: "🏥 קליניקה / רפואה"          }, { text: "📚 חינוך / הדרכות"           }],
    [{ text: "🛒 מסחר / e-commerce"        }, { text: "🏗️ קבלן / בנייה"            }],
    [{ text: "✍️ אני אכתוב בחופשיות"                                               }],
  ],
  resize_keyboard: true,
  one_time_keyboard: true,
  input_field_placeholder: "בחר תחום או כתוב בחופשיות",
};
const REMOVE_KEYBOARD = { remove_keyboard: true };

async function sendWebAppMessage(chatId: string | number, text: string, webAppUrl: string, buttonText = "🧔 פתח גבר"): Promise<void> {
  if (isTestEnv()) return;
  const token = getBotToken();
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: buttonText, web_app: { url: webAppUrl } }
          ]]
        }
      }),
    });
  } catch (err) {
    console.error("[telegram] sendWebAppMessage failed:", err);
  }
}

async function getAppBaseUrl(): Promise<string | null> {
  const token = getBotToken();
  if (!token) return null;
  try {
    const r = await fetch(`${TELEGRAM_API}${token}/getWebhookInfo`);
    const info = await r.json() as { result?: { url?: string } };
    const webhookUrl = info.result?.url;
    if (!webhookUrl) return null;
    // Strip /api/telegram/webhook to get the base URL
    return webhookUrl.replace(/\/api\/telegram\/webhook$/, "");
  } catch {
    return null;
  }
}

// POST /telegram/webhook — receives updates from Telegram
router.post("/telegram/webhook", async (req, res): Promise<void> => {
  try {
    // Telegram echoes the configured secret back in this header. Verify it so
    // we can prove an update genuinely came from Telegram. A mismatch against a
    // provisioned secret is rejected outright; the absence of a secret leaves
    // `verified` false, which fails the security-sensitive write path closed.
    const expectedSecret = await getWebhookSecret();
    const providedSecret = req.get("x-telegram-bot-api-secret-token");
    const verified = !!expectedSecret && providedSecret === expectedSecret;
    if (expectedSecret && !verified) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const update = req.body;

    // Inline-button presses (Optima sync Approve/Cancel) arrive as callback_query.
    const callback = update?.callback_query;
    if (callback?.data) {
      const data = String(callback.data);
      const fromName = [callback.from?.first_name, callback.from?.last_name]
        .filter(Boolean).join(" ") || callback.from?.username || "משתמש טלגרם";

      const approveMatch = data.match(/^optima_approve:(\d+)$/);
      const cancelMatch = data.match(/^optima_cancel:(\d+)$/);

      // Approve/cancel are write actions that decide an Optima change. Refuse to
      // act on them unless the request is cryptographically verified — fail
      // closed when no secret is provisioned rather than trusting the payload.
      if ((approveMatch || cancelMatch) && !verified) {
        await answerCallbackQuery(
          callback.id,
          "⚠️ האימות נכשל — הגדר מחדש את ה-webhook ב-AgentHub",
        );
        res.status(403).json({ ok: false, error: "verification_required" });
        return;
      }

      if (approveMatch) {
        const r = await approveAndApply(Number(approveMatch[1]), fromName);
        await answerCallbackQuery(callback.id, r.ok ? "✅ אושר ובוצע" : `כבר טופל (${r.reason})`);
      } else if (cancelMatch) {
        const r = await cancelApproval(Number(cancelMatch[1]), fromName);
        await answerCallbackQuery(callback.id, r.ok ? "✋ בוטל" : `כבר טופל (${r.reason})`);
      } else {
        await answerCallbackQuery(callback.id);
      }
      res.json({ ok: true });
      return;
    }

    const message = update?.message;

    if (!message?.text || !message?.chat?.id) {
      res.json({ ok: true });
      return;
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const messageId = String(message.message_id);

    // /start
    if (text.startsWith("/start")) {
      await sendTelegramMessage(chatId,
        "👋 <b>AgentHub Bot</b>\n\n" +
        "שאל אותי כל שאלה — על תפוסה, לקוחות, סוכנים, טריגרים.\n\n" +
        "📋 /דוח — דוח תפוסה יומי\n" +
        "🔍 /בדוק — השוואת גיליון מול מאגר\n" +
        "🤖 /איפיון — יצירת לקוח חדש (אשף שאלות)\n" +
        "💡 /gever — מרכז הפיקוד\n" +
        "🗑️ /נקה — אפס היסטוריית שיחה"
      );
      res.json({ ok: true });
      return;
    }

    // /jarvis — open Jarvis mini app (remote command bridge)
    if (text.toLowerCase().startsWith("/jarvis")) {
      const baseUrl = await getAppBaseUrl();
      if (!baseUrl) {
        await sendTelegramMessage(chatId,
          "⚠️ לא הוגדר webhook URL. הגדר את ה-webhook דרך AgentHub ואז נסה שוב."
        );
        res.json({ ok: true });
        return;
      }
      const miniAppUrl = `${baseUrl}/jarvis`;
      await sendWebAppMessage(
        chatId,
        "🤖 <b>JARVIS v3.0 — Stark Industries AI</b>\n\nדבר איתי כאן וג׳ארביס יפעיל את הממשק על המחשב מרחוק:",
        miniAppUrl,
        "🤖 פתח את ג׳ארביס"
      );
      res.json({ ok: true });
      return;
    }

    // /gever — open mini app
    if (text.toLowerCase().startsWith("/gever")) {
      const baseUrl = await getAppBaseUrl();
      if (!baseUrl) {
        await sendTelegramMessage(chatId,
          "⚠️ לא הוגדר webhook URL. הגדר את ה-webhook דרך AgentHub ואז נסה שוב."
        );
        res.json({ ok: true });
        return;
      }
      const miniAppUrl = `${baseUrl}/gever`;
      await sendWebAppMessage(
        chatId,
        "🧔 <b>גבר — מרכז הפיקוד</b>\n\nלחץ על הכפתור כדי לפתוח את ממשק הניהול:",
        miniAppUrl
      );
      res.json({ ok: true });
      return;
    }

    // /בדוק — fresh sheet read + DB comparison → flat guest/check-in list
    if (text.startsWith("/בדוק") || text.toLowerCase().startsWith("/check")) {
      await sendTelegramMessage(chatId, "⏳ קורא גיליון ומשווה מול מאגר...");
      try {
        const rows = await db
          .select({
            agentId: agentsTable.id,
            inputSchema: agentsTable.inputSchema,
            clientId: assignmentsTable.clientId,
            clientName: clientsTable.name,
          })
          .from(agentsTable)
          .innerJoin(assignmentsTable, eq(assignmentsTable.agentId, agentsTable.id))
          .innerJoin(clientsTable, eq(clientsTable.id, assignmentsTable.clientId))
          .where(like(agentsTable.tags, "%journal-qa%"));

        const row = rows.find((r) => r.inputSchema?.includes("docs.google.com/spreadsheets"));

        if (!row?.inputSchema) {
          await sendTelegramMessage(chatId, "⚠️ לא נמצא גיליון מוגדר — הגדר URL בשדה inputSchema של הסוכן.");
          res.json({ ok: true });
          return;
        }

        const [sheetData, dbPermits] = await Promise.all([
          readSheet(row.inputSchema, "Turnovers"),
          row.clientId
            ? db.select().from(palgatePermitsTable).where(eq(palgatePermitsTable.clientId, row.clientId))
            : Promise.resolve([]),
        ]);

        const cmp = compareWithDb(sheetData, dbPermits);
        const report = buildCompareReport(cmp, sheetData, row.clientName ?? "לקוח");
        await sendTelegramMessage(chatId, report);
      } catch (err) {
        console.error("[telegram /בדוק] error:", err instanceof Error ? err.message : err);
        await sendTelegramMessage(chatId, "❌ שגיאה בקריאת הגיליון. בדוק שהגיליון משותף עם חשבון השירות.");
      }
      res.json({ ok: true });
      return;
    }

    // /דוח or /daily — daily occupancy report from the "Turnovers" sheet tab
    // Supports free-text queries: "/דוח מה נכנס ב23.6.26", "/דוח 30.6", "/דוח יוצאים 1.7"
    if (text.startsWith("/דוח") || text.toLowerCase().startsWith("/daily")) {
      await sendTelegramMessage(chatId, "⏳ רגע, קורא את הגיליון...");

      try {
        // Parse optional date + intent + room filter from the free text after the command
        const query      = text.replace(/^\/(דוח|daily)\s*/i, "").trim();
        const targetDate = query ? parseDateFromQuery(query) ?? undefined : undefined;
        const intent     = query ? parseReportIntent(query) : "full";
        const roomFilter = query ? parseRoomFilter(query) ?? undefined : undefined;

        // Find agent tagged "journal-qa" with a Sheet URL, via assignments → client
        const rows = await db
          .select({
            agentId: agentsTable.id,
            inputSchema: agentsTable.inputSchema,
            clientId: assignmentsTable.clientId,
            clientName: clientsTable.name,
          })
          .from(agentsTable)
          .innerJoin(assignmentsTable, eq(assignmentsTable.agentId, agentsTable.id))
          .innerJoin(clientsTable, eq(clientsTable.id, assignmentsTable.clientId))
          .where(like(agentsTable.tags, "%journal-qa%"));

        const row = rows.find(
          (r) => r.inputSchema?.includes("docs.google.com/spreadsheets"),
        );

        if (!row?.inputSchema) {
          await sendTelegramMessage(chatId, "⚠️ לא נמצא גיליון מוגדר — הגדר URL בשדה inputSchema של הסוכן.");
          res.json({ ok: true });
          return;
        }

        const sheetData = await readSheet(row.inputSchema, "Turnovers");
        const report = buildDailyReport(sheetData, row.clientName ?? "לקוח", targetDate, intent, roomFilter);
        await sendTelegramMessage(chatId, report);
      } catch (err) {
        console.error("[telegram /דוח] error:", err instanceof Error ? err.message : err);
        await sendTelegramMessage(chatId, "❌ שגיאה בקריאת הגיליון. בדוק שהגיליון משותף עם חשבון השירות.");
      }

      res.json({ ok: true });
      return;
    }

    // /איפיון or /spec — start a new spec-agent session with quick-reply keyboard
    if (text.startsWith("/איפיון") || text.toLowerCase().startsWith("/spec")) {
      specSessions.set(chatId, []);
      await sendTelegramMessage(chatId,
        "🤖 <b>סוכן האיפיון — AgentHub</b>\n\n" +
        "בחר את התחום שלך מהכפתורים, או תאר את הצורך בחופשיות.\n" +
        "אשאל מספר שאלות קצרות ואבנה לך פרופיל מלא שיחכה בממשק.\n\n" +
        "שלח /בטל בכל עת לביטול.",
        SPEC_KEYBOARD
      );
      res.json({ ok: true });
      return;
    }

    // /בטל — cancel active spec session
    if (text === "/בטל" || text.toLowerCase() === "/cancel") {
      if (specSessions.has(chatId)) {
        specSessions.delete(chatId);
        await sendTelegramMessage(chatId, "✋ שיחת האיפיון בוטלה.");
      } else {
        await sendTelegramMessage(chatId, "אין שיחה פעילה לביטול.");
      }
      res.json({ ok: true });
      return;
    }

    // /נקה — clear free-text chat history for this chat
    if (text === "/נקה" || text.toLowerCase() === "/clear") {
      chatSessions.delete(chatId);
      clientContextSessions.delete(chatId);
      await sendTelegramMessage(chatId, "🗑️ היסטוריית השיחה נמחקה.");
      res.json({ ok: true });
      return;
    }

    // /לקוחות — list all clients
    if (text === "/לקוחות" || text.toLowerCase() === "/clients") {
      const allClients = await db
        .select({ id: clientsTable.id, name: clientsTable.name, status: clientsTable.status })
        .from(clientsTable)
        .orderBy(clientsTable.name);
      if (allClients.length === 0) {
        await sendTelegramMessage(chatId, "אין לקוחות במערכת עדיין.");
      } else {
        const lines = allClients.map((c) => `• <b>${c.name}</b> (ID ${c.id}) — ${c.status}`);
        await sendTelegramMessage(
          chatId,
          `📋 <b>לקוחות במערכת:</b>\n\n${lines.join("\n")}\n\n` +
          `שלח <code>/לקוח [שם]</code> כדי להתחיל שיחה על לקוח ספציפי.`,
        );
      }
      res.json({ ok: true });
      return;
    }

    // /לקוח [שם] — set active client context for this chat session
    if (text.startsWith("/לקוח") || text.toLowerCase().startsWith("/client")) {
      const nameQuery = text.replace(/^\/לקוח\s*/i, "").replace(/^\/client\s*/i, "").trim();

      if (!nameQuery) {
        const active = clientContextSessions.get(chatId);
        if (active) {
          await sendTelegramMessage(
            chatId,
            `👤 <b>לקוח פעיל כרגע:</b> ${active.name} (ID ${active.id})\n\n` +
            `שלח <code>/לקוח [שם]</code> כדי להחליף, או <code>/נקה</code> לאיפוס.`,
          );
        } else {
          await sendTelegramMessage(
            chatId,
            `לא נבחר לקוח פעיל.\nשלח <code>/לקוח [שם]</code> כדי לבחור לקוח.\nרשימה מלאה: <code>/לקוחות</code>`,
          );
        }
        res.json({ ok: true });
        return;
      }

      // Search by name (partial, case-insensitive via ilike)
      const matches = await db
        .select({ id: clientsTable.id, name: clientsTable.name, industry: clientsTable.industry, status: clientsTable.status, notes: clientsTable.notes })
        .from(clientsTable)
        .where(like(clientsTable.name, `%${nameQuery}%`))
        .limit(5);

      if (matches.length === 0) {
        await sendTelegramMessage(
          chatId,
          `❌ לא נמצא לקוח עם השם "<b>${nameQuery}</b>".\n` +
          `רשימה מלאה: <code>/לקוחות</code>`,
        );
      } else if (matches.length === 1) {
        const c = matches[0];
        clientContextSessions.set(chatId, { id: c.id, name: c.name });
        chatSessions.delete(chatId); // reset chat history for new context
        const agentsForClient = await db
          .select({ name: agentsTable.name, tags: agentsTable.tags })
          .from(assignmentsTable)
          .innerJoin(agentsTable, eq(agentsTable.id, assignmentsTable.agentId))
          .where(eq(assignmentsTable.clientId, c.id));
        const agentList = agentsForClient.length > 0
          ? agentsForClient.map((a) => `  • ${a.name}`).join("\n")
          : "  אין סוכנים משוייכים";
        await sendTelegramMessage(
          chatId,
          `✅ <b>לקוח פעיל: ${c.name}</b>\n\n` +
          `🏭 תעשייה: ${c.industry || "לא צוין"} | סטטוס: ${c.status}\n` +
          (c.notes ? `📝 ${c.notes}\n` : "") +
          `\n🤖 <b>סוכנים:</b>\n${agentList}\n\n` +
          `כעת תוכל לשאול שאלות על לקוח זה — תפוסה, סוכנים, סטטוס ועוד.`,
        );
      } else {
        // Multiple matches — ask user to be more specific
        const lines = matches.map((c) => `• <b>${c.name}</b> — שלח <code>/לקוח ${c.name}</code>`);
        await sendTelegramMessage(
          chatId,
          `נמצאו ${matches.length} לקוחות תואמים:\n\n${lines.join("\n")}\n\nבחר את הלקוח המדויק.`,
        );
      }
      res.json({ ok: true });
      return;
    }

    // Active spec session — route through spec-agent
    if (specSessions.has(chatId)) {
      const history = specSessions.get(chatId)!;
      const isFirstMessage = history.length === 0;

      // "Free text" button — just prompt and wait; don't send to spec-agent yet
      if (text === "✍️ אני אכתוב בחופשיות") {
        await sendTelegramMessage(
          chatId,
          "בבקשה תאר את הבעיה העסקית או הצורך באוטומציה:",
          REMOVE_KEYBOARD
        );
        res.json({ ok: true });
        return;
      }

      history.push({ role: "user", content: text });

      let reply = "";
      try {
        const port = process.env.PORT ?? 8080;
        const r = await fetch(`http://localhost:${port}/api/spec-agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        const data = await r.json() as { reply?: string; error?: string };
        reply = data.reply ?? "שגיאה פנימית בסוכן האיפיון.";
      } catch (err) {
        console.error("[telegram/spec] call failed:", err);
        reply = "⚠️ שגיאה בהתחברות לסוכן האיפיון. נסה שוב.";
      }

      history.push({ role: "assistant", content: reply });

      // Check if spec output is ready — detect either START or END marker
      // (LLMs sometimes skip the START marker but consistently emit END)
      const hasSpec = reply.includes("<<<SPEC_OUTPUT_START>>>") || reply.includes("<<<SPEC_OUTPUT_END>>>");
      if (hasSpec) {
        // Extract the JSON block — works with or without START marker
        const specMatch =
          reply.match(/<<<SPEC_OUTPUT_START>>>([\s\S]*?)<<<SPEC_OUTPUT_END>>>/) ??
          reply.match(/\n(\{[\s\S]*?\})\s*<<<SPEC_OUTPUT_END>>>/);
        const specJson = specMatch ? specMatch[1].trim() : null;

        // Save to clients table as a spec draft
        try {
          let parsed: { recommendedAgentId?: number; reasoning?: string; clientName?: string; n8nWorkflow?: { name?: string } } = {};
          if (specJson) { try { parsed = JSON.parse(specJson); } catch {} }

          const draftName =
            parsed.clientName ||
            parsed.n8nWorkflow?.name ||
            `טיוטת לקוח — ${new Date().toLocaleDateString("he-IL")}`;

          // Build a unique placeholder email so the NOT NULL constraint is satisfied
          const placeholderEmail = `telegram-${chatId}-${Date.now()}@agenthub.draft`;

          // Upsert by telegramChatId — avoid duplicate drafts per chat
          const [existingDraft] = await db
            .select({ id: clientsTable.id })
            .from(clientsTable)
            .where(eq(clientsTable.telegramChatId, chatId))
            .limit(1);

          if (existingDraft) {
            await db.update(clientsTable).set({
              name: draftName,
              rawSpec: specJson ?? stripHumanSpec(reply),
              analysisStatus: "spec_draft",
              notes: parsed.reasoning
                ? `המלצת סוכן: ID ${parsed.recommendedAgentId ?? "?"} — ${parsed.reasoning.slice(0, 200)}`
                : "נוצר מסוכן האיפיון בטלגרם",
            }).where(eq(clientsTable.id, existingDraft.id));
          } else {
            await db.insert(clientsTable).values({
              name: draftName,
              industry: "pending",
              contactEmail: placeholderEmail,
              status: "trial",
              source: "telegram-spec",
              tier: "free",
              rawSpec: specJson ?? stripHumanSpec(reply),
              analysisStatus: "spec_draft",
              telegramChatId: chatId,
              notes: parsed.reasoning
                ? `המלצת סוכן: ID ${parsed.recommendedAgentId ?? "?"} — ${parsed.reasoning.slice(0, 200)}`
                : "נוצר מסוכן האיפיון בטלגרם",
            });
          }
        } catch (err) {
          console.error("[telegram/spec] save draft failed:", err);
        }

        // Clear session
        specSessions.delete(chatId);

        // Send the full spec document — strip the internal JSON block before sending
        const cleanReply = reply
          .replace(/<<<SPEC_OUTPUT_START>>>[\s\S]*?<<<SPEC_OUTPUT_END>>>/, "")
          .replace(/\n\{[\s\S]*?\}\s*<<<SPEC_OUTPUT_END>>>/, "")
          .trim();
        const finalText =
          (cleanReply ? cleanReply + "\n\n" : "") +
          "✅ <b>האיפיון נשמר ב-AgentHub!</b>\n" +
          "תוכל לראות את הטיוטה בעמוד הלקוחות.";
        await sendLongMessage(chatId, finalText, REMOVE_KEYBOARD);
      } else {
        // On the first real reply — dismiss the domain keyboard; long question-set is ok to split
        await sendLongMessage(chatId, reply, isFirstMessage ? REMOVE_KEYBOARD : undefined);
      }

      res.json({ ok: true });
      return;
    }

    // ── Default: free-text chat (Q&A assistant) ───────────────────────────────
    // Free text no longer creates a client. Use /איפיון to start a spec session.
    // The assistant tries journal Q&A first (data questions), then falls back to
    // a general model response with conversation history for multi-turn chat.

    // Resolve active client context: prefer explicit /לקוח selection, then first journal-qa client
    const activeClientCtx = clientContextSessions.get(chatId) ?? null;

    // 1. Try journal Q&A — use active client or find first journal-qa–tagged assignment
    let journalContext = "";
    let deterministicAnswer: string | null = null;
    let resolvedClientId: number | null = activeClientCtx?.id ?? null;
    try {
      if (!resolvedClientId) {
        const jqRows = await db
          .select({ clientId: assignmentsTable.clientId })
          .from(agentsTable)
          .innerJoin(assignmentsTable, eq(assignmentsTable.agentId, agentsTable.id))
          .where(like(agentsTable.tags, "%journal-qa%"))
          .limit(1);
        if (jqRows.length > 0) resolvedClientId = jqRows[0].clientId;
      }
      if (resolvedClientId) {
        const jr = await maybeAnswerFromJournal(resolvedClientId, text);
        if (jr) {
          journalContext = jr.contextBlock;
          deterministicAnswer = jr.deterministicAnswer;
        }
      }
    } catch (e) {
      console.error("[telegram/chat journal]", e instanceof Error ? e.message : e);
    }

    // 1b. Occupancy facts from the live sheet — for free-text questions about
    // how many rooms are occupied/vacant/arriving/departing/swapping. Same source
    // of truth as /דוח, so the chat answers match the report.
    const OCCUPANCY_RE = /מאוכלס|תפוס|תפוסה|ריק|פנוי|מתפנה|מתחלף|החלפ|כמה\s*חדר|כמה.*חדר|נכנס|יוצא|כניס|יציא|מי\s*(שוהה|נמצא|יש)|דייר|אורח|מצב/;
    if (OCCUPANCY_RE.test(text)) {
      try {
        const sheetRows = await db
          .select({ inputSchema: agentsTable.inputSchema, clientName: clientsTable.name })
          .from(agentsTable)
          .innerJoin(assignmentsTable, eq(assignmentsTable.agentId, agentsTable.id))
          .innerJoin(clientsTable, eq(clientsTable.id, assignmentsTable.clientId))
          .where(like(agentsTable.tags, "%journal-qa%"));
        const sheetRow = sheetRows.find(r => r.inputSchema?.includes("docs.google.com/spreadsheets"));
        if (sheetRow?.inputSchema) {
          const sheetData = await readSheet(sheetRow.inputSchema, "Turnovers");
          const targetDate = parseDateFromQuery(text) ?? undefined;
          const facts = buildOccupancyFacts(sheetData, sheetRow.clientName ?? "לקוח", targetDate);
          // Sheet facts are authoritative — prepend them over any DB journal context.
          journalContext = facts + (journalContext ? `\n\n${journalContext}` : "");
        }
      } catch (e) {
        console.error("[telegram/chat occupancy]", e instanceof Error ? e.message : e);
      }
    }

    // 2. Build / maintain chat history
    if (!chatSessions.has(chatId)) chatSessions.set(chatId, []);
    const history = chatSessions.get(chatId)!;
    history.push({ role: "user", content: text });
    if (history.length > CHAT_MAX_TURNS * 2) history.splice(0, 2); // drop oldest pair

    // 3. Build system prompt — include active client context when set
    const clientCtxLine = activeClientCtx
      ? `\n\nלקוח פעיל בשיחה זו: <b>${activeClientCtx.name}</b> (ID ${activeClientCtx.id}).` +
        ` ענה על שאלות בהקשר הלקוח הזה.`
      : "";
    const sysPrompt =
      "אתה 'האבי בן האב' — העוזר האישי של אור ועופר, מנהלי AgentHub.\n" +
      "AgentHub היא מערכת ניהול סוכני AI לעסקים. דבר בעברית, בחום, בקצרה וברור.\n" +
      "תפקידך: לענות על כל שאלה בנוגע להאב — משתמשים, סוכנים, לקוחות ונתוני לקוחות " +
      "(למשל בית ויליאמס), תפוסה, טריגרים, זמינות, סטטוסים והתראות.\n" +
      "אל תמציא נתונים — אם אין לך מידע, אמור בכנות שאין לך גישה אליו כרגע." +
      clientCtxLine +
      (journalContext ? `\n\n${journalContext}` : "");

    let reply = deterministicAnswer ?? "";
    try {
      // history already has the user message appended; pass full history to model
      const r = await runModelWithHistory(
        process.env.GROQ_API_KEY ? "fallback" : "free",
        sysPrompt,
        history,
      );
      if (r.content && r.content !== "__TEMPLATE__") {
        reply = r.content;
      } else if (r.content === "__TEMPLATE__") {
        reply = "🤖 מצטער, השירות זמנית לא זמין. אנא נסה שוב.";
      }
    } catch (e) {
      console.error("[telegram/chat model]", e instanceof Error ? e.message : e);
      if (!reply) reply = "⚠️ שגיאה זמנית בעיבוד. נסה שוב בעוד רגע.";
    }

    history.push({ role: "assistant", content: reply });
    await sendLongMessage(chatId, reply);
    res.json({ ok: true });

  } catch (err) {
    console.error("[telegram] webhook error:", err);
    res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// POST /telegram/setup — register webhook with Telegram
router.post("/telegram/setup", async (req, res): Promise<void> => {
  const token = getBotToken();
  if (!token) {
    res.status(400).json({ ok: false, description: "TELEGRAM_BOT_TOKEN not configured. Add it to your Replit secrets." });
    return;
  }

  const { webhookUrl } = req.body;
  if (!webhookUrl) {
    res.status(400).json({ ok: false, description: "webhookUrl is required" });
    return;
  }

  try {
    const url = webhookUrl.endsWith("/api/telegram/webhook")
      ? webhookUrl
      : `${webhookUrl.replace(/\/$/, "")}/api/telegram/webhook`;

    // Register a secret token so we can verify inbound updates. Telegram returns
    // it on every request via the x-telegram-bot-api-secret-token header. Reuse
    // an existing secret if one is provisioned, otherwise mint a candidate that
    // is only persisted once Telegram accepts it (two-phase — see below).
    const existingSecret = await getWebhookSecret();
    const secretToken = existingSecret ?? randomUUID().replace(/-/g, "");

    const response = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret_token: secretToken }),
    });

    const result = await response.json() as { ok: boolean; description?: string };

    // Persist a freshly minted secret only after Telegram confirms the webhook.
    // A failed setWebhook therefore leaves verification state untouched.
    if (result.ok && !existingSecret) {
      await persistWebhookSecret(secretToken);
    }

    res.json({ ok: result.ok, description: result.description || "Webhook set successfully" });
  } catch (err) {
    res.status(500).json({ ok: false, description: String(err) });
  }
});

// POST /telegram/push-gabar — push Gabar mini app link to admin chat
router.post("/telegram/push-gabar", async (req, res): Promise<void> => {
  const token = getBotToken();
  if (!token) { res.json({ ok: false, reason: "no_token" }); return; }

  // Admin chat ID: from request body, env var, or fallback
  const adminChatId: string | undefined =
    req.body?.chatId ||
    process.env.ADMIN_TELEGRAM_CHAT_ID ||
    undefined;

  if (!adminChatId) { res.json({ ok: false, reason: "no_chat_id" }); return; }

  const baseUrl = await getAppBaseUrl();
  const reason: string = req.body?.reason ?? "screen_layout";

  const reasonLabel =
    reason === "narrow_screen"
      ? "המסך הראשי צר מדי לשני ממשקים — ג׳ארוויס שלח את גבר אליך כאן"
      : reason === "multi_screen"
      ? "זוהה רב-מסך — גבר נשלח למסך חלופי"
      : "ג׳ארוויס מפעיל ממשק גבר";

  if (baseUrl) {
    const miniAppUrl = `${baseUrl}/gever`;
    await sendWebAppMessage(
      adminChatId,
      `🧔 <b>גבר — מרכז הפיקוד</b>\n\n${reasonLabel}:`,
      miniAppUrl
    );
  } else {
    await sendTelegramMessage(
      adminChatId,
      `🧔 <b>גבר מוכן</b>\n\n${reasonLabel}.\n\nפתח את AgentHub לגישה מלאה.`
    );
  }
  res.json({ ok: true });
});

// GET /telegram/status — check bot status and pending clients
router.get("/telegram/status", async (_req, res): Promise<void> => {
  const token = getBotToken();
  const configured = Boolean(token);

  let webhookUrl: string | null = null;
  if (configured) {
    try {
      const r = await fetch(`${TELEGRAM_API}${token}/getWebhookInfo`);
      const info = await r.json() as { result?: { url?: string } };
      webhookUrl = info.result?.url || null;
    } catch {
      // ignore
    }
  }

  // Count clients pending analysis
  const pending = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(
      eq(clientsTable.source, "telegram"),
      eq(clientsTable.analysisStatus, "ready"),
    ));

  res.json({ configured, webhookUrl, pendingClients: pending.length });
});

export default router;
