import { Router, type IRouter } from "express";
import { db, agentsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runModelWithHistory, type ChatMessage, type ModelTier } from "../services/model-router";
import { logEvent } from "../services/agent-logger";

const router: IRouter = Router();

/**
 * Tier selection:
 *  1. Ollama  — if OLLAMA_BASE_URL is set (external server)
 *  2. Groq 8B — "fallback" tier: 14K RPD, 500K TPD, ~6K TPM
 *
 * Avoid "starter" (Groq 70B): same 6K TPM but only 100 RPD free — exhausted fast.
 * Hebrew tokenizes at ~3-4 tok/word; keep system prompt in English to stay under limit.
 */
function pickSpecTier(): ModelTier {
  if (process.env.OLLAMA_BASE_URL) return "free";
  if (process.env.GROQ_API_KEY) return "fallback";
  return "free";
}

/**
 * Phase-aware spec-agent prompt.
 *
 * Phase 1 (userTurns === 1)  — opener: reflect back + exactly 2 warm questions.
 * Phase 2 (userTurns 2–3)   — follow-up: 2 more targeted questions, business-type aware.
 * Phase 3 (userTurns >= 4)  — close: spec document + warm thank-you + JSON block.
 *
 * Never more than 2 questions per response. Zero technical jargon at any phase.
 * Token budget: system prompt in English; Hebrew only in the response.
 */
function buildSystemPrompt(agentsList: string, userTurns: number): string {
  const phase = userTurns <= 1 ? 1 : userTurns <= 3 ? 2 : 3;

  // ── Phase 1: opener ────────────────────────────────────────────────────────
  const phase1 = `
CURRENT PHASE: OPENER (first message from the client)

Rules (strictly enforce):
- Respond in Hebrew only.
- NO technical jargon — zero. No "API", "webhook", "integration", "node", "trigger", "system".
- Ask EXACTLY 2 questions, numbered 1 and 2. No more, no less.
- Each question must be 1–2 lines, plain everyday language, warm and direct.
- Use "אתה/את" directly. Friendly tone — like a smart friend, not a consultant.

Structure your reply:
1. "✅ **הבנתי:**" — one sentence reflecting what they described in simple words.
2. "💬 **שאלה אחת לפני שנמשיך:**" — Q1 focused on: what is the ONE most painful/repetitive task they want to stop doing manually?
3. Q2 focused on: how does it actually happen today, step by step (as simply as possible)?
4. End with exactly: "ענה/י בחופשיות — אין תשובה נכונה ולא נכונה 😊"

Do NOT generate a spec yet. Two questions only.`.trim();

  // ── Phase 2: follow-up ─────────────────────────────────────────────────────
  const phase2 = `
CURRENT PHASE: FOLLOW-UP (client answered the opening questions)

Rules:
- Read the conversation history to infer the BUSINESS TYPE and specific context.
- Respond in Hebrew only.
- Ask EXACTLY 2 more targeted questions, numbered 1 and 2. Concrete and specific to THEIR situation.
- Zero jargon. Warm. Direct.

Tailor questions by business type (pick the relevant bucket):
  🏨 Hotel / short-term rental → guest communication flow, check-in/check-out timing, how bookings currently arrive
  🍽️ Restaurant / catering → reservations handling, supplier orders, end-of-day reporting
  📦 Logistics / shipping → order tracking updates, customer notifications, driver coordination
  🏥 Clinic / healthcare → appointment reminders, patient follow-up, test results delivery
  🛒 E-commerce / retail → order confirmation flow, stock alerts, customer service messages
  🏗️ Contractor / construction → quote requests, subcontractor coordination, progress updates to clients
  📚 Education / training → enrollment confirmations, homework/assignment reminders, parent updates
  💼 General B2B service → lead follow-up, client status updates, invoice reminders

For the chosen bucket, ask the 2 most revealing follow-up questions.
If bucket is unclear, ask about: (1) how often the problem happens per week, (2) who else on the team is involved.

End with: "כמעט סיימנו — עוד קצת ויש לי מה לעבוד איתו 🙏"`.trim();

  // ── Phase 3: close with spec doc ───────────────────────────────────────────
  const phase3 = `
CURRENT PHASE: CLOSING — generate the business spec document now.

Open with exactly:
"תודה רבה! 🎉 הנה התכנית שהכנתי לך:"

Then produce the spec document in plain Hebrew (zero jargon — no APIs/webhooks/integrations/nodes/n8n):

# תכנית העבודה שלך — [project name in plain words]
**תאריך:** [today] | **הוכן על-ידי:** AgentHub

---

## 🎯 במה מדובר — בקצרה
[2–3 sentences: the pain, the solution, the benefit. Use their own words.]

## 😓 איך זה עובד היום
[Bullet points — what takes time, what causes stress, what costs money.]

## ✨ מה ישתנה בשבילך
[Numbered list of what HAPPENS in practice: "כל בוקר תקבל...", "ברגע שלקוח ממלא טופס, תוך דקה...". No tech.]

## 👥 מי נהנה מזה
[Brief bullet list: roles / people + how their day changes.]

## 📊 איך נדע שהצלחנו
[3–4 measurable outcomes: "במקום X שעות — Y דקות", "0 טעויות", etc.]

## 🗓️ לוח זמנים משוער
**שבועות 1–2:** [first deliverable, plain words]
**שבועות 3–5:** [core feature, plain words]
**שבועות 6–8:** [polish / reporting, plain words]

---

Close with exactly (after the document, before the JSON):
"✨ המסמך מוכן! צוות AgentHub יחזור אליך תוך 24–48 שעות לתיאום שיחת המשך. תודה שסמכת עלינו 🙏"

Then append the internal block (hidden from client):
<<<SPEC_OUTPUT_START>>>
{"n8nWorkflow":{"name":"WORKFLOW_NAME","nodes":[{"id":"n1","name":"Trigger","type":"n8n-nodes-base.webhook","position":[250,300],"parameters":{"httpMethod":"POST","path":"trigger"}},{"id":"n2","name":"Process","type":"n8n-nodes-base.function","position":[500,300],"parameters":{"functionCode":"// core logic"}},{"id":"n3","name":"Notify","type":"n8n-nodes-base.slack","position":[750,300],"parameters":{"channel":"#alerts","text":"notification"}}],"connections":{"Trigger":{"main":[[{"node":"Process","type":"main","index":0}]]},"Process":{"main":[[{"node":"Notify","type":"main","index":0}]]}}},"recommendedAgentId":AGENT_ID,"reasoning":"Hebrew 2–3 sentences","clientName":"CLIENT_OR_PROJECT_NAME"}
<<<SPEC_OUTPUT_END>>>`.trim();

  const phasePrompt = phase === 1 ? phase1 : phase === 2 ? phase2 : phase3;

  return `You are AgentHub's friendly business discovery assistant.
Goal: help non-technical business owners describe what they want automated, then produce a clear spec.
Always respond in Hebrew. Warm tone — knowledgeable friend, not a consultant. Zero technical jargon.

${phasePrompt}

Available agents (use exact integer IDs in the JSON block only):
${agentsList}`.trim();
}

