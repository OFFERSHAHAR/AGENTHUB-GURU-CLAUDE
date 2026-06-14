import { Router, type IRouter } from "express";
import express from "express";
import { db, agentsTable, studySessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { runModel } from "../services/model-router";
import { logEvent } from "../services/agent-logger";

const router: IRouter = Router();

const STUDY_LISTENER_AGENT_NAME = "Study Listener";
const STUDY_LISTENER_CATEGORY = "education";

async function getOrCreateStudyListenerAgent(): Promise<number> {
  const existing = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.name, STUDY_LISTENER_AGENT_NAME))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const created = await db
    .insert(agentsTable)
    .values({
      name: STUDY_LISTENER_AGENT_NAME,
      description: "Listens to Zoom lectures, transcribes in real-time, and generates structured study summaries and homework lists.",
      category: STUDY_LISTENER_CATEGORY,
      status: "active",
      capabilities: JSON.stringify(["audio-transcription", "lecture-summarization", "homework-extraction", "hebrew-support"]),
      tags: JSON.stringify(["education", "transcription", "ai", "zoom"]),
      iconEmoji: "🎧",
      model: "whisper-1 + gpt-4o",
    })
    .returning();

  return created[0].id;
}

router.post("/study/transcribe", express.raw({ type: "*/*", limit: "25mb" }), async (req: any, res: any) => {
  try {
    const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
    const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      res.status(503).json({
        error: "AI transcription not configured — no OpenAI API key available",
        text: "",
      });
      return;
    }

    const rawBody = req.body as Buffer;
    if (!rawBody || rawBody.length === 0) {
      res.status(400).json({ error: "No audio data received", text: "" });
      return;
    }

    const contentType = req.headers["content-type"] || "audio/webm";
    const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("mp4") ? "mp4" : "webm";
    const filename = `chunk.${ext}`;

    const formData = new FormData();
    const blob = new Blob([rawBody], { type: contentType });
    formData.append("file", blob, filename);
    formData.append("model", "whisper-1");

    const whisperRes = await fetch(`${openaiBaseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      logger.warn({ status: whisperRes.status, errText }, "Whisper transcription failed");
      res.status(502).json({ error: `Whisper error: ${whisperRes.status}`, text: "" });
      return;
    }

    const result = await whisperRes.json() as { text: string };
    res.json({ text: result.text || "" });
  } catch (err) {
    logger.error({ err }, "study/transcribe error");
    res.status(500).json({ error: "Transcription failed", text: "" });
  }
});

router.post("/study/summarize", async (req: any, res: any) => {
  try {
    const { transcript, subject } = req.body as { transcript: string; subject?: string };

    if (!transcript || transcript.trim().length === 0) {
      res.status(400).json({ error: "transcript is required" });
      return;
    }

    const subjectLine = subject ? `נושא השיעור: ${subject}\n\n` : "";

    const systemPrompt = `אתה עוזר לימודי מקצועי. המשימה שלך היא לנתח תמלול של שיעור ולהפיק שני מסמכים מובנים.

השב **תמיד בפורמט JSON בלבד** עם שני שדות:
1. "summary" — סיכום השיעור במבנה ברור עם כותרות ראשיות ותוכן מפורט
2. "homework" — רשימת שיעורי בית ומשימות שהוזכרו בשיעור

כללים:
- כתוב בעברית אם השיעור בעברית, באנגלית אם השיעור באנגלית
- הסיכום צריך להיות מובנה עם כותרות (##) ורשימות
- שיעורי הבית בפורמט רשימה ממוספרת
- אם לא הוזכרו שיעורי בית, כתוב "לא הוזכרו שיעורי בית בשיעור זה"
- הסיכום צריך להיות מקיף ושימושי ללמידה`;

    const userMessage = `${subjectLine}תמלול השיעור:\n\n${transcript}`;

    const modelResult = await runModel("pro", systemPrompt, userMessage);

    let summary = "";
    let homework = "";

    try {
      const parsed = JSON.parse(modelResult.content) as { summary: string; homework: string };
      summary = parsed.summary || "";
      homework = parsed.homework || "";
    } catch {
      summary = modelResult.content;
      homework = "לא ניתן לחלץ שיעורי בית באופן אוטומטי";
    }

    res.json({ summary, homework });
  } catch (err) {
    logger.error({ err }, "study/summarize error");
    res.status(500).json({ error: "Summarization failed" });
  }
});

router.get("/study/sessions", async (_req: any, res: any) => {
  try {
    const sessions = await db
      .select({
        id: studySessionsTable.id,
        subject: studySessionsTable.subject,
        transcript: studySessionsTable.transcript,
        summary: studySessionsTable.summary,
        homework: studySessionsTable.homework,
        durationMs: studySessionsTable.durationMs,
        inputTokens: studySessionsTable.inputTokens,
        outputTokens: studySessionsTable.outputTokens,
        estimatedCostUsd: studySessionsTable.estimatedCostUsd,
        agentLogId: studySessionsTable.agentLogId,
        createdAt: studySessionsTable.createdAt,
      })
      .from(studySessionsTable)
      .orderBy(desc(studySessionsTable.createdAt));

    res.json(sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })));
  } catch (err) {
    logger.error({ err }, "study/sessions GET error");
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

router.post("/study/sessions", async (req: any, res: any) => {
  try {
    const {
      subject,
      transcript,
      summary,
      homework,
      durationMs,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    } = req.body as {
      subject: string;
      transcript: string;
      summary: string;
      homework: string;
      durationMs: number;
      inputTokens?: number;
      outputTokens?: number;
      estimatedCostUsd?: number;
    };

    if (!subject || !transcript || !summary || !homework || durationMs === undefined) {
      res.status(400).json({ error: "subject, transcript, summary, homework, and durationMs are required" });
      return;
    }

    const agentId = await getOrCreateStudyListenerAgent();

    const [session] = await db
      .insert(studySessionsTable)
      .values({
        subject,
        transcript,
        summary,
        homework,
        durationMs,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
        estimatedCostUsd: estimatedCostUsd ?? null,
        agentLogId: null,
      })
      .returning();

    logEvent({
      source: "study-listener",
      eventType: "success",
      status: "success",
      agentId,
      agentName: STUDY_LISTENER_AGENT_NAME,
      inputSummary: `[${subject}] ${transcript.slice(0, 300)}`,
      outputSummary: summary.slice(0, 300),
      provider: "openai",
      model: "whisper-1 + gpt-4o",
      inputTokens: inputTokens ?? 0,
      outputTokens: outputTokens ?? 0,
      estimatedCostUsd: estimatedCostUsd ?? 0,
      durationMs,
      metadata: { sessionId: session.id, subject },
    });

    res.status(201).json({ ...session, createdAt: session.createdAt.toISOString() });
  } catch (err) {
    logger.error({ err }, "study/sessions POST error");
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.get("/study/sessions/:id", async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }

    const [session] = await db
      .select()
      .from(studySessionsTable)
      .where(eq(studySessionsTable.id, id))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({ ...session, createdAt: session.createdAt.toISOString() });
  } catch (err) {
    logger.error({ err }, "study/sessions/:id GET error");
    res.status(500).json({ error: "Failed to get session" });
  }
});

export default router;
