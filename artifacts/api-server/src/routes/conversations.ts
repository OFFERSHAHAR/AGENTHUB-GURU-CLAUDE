import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, conversationsTable, agentsTable, clientsTable, assignmentsTable } from "@workspace/db";
import { runModelWithHistory, type ChatMessage } from "../services/model-router";
import type { ModelTier } from "../services/model-router";
import { logEvent } from "../services/agent-logger";
import { maybeAnswerFromJournal } from "../services/journal-qa";
import { parseGuardrails, applyInputGuardrails, applyOutputGuardrails, buildTopicScopeInstruction } from "../services/guardrails.js";

const router: IRouter = Router();

function serializeConv(c: typeof conversationsTable.$inferSelect) {
  return {
    ...c,
    messages: JSON.parse(c.messages || "[]"),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/conversations/client/:clientId/agent/:agentId", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId, 10);
  const agentId = parseInt(req.params.agentId, 10);

  if (isNaN(clientId) || isNaN(agentId)) {
    res.status(400).json({ error: "Invalid IDs" });
    return;
  }

  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.clientId, clientId), eq(conversationsTable.agentId, agentId)));

  if (existing) {
    res.json(serializeConv(existing));
    return;
  }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));

  if (!agent || !client) {
    res.status(404).json({ error: "Agent or client not found" });
    return;
  }

  const [conv] = await db
    .insert(conversationsTable)
    .values({ clientId, agentId, title: `${agent.name} × ${client.name}`, messages: "[]", messageCount: 0 })
    .returning();

  res.json(serializeConv(conv));
});

