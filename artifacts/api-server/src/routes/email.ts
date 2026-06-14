import { Router, type IRouter } from "express";
import { eq, and, like, desc } from "drizzle-orm";
import { db, agentsTable, clientsTable, conversationsTable, assignmentsTable } from "@workspace/db";
import { runModel } from "../services/model-router";
import { sendAutoReplyEmail } from "../services/email-sender";

const router: IRouter = Router();

let _classifierAgentId: number | null = null;
let _characterizationAgentId: number | null = null;

async function findAgentIdByTag(tag: string): Promise<number | null> {
  const [agent] = await db
    .select({ id: agentsTable.id })
    .from(agentsTable)
    .where(like(agentsTable.tags, `%"${tag}"%`))
    .limit(1);
  return agent?.id ?? null;
}

async function getClassifierAgentId(): Promise<number | null> {
  if (_classifierAgentId === null) {
    _classifierAgentId = await findAgentIdByTag("lead-classifier");
  }
  return _classifierAgentId;
}

async function getCharacterizationAgentId(): Promise<number | null> {
  if (_characterizationAgentId === null) {
    _characterizationAgentId = await findAgentIdByTag("lead-characterization");
  }
  return _characterizationAgentId;
}

function getTelegramChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID || null;
}

async function sendTelegramNotification(text: string): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = getTelegramChatId();
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.error("[email-inbound] Telegram notify failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * POST /email/inbound
 * Accepts inbound email (from webhook/Make.com/Zapier/Gmail push).
 * Body: { from, subject, body, fromName? }
 *
 * Flow:
 *  1. Run lead classifier (Groq, auto) → get score + summary
 *  2. Find or create client record for this email
 *  3. Create / open characterization conversation with pre-populated context
 *  4. Send Telegram notification with lead summary
 */
router.post("/email/inbound", async (req, res): Promise<void> => {
  const { from, subject, body, fromName } = req.body as {
    from?: string;
    subject?: string;
    body?: string;
    fromName?: string;
  };

  if (!from || !body) {
    res.status(400).json({ error: "from and body are required" });
    return;
  }

  const senderEmail = from.trim().toLowerCase();
  const senderName = fromName?.trim() || senderEmail.split("@")[0];
  const emailSubject = subject?.trim() || "(ללא נושא)";

  console.log(`[email-inbound] received from=${senderEmail} subject="${emailSubject}"`);

  // ── Step 1: classify lead ────────────────────────────────────────────────
  const classifierAgentId = await getClassifierAgentId();
  const charAgentId = await getCharacterizationAgentId();

  const [classifierAgent] = classifierAgentId
    ? await db.select().from(agentsTable).where(eq(agentsTable.id, classifierAgentId))
    : [];
  let classificationJson: Record<string, unknown> = {};
  let classificationText = "לא ניתן לסווג כרגע";

  if (classifierAgent?.systemPrompt) {
    try {
      const result = await runModel(
        "starter",
        classifierAgent.systemPrompt,
        `From: ${senderName} <${senderEmail}>
Subject: ${emailSubject}

${body}`,
        1024
      );
      if (result.content && result.content !== "__TEMPLATE__") {
        try {
          // strip potential markdown fences
          const cleaned = result.content.replace(/```json|```/g, "").trim();
          classificationJson = JSON.parse(cleaned);
          classificationText = JSON.stringify(classificationJson, null, 2);
        } catch {
          classificationText = result.content;
        }
      }
    } catch (err) {
      console.error("[email-inbound] classification error:", err instanceof Error ? err.message : err);
    }
  }

  const score: number = typeof classificationJson.score === "number" ? classificationJson.score : 0;
  const summary: string = typeof classificationJson.summary === "string" ? classificationJson.summary : classificationText;
  const nextAction: string = typeof classificationJson.nextAction === "string" ? classificationJson.nextAction : "";
  const urgency: string = typeof classificationJson.urgency === "string" ? classificationJson.urgency : "unknown";

  // ── Step 2: find or create client for this email sender ──────────────────
  let [leadClient] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.contactEmail, senderEmail), eq(clientsTable.source, "email-lead")));

  if (!leadClient) {
    [leadClient] = await db
      .insert(clientsTable)
      .values({
        name: senderName,
        industry: typeof classificationJson.industry === "string" ? classificationJson.industry : "לא ידוע",
        contactEmail: senderEmail,
        status: "active",
        tier: "starter",
        source: "email-lead",
        notes: `ליד שנכנס ממייל — נושא: "${emailSubject}"`,
      })
      .returning();
  }

  // ensure assignment exists for characterization agent on this client
  if (charAgentId) {
    const [existingAssign] = await db
      .select()
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.clientId, leadClient.id), eq(assignmentsTable.agentId, charAgentId)));

    if (!existingAssign) {
      await db.insert(assignmentsTable).values({
        clientId: leadClient.id,
        agentId: charAgentId,
        status: "active",
        automationEnabled: true,
      });
    }
  }

  // ── Step 3: create / open characterization conversation ──────────────────
  const [charAgent] = charAgentId
    ? await db.select().from(agentsTable).where(eq(agentsTable.id, charAgentId))
    : [];
  const agentName = charAgent?.name || "סוכן איפיון לקוח חדש";

  const urgencyEmoji: Record<string, string> = { low: "🟢", medium: "🟡", high: "🔴" };
  const urg = urgencyEmoji[urgency] ?? "⚪";

  const scoreBar = score >= 8 ? "⭐⭐⭐" : score >= 5 ? "⭐⭐" : score > 0 ? "⭐" : "";

  const initialAssistantMsg = `📩 **ליד נכנס ממייל** — ${senderName} \`<${senderEmail}>\`
**נושא:** ${emailSubject}

---

🎯 **תוצאות סיווג אוטומטי**
ציון: ${score}/10 ${scoreBar} | דחיפות: ${urg} ${urgency}
${summary}
${nextAction ? `\n💡 **המלצה:** ${nextAction}` : ""}

---

👋 שלום! קיבלתי את הפנייה שלך וממש שמח שפנית.
כדי שנוכל להתאים לך את הפתרון הנכון, אשמח לשאול כמה שאלות קצרות:

1. מה גודל העסק שלך? (מספר עובדים בערך)
2. אילו תהליכים חוזרים הכי כואבים לך כרגע — דברים שאתה עושה ידנית ויכול להיות אוטומטי?
3. האם אתה כבר משתמש בכלים לניהול לקוחות / CRM / אוטומציה כלשהי?

ממתין לתשובתך! 🙏`;

  // find or create conversation
  if (!charAgentId) {
    console.error("[email-inbound] no agent with tag 'lead-characterization' found — cannot create conversation");
    res.status(500).json({ error: "Characterization agent not configured" });
    return;
  }

  let [conv] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.clientId, leadClient.id),
        eq(conversationsTable.agentId, charAgentId)
      )
    );

  if (!conv) {
    const messages = JSON.stringify([
      {
        role: "assistant",
        content: initialAssistantMsg,
        createdAt: new Date().toISOString(),
      },
    ]);
    [conv] = await db
      .insert(conversationsTable)
      .values({
        clientId: leadClient.id,
        agentId: charAgentId,
        title: `איפיון ליד — ${senderName}`,
        messages,
        messageCount: 1,
      })
      .returning();
  } else {
    // append a new lead note to existing conversation
    const existing = JSON.parse(conv.messages || "[]");
    const updated = [
      ...existing,
      {
        role: "assistant",
        content: `📩 מייל חדש נוסף ממנה אותו שולח:\n**נושא:** ${emailSubject}\n\n${summary}`,
        createdAt: new Date().toISOString(),
      },
    ];
    await db
      .update(conversationsTable)
      .set({ messages: JSON.stringify(updated), messageCount: updated.length, updatedAt: new Date() })
      .where(eq(conversationsTable.id, conv.id));
  }

  // ── Step 4: Telegram notification ───────────────────────────────────────
  const appBase = process.env.APP_BASE_URL || "https://agenthub.guru";
  const chatUrl = `${appBase}/client-intake/?c=${conv.id}`;

  const tgMsg = `🎯 <b>ליד חדש נכנס!</b>

👤 <b>${senderName}</b> (${senderEmail})
📌 נושא: ${emailSubject}
📊 ציון: ${score}/10 ${scoreBar} | דחיפות: ${urg}

${summary}
${nextAction ? `\n💡 ${nextAction}` : ""}

💬 <b>לינק לשיחת איפיון עם הליד:</b>
${chatUrl}`;

  sendTelegramNotification(tgMsg).catch(() => {});

  // ── Step 5: auto-reply email to lead ────────────────────────────────────
  sendAutoReplyEmail(senderEmail, senderName, chatUrl).catch(() => {});

  res.json({
    ok: true,
    leadClientId: leadClient.id,
    leadClientName: leadClient.name,
    conversationId: conv.id,
    chatUrl,
    score,
    urgency,
    summary,
    nextAction,
  });
});

/**
 * GET /email/leads
 * Returns recent email leads (clients with source="email-lead"), newest first.
 * Each lead includes conversationId + agentId so the UI can link directly to the chat.
 */
router.get("/email/leads", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      contactEmail: clientsTable.contactEmail,
      industry: clientsTable.industry,
      notes: clientsTable.notes,
      createdAt: clientsTable.createdAt,
      conversationId: conversationsTable.id,
      conversationAgentId: conversationsTable.agentId,
    })
    .from(clientsTable)
    .leftJoin(conversationsTable, eq(conversationsTable.clientId, clientsTable.id))
    .where(eq(clientsTable.source, "email-lead"))
    .orderBy(desc(clientsTable.createdAt))
    .limit(40);

  // One row per client (take the first conversation if multiple)
  const seen = new Set<number>();
  const leads = rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  res.json(leads);
});

export default router;