router.post("/spec-agent/chat", async (req, res): Promise<void> => {
  const { messages } = req.body as { messages?: Array<{ role: string; content: string }> };
  const start = Date.now();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  // Count user turns to determine phase
  const userTurns = messages.filter((m) => m.role === "user").length;
  const lastUserMsg = messages[messages.length - 1]?.content ?? "";
  const tier = pickSpecTier();

  logEvent({
    source: "spec-agent",
    agentName: "Spec Agent",
    eventType: "request",
    status: "info",
    inputSummary: lastUserMsg.slice(0, 200),
    metadata: { turnCount: messages.length, userTurns, tier, phase: userTurns <= 1 ? 1 : 2 },
  });

  try {
    const agents = await db
      .select({ id: agentsTable.id, name: agentsTable.name, category: agentsTable.category })
      .from(agentsTable);

    // ID + name only — descriptions push over Groq 8B's 6K TPM limit
    const agentsList = agents.map((a) => `  ID ${a.id}: ${a.name} [${a.category}]`).join("\n");
    const systemPrompt = buildSystemPrompt(agentsList, userTurns);

    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: new Date().toISOString(),
    }));

    const result = await runModelWithHistory(tier, systemPrompt, history, 4096, "spec-agent");

    const durationMs = Date.now() - start;
    const isFallback = result.content === "__TEMPLATE__";

    if (isFallback) {
      logEvent({
        source: "spec-agent",
        agentName: "Spec Agent",
        eventType: "ai_fallback",
        status: "warning",
        provider: result.provider,
        model: result.model,
        durationMs,
        outputSummary: "Template fallback",
        metadata: { turnCount: messages.length, userTurns, tier },
      });
      res.json({
        reply:
          "⚠️ שירות ה-AI אינו מוגדר.\n\n" +
          "להפעלת סוכן האיפיון יש להגדיר:\n" +
          "• GROQ_API_KEY — מודל Groq Llama\n" +
          "• OLLAMA_BASE_URL — שרת Ollama חיצוני",
      });
      return;
    }

    const hasSpecOutput = result.content.includes("<<<SPEC_OUTPUT_START>>>");
    logEvent({
      source: "spec-agent",
      agentName: "Spec Agent",
      eventType: hasSpecOutput ? "success" : "ai_success",
      status: "success",
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      durationMs,
      outputSummary: result.content.slice(0, 300),
      metadata: { turnCount: messages.length, userTurns, hasSpecOutput, tier, phase: userTurns <= 1 ? 1 : 2 },
    });

    res.json({ reply: result.content });
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error("[spec-agent] error:", err);
    logEvent({
      source: "spec-agent",
      agentName: "Spec Agent",
      eventType: "error",
      status: "error",
      durationMs,
      errorMessage: err instanceof Error ? err.message : String(err),
      metadata: { turnCount: messages.length, tier },
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /spec-agent/submit
 * Called by client-intake when the spec is complete.
 * Saves the client to the DB and sends a Telegram notification.
 */
/**
 * Strip the internal JSON block (<<<SPEC_OUTPUT_START>>> … <<<SPEC_OUTPUT_END>>>)
 * from a spec string, returning only the human-readable text.
 */
function stripSpecBlock(text: string): string {
  if (!text) return text;
  // Remove <<<SPEC_OUTPUT_START>>> block if present
  const startIdx = text.indexOf("<<<SPEC_OUTPUT_START>>>");
  if (startIdx !== -1) return text.slice(0, startIdx).trim();
  // Remove trailing JSON object before <<<SPEC_OUTPUT_END>>>
  const endIdx = text.indexOf("<<<SPEC_OUTPUT_END>>>");
  if (endIdx !== -1) {
    const beforeMarker = text.slice(0, endIdx);
    const lastJsonStart = beforeMarker.lastIndexOf("\n{");
    return (lastJsonStart !== -1 ? beforeMarker.slice(0, lastJsonStart) : beforeMarker).trim();
  }
  return text.trim();
}

router.post("/spec-agent/submit", async (req, res): Promise<void> => {
  const { firstName, companyName, industry, role, email, specText } = req.body as {
    firstName?: string;
    companyName?: string;
    industry?: string;
    role?: string;
    email?: string;
    specText?: string;
  };

  if (!companyName || !email) {
    res.status(400).json({ error: "companyName and email are required" });
    return;
  }

  try {
    // Find or create client
    const [existing] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.contactEmail, email.toLowerCase().trim()));

    let clientId: number;
    const cleanSpec = stripSpecBlock(specText ?? "");

    if (existing) {
      await db
        .update(clientsTable)
        .set({ rawSpec: cleanSpec, analysisStatus: "pending_review" })
        .where(eq(clientsTable.id, existing.id));
      clientId = existing.id;
    } else {
      const [created] = await db
        .insert(clientsTable)
        .values({
          name: companyName.trim(),
          industry: industry?.trim() || "כללי",
          contactEmail: email.toLowerCase().trim(),
          status: "active",
          tier: "starter",
          source: "client-intake",
          rawSpec: cleanSpec,
          analysisStatus: "pending_review",
          notes: `נרשם דרך טופס האיפיון. איש קשר: ${firstName || "לא צוין"}, תפקיד: ${role || "לא צוין"}`,
        })
        .returning();
      clientId = created.id;
    }

    // Telegram notification (best-effort)
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId && process.env.NODE_ENV !== "test") {
      const msg = `🎉 <b>איפיון חדש הושלם!</b>

👤 ${firstName || "?"} — <b>${companyName}</b>
📧 ${email}
🏭 ענף: ${industry || "לא צוין"} | תפקיד: ${role || "לא צוין"}

📄 מסמך האיפיון נשמר ב-AgentHub ← לקוחות
➡️ לקוח #${clientId} ממתין לטיפול`;

      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
      }).catch(() => {});
    }

    logEvent({
      source: "spec-agent",
      agentName: "Spec Agent",
      clientId,
      eventType: "success",
      status: "success",
      outputSummary: `Intake submitted: ${companyName} (${email})`,
      metadata: { firstName, industry, role, isNew: !existing },
    });

    res.json({ ok: true, clientId });
  } catch (err) {
    console.error("[spec-agent/submit] error:", err);
    res.status(500).json({ error: "Failed to save intake" });
  }
});

export default router;