router.get("/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  res.json(serializeConv(conv));
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { content } = req.body as { content: string };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, conv.agentId));
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, conv.clientId));

  if (!agent || !client) { res.status(404).json({ error: "Agent or client not found" }); return; }

  // Load the assignment's guardrails (per-assignment security layer).
  const [assignment] = await db
    .select({ guardrails: assignmentsTable.guardrails })
    .from(assignmentsTable)
    .where(and(eq(assignmentsTable.clientId, conv.clientId), eq(assignmentsTable.agentId, conv.agentId)))
    .limit(1);
  const guardrailRules = parseGuardrails(assignment?.guardrails);

  // INPUT guardrails — run before anything touches the model.
  if (guardrailRules.length > 0) {
    const inputCheck = applyInputGuardrails(guardrailRules, content.trim());
    if (inputCheck.blocked) {
      const blockedMsg: ChatMessage = {
        role: "assistant",
        content: inputCheck.reason ?? "ההודעה נחסמה על ידי מדיניות האבטחה של הסוכן.",
        createdAt: new Date().toISOString(),
        provider: "guardrail",
      };
      const userMsg: ChatMessage = { role: "user", content: content.trim(), createdAt: new Date().toISOString() };
      const updatedMessages = [...JSON.parse(conv.messages || "[]"), userMsg, blockedMsg];
      await db.update(conversationsTable).set({
        messages: JSON.stringify(updatedMessages),
        messageCount: updatedMessages.filter((m) => m.role !== "system").length,
        updatedAt: new Date(),
      }).where(eq(conversationsTable.id, id));
      if (inputCheck.violations.length > 0) {
        console.warn(`[guardrails] input blocked conv=${id} violations=${JSON.stringify(inputCheck.violations)}`);
      }
      res.json({ userMessage: userMsg, assistantMessage: blockedMsg });
      return;
    }
  }

  const existingMessages: ChatMessage[] = JSON.parse(conv.messages || "[]");
  const userMsg: ChatMessage = { role: "user", content: content.trim(), createdAt: new Date().toISOString() };
  const historyWithUser = [...existingMessages, userMsg];

  const tier = (client.tier as ModelTier) || "starter";
  const systemPrompt = await buildSystemPrompt(agent, client);

  // Topic scope guardrail — inject instruction into system prompt.
  const topicInstruction = buildTopicScopeInstruction(guardrailRules);

  // Journal Q&A: when the agent opts in (tag "journal-qa") and the message is a
  // data question, augment the prompt with a real DB query result so the model
  // answers from facts. A deterministic answer is kept as a fallback for when no
  // chat model is available (template fallback).
  let augmentedPrompt = systemPrompt + topicInstruction;
  let journalFallback: string | null = null;
  const convAgentTags: string[] = (() => {
    try { return JSON.parse(agent.tags || "[]"); } catch { return []; }
  })();
  if (convAgentTags.includes("journal-qa")) {
    try {
      const jr = await maybeAnswerFromJournal(conv.clientId, content.trim());
      if (jr) {
        augmentedPrompt = `${systemPrompt}\n\n${jr.contextBlock}`;
        journalFallback = jr.deterministicAnswer;
      }
    } catch (e) {
      console.error("[journal-qa] failed:", e instanceof Error ? e.message : e);
    }
  }

  const aiStart = Date.now();
  logEvent({
    source: "conversation",
    agentId: agent.id,
    agentName: agent.name,
    clientId: conv.clientId,
    conversationId: conv.id,
    eventType: "request",
    status: "info",
    inputSummary: content.trim(),
    metadata: { tier, model: agent.model, turnCount: existingMessages.length + 1 },
  });

  let assistantMsg: ChatMessage;
  try {
    const result = await runModelWithHistory(tier, augmentedPrompt, historyWithUser, agent.maxTokens || 4096);
    const durationMs = Date.now() - aiStart;
    const isFallback = result.content === "__TEMPLATE__";
    // Priority: (1) LLM answer  (2) journal deterministic answer  (3) generic Hebrew fallback
    let replyContent = result.content;
    if (isFallback) {
      replyContent = journalFallback ?? "מצטער, השרת עסוק כרגע — אנא נסה שוב בעוד רגע."
    }

    // JSON-output agents (e.g. lead-classifier) return structured JSON meant for
    // pipelines — never show raw JSON to a human in chat.  If the reply is pure
    // JSON and contains a "summary" field we extract it into natural Hebrew prose
    // and stash the full payload in metadata for downstream consumers.
    let classificationJson: Record<string, unknown> | null = null;
    if (!isFallback) {
      const trimmed = replyContent.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            classificationJson = parsed;
            const summary    = typeof parsed.summary    === "string" ? parsed.summary    : null;
            const nextAction = typeof parsed.nextAction === "string" ? parsed.nextAction : null;
            const score      = typeof parsed.score      === "number" ? parsed.score      : null;
            if (summary) {
              const scoreLine = score !== null ? `ניקוד: ${score}/10. ` : "";
              const actionLine = nextAction ? `\n\nהפעולה המומלצת: ${nextAction}` : "";
              replyContent = `${scoreLine}${summary}${actionLine}`;
            } else {
              // JSON without a summary — generic notice
              replyContent = "הסוכן עיבד את הבקשה ויצר תוצאה מובנית (זמינה במטא-דאטה של ההודעה).";
            }
          }
        } catch {
          // Not valid JSON — keep original content
        }
      }
    }

    logEvent({
      source: "conversation",
      agentId: agent.id,
      agentName: agent.name,
      clientId: conv.clientId,
      conversationId: conv.id,
      eventType: isFallback ? "ai_fallback" : "ai_success",
      status: isFallback ? "warning" : "success",
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      durationMs,
      inputSummary: content.trim(),
      outputSummary: isFallback ? "Template fallback — no AI configured" : replyContent.slice(0, 300),
      metadata: { tier, turnCount: existingMessages.length + 1, isFallback, journalAnswered: journalFallback != null },
    });

    // OUTPUT guardrails — sanitize/block the model response before sending.
    if (guardrailRules.length > 0) {
      const outputCheck = applyOutputGuardrails(guardrailRules, replyContent);
      if (outputCheck.blocked) {
        replyContent = outputCheck.reason ?? "התשובה נחסמה על ידי מדיניות האבטחה.";
      } else {
        replyContent = outputCheck.sanitized;
      }
      if (outputCheck.violations.length > 0) {
        console.warn(`[guardrails] output filtered conv=${id} violations=${JSON.stringify(outputCheck.violations)}`);
      }
    }

    assistantMsg = {
      role: "assistant",
      content: replyContent,
      createdAt: new Date().toISOString(),
      provider: result.provider,
      model: result.model,
      tokens: result.outputTokens,
      ...(classificationJson ? { classificationData: classificationJson } : {}),
    };
  } catch (err) {
    const durationMs = Date.now() - aiStart;
    logEvent({
      source: "conversation",
      agentId: agent.id,
      agentName: agent.name,
      clientId: conv.clientId,
      conversationId: conv.id,
      eventType: "ai_error",
      status: "error",
      durationMs,
      errorMessage: err instanceof Error ? err.message : String(err),
      metadata: { tier },
    });
    assistantMsg = {
      role: "assistant",
      content: "שגיאה בעת קריאה למודל. אנא בדוק את הגדרות ה-API.",
      createdAt: new Date().toISOString(),
      provider: "error",
    };
  }

  const updatedMessages = [...historyWithUser, assistantMsg];
  const newTitle = conv.title || content.slice(0, 60);

  await db
    .update(conversationsTable)
    .set({
      messages: JSON.stringify(updatedMessages),
      messageCount: updatedMessages.filter((m) => m.role !== "system").length,
      title: newTitle,
      updatedAt: new Date(),
    })
    .where(eq(conversationsTable.id, id));

  res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
});

router.delete("/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  await db
    .update(conversationsTable)
    .set({ messages: "[]", messageCount: 0, updatedAt: new Date() })
    .where(eq(conversationsTable.id, id));

  res.json({ ok: true });
});

// GET /api/clients/:clientId/memory-dump — all conversations for a client
router.get("/clients/:clientId/memory-dump", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId, 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const rows = await db
    .select({
      agentId: agentsTable.id,
      agentName: agentsTable.name,
      agentEmoji: agentsTable.iconEmoji,
      messages: conversationsTable.messages,
      messageCount: conversationsTable.messageCount,
      updatedAt: conversationsTable.updatedAt,
    })
    .from(conversationsTable)
    .innerJoin(agentsTable, eq(conversationsTable.agentId, agentsTable.id))
    .where(eq(conversationsTable.clientId, clientId));

  res.json(rows.map((r) => ({
    ...r,
    messages: JSON.parse(r.messages || "[]"),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

async function buildSystemPrompt(
  agent: typeof agentsTable.$inferSelect,
  client: typeof clientsTable.$inferSelect,
): Promise<string> {
  const tags: string[] = JSON.parse(agent.tags || "[]");
  const isAggregator = tags.includes("memory-aggregator");

  // Load all agents assigned to this client (for team-awareness context)
  const assignedAgents = await db
    .select({
      id: agentsTable.id,
      name: agentsTable.name,
      description: agentsTable.description,
      category: agentsTable.category,
      tags: agentsTable.tags,
      iconEmoji: agentsTable.iconEmoji,
    })
    .from(assignmentsTable)
    .innerJoin(agentsTable, eq(agentsTable.id, assignmentsTable.agentId))
    .where(eq(assignmentsTable.clientId, client.id));

  const otherAgents = assignedAgents.filter((a) => a.id !== agent.id);
  const agentsSection = otherAgents.length > 0
    ? `\n## 🤝 סוכנים נוספים משוייכים ללקוח זה\n` +
      otherAgents
        .map((a) => {
          const agTags: string[] = (() => { try { return JSON.parse(a.tags || "[]"); } catch { return []; } })();
          const tagStr = agTags.length > 0 ? ` [${agTags.join(", ")}]` : "";
          return `- ${a.iconEmoji || "🤖"} **${a.name}** (${a.category || "כללי"})${tagStr}: ${a.description || ""}`;
        })
        .join("\n")
    : "";

  const rawSpec = (client as any).rawSpec as string | null | undefined;
  const specSnippet = rawSpec ? rawSpec.slice(0, 600) + (rawSpec.length > 600 ? "…" : "") : null;

  const clientContext = `## הקשר לקוח
- שם: ${client.name}
- תעשייה: ${client.industry || "לא צוין"}
- אימייל: ${client.contactEmail || "לא צוין"}
- סטטוס: ${client.status}
- תוכנית: ${client.tier || "starter"}
${client.notes ? `- הערות: ${client.notes}` : ""}
${specSnippet ? `- תיאור עסקי: ${specSnippet}` : ""}${agentsSection}`.trim();

  const base = agent.systemPrompt || `אתה ${agent.name} — ${agent.description}`;

  let aggregatedMemory = "";

  if (isAggregator) {
    // Load ALL other agents' conversations for this client
    const otherConvs = await db
      .select({
        agentName: agentsTable.name,
        agentEmoji: agentsTable.iconEmoji,
        agentCategory: agentsTable.category,
        messages: conversationsTable.messages,
        messageCount: conversationsTable.messageCount,
      })
      .from(conversationsTable)
      .innerJoin(agentsTable, eq(conversationsTable.agentId, agentsTable.id))
      .where(
        and(
          eq(conversationsTable.clientId, client.id),
          ne(conversationsTable.agentId, agent.id),
        ),
      );

    const nonEmptyConvs = otherConvs.filter((c) => c.messageCount > 0);

    if (nonEmptyConvs.length > 0) {
      aggregatedMemory = `\n\n---\n\n## 🧠 זיכרון מצטבר — כל הסוכנים עבור ${client.name}\n\n`;
      for (const row of nonEmptyConvs) {
        const msgs: ChatMessage[] = JSON.parse(row.messages || "[]");
        const convoMsgs = msgs.filter((m) => m.role !== "system");
        if (convoMsgs.length === 0) continue;

        aggregatedMemory += `### ${row.agentEmoji || "🤖"} ${row.agentName} (${row.agentCategory})\n\n`;
        for (const m of convoMsgs) {
          const label = m.role === "user" ? "👤 User" : "🤖 Agent";
          // Truncate very long messages to avoid context overflow
          const content = m.content.length > 3000 ? m.content.slice(0, 3000) + "\n[...קוצר...]" : m.content;
          aggregatedMemory += `**${label}:** ${content}\n\n`;
        }
        aggregatedMemory += "---\n\n";
      }
    } else {
      aggregatedMemory = `\n\n---\n\n## 🧠 זיכרון מצטבר\n\nאין עדיין שיחות מסוכנים אחרים עבור לקוח זה. בקש מהמשתמש לשוחח עם הסוכנים האחרים תחילה כדי לצבור מידע.\n`;
    }
  }

  return `${base}

---

${clientContext}${aggregatedMemory}

## הנחיות זיכרון
- אתה שומר זיכרון מלא של כל השיחות הקודמות עם הלקוח הזה.
- הכר את הלקוח לפי מה שסיפר — אל תשאל שוב על מה שכבר ידוע.
- בנה על ידע קודם בכל תשובה.
- שפת ברירת מחדל: עברית, אלא אם הלקוח כותב אחרת.`;
}

export default router;
