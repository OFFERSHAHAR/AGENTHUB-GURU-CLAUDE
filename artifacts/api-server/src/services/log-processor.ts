/**
 * Log Processor — AI-powered log analysis running every 30 minutes.
 * Reads recent agent_logs, generates a Hebrew structured summary, saves to agent_log_summaries.
 */

import { db, agentLogsTable, agentLogSummariesTable } from "@workspace/db";
import { gte, desc } from "drizzle-orm";
import { runModelWithHistory, type ChatMessage } from "./model-router";

const ANALYSIS_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface FailurePoint {
  source: string;
  description: string;
  recommendation: string;
}

interface ActiveAgent {
  agentName: string;
  eventCount: number;
  successRate: number;
}

const LOG_ANALYZER_PROMPT = `
You are an AgentHub Log Analysis Agent (סוכן ניתוח לוגים). Your role is to analyze structured agent operation logs and produce a concise Hebrew report that an operations manager can act on immediately.

## Input
You will receive a JSON array of recent agent log events containing: source, eventType, status, agentName, inputSummary, outputSummary, provider, model, durationMs, errorMessage, and metadata.

## Output
Respond with ONLY this JSON (no other text, no markdown fences):
{
  "summaryText": "3-5 lines in Hebrew describing what happened in this window. Highlight: total operations, success rate, any anomalies, provider/model used.",
  "failurePoints": [
    {
      "source": "which agent/route",
      "description": "what failed and why",
      "recommendation": "concrete fix action in Hebrew"
    }
  ],
  "activeAgents": [
    {
      "agentName": "agent name",
      "eventCount": 12,
      "successRate": 0.92
    }
  ],
  "recommendations": [
    "Actionable recommendation in Hebrew (e.g. הגדר GROQ_API_KEY כדי לאפשר תגובות AI אמיתיות)"
  ]
}

Rules:
- If there are no errors, failurePoints = []
- If there are no active agents, activeAgents = []
- recommendations: max 5 items, ordered by priority
- summaryText: always in Hebrew, concise, factual
- descriptions and recommendations: Hebrew
`.trim();

export async function analyzeLogs(windowMinutes = 30): Promise<void> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  const windowEnd = new Date();

  try {
    const logs = await db
      .select()
      .from(agentLogsTable)
      .where(gte(agentLogsTable.timestamp, windowStart))
      .orderBy(desc(agentLogsTable.timestamp))
      .limit(200);

    const totalEvents = logs.length;
    const successCount = logs.filter((l) => l.status === "success").length;
    const errorCount = logs.filter((l) => l.status === "error").length;
    const warningCount = logs.filter((l) => l.status === "warning").length;

    // Build compact log payload for AI (strip huge fields)
    const compactLogs = logs.map((l) => ({
      source: l.source,
      eventType: l.eventType,
      status: l.status,
      agentName: l.agentName,
      provider: l.provider,
      model: l.model,
      durationMs: l.durationMs,
      errorMessage: l.errorMessage,
      inputSummary: l.inputSummary?.slice(0, 100),
      outputSummary: l.outputSummary?.slice(0, 100),
      timestamp: l.timestamp.toISOString(),
    }));

    const rawStats = {
      totalEvents,
      successCount,
      errorCount,
      warningCount,
      windowMinutes,
      sources: [...new Set(logs.map((l) => l.source))],
      providers: [...new Set(logs.map((l) => l.provider).filter(Boolean))],
    };

    let summaryText = `סה"כ ${totalEvents} אירועים בחלון ${windowMinutes} דקות. ${successCount} הצלחות, ${errorCount} שגיאות.`;
    let failurePoints: FailurePoint[] = [];
    let activeAgents: ActiveAgent[] = [];
    let recommendations: string[] = [];

    if (totalEvents > 0) {
      const userMsg = `Analyze these ${totalEvents} log events from the last ${windowMinutes} minutes:\n\n${JSON.stringify(compactLogs, null, 2)}`;
      const history: ChatMessage[] = [{ role: "user", content: userMsg, createdAt: new Date().toISOString() }];

      const result = await runModelWithHistory("starter", LOG_ANALYZER_PROMPT, history, 2048);

      if (result.content !== "__TEMPLATE__") {
        try {
          const cleaned = result.content
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
          const parsed = JSON.parse(cleaned) as {
            summaryText: string;
            failurePoints: FailurePoint[];
            activeAgents: ActiveAgent[];
            recommendations: string[];
          };
          summaryText = parsed.summaryText ?? summaryText;
          failurePoints = parsed.failurePoints ?? [];
          activeAgents = parsed.activeAgents ?? [];
          recommendations = parsed.recommendations ?? [];
        } catch {
          // AI output not parseable — use computed stats as summary
        }
      } else {
        // No AI — build summary from raw stats
        const errorSources = [...new Set(logs.filter((l) => l.status === "error").map((l) => l.source))];
        if (errorSources.length) {
          failurePoints = errorSources.map((s) => ({
            source: s,
            description: `שגיאות ב-${s}`,
            recommendation: `בדוק לוגים ב-${s} ואמת הגדרות API`,
          }));
        }
        // Build active agents from logs
        const agentMap = new Map<string, { total: number; success: number }>();
        for (const l of logs) {
          const name = l.agentName ?? l.source;
          const entry = agentMap.get(name) ?? { total: 0, success: 0 };
          entry.total++;
          if (l.status === "success") entry.success++;
          agentMap.set(name, entry);
        }
        activeAgents = [...agentMap.entries()].map(([agentName, s]) => ({
          agentName,
          eventCount: s.total,
          successRate: s.total > 0 ? Math.round((s.success / s.total) * 100) / 100 : 0,
        }));
        if (!process.env.GROQ_API_KEY) {
          recommendations.push("הגדר GROQ_API_KEY כדי לאפשר ניתוח AI מלא של הלוגים");
        }
      }
    }

    await db.insert(agentLogSummariesTable).values({
      windowStart,
      windowEnd,
      totalEvents,
      successCount,
      errorCount,
      warningCount,
      summaryText,
      failurePoints: JSON.stringify(failurePoints),
      activeAgents: JSON.stringify(activeAgents),
      recommendations: JSON.stringify(recommendations),
      rawStats: JSON.stringify(rawStats),
    });

    console.info(`[log-processor] Summary saved. Window: ${windowMinutes}min, Events: ${totalEvents}, Errors: ${errorCount}`);
  } catch (err) {
    console.error("[log-processor] Analysis failed:", err instanceof Error ? err.message : err);
  }
}

/** Start the 30-minute analysis scheduler */
export function startLogProcessor(): void {
  console.info("[log-processor] Starting — will analyze logs every 30 minutes");
  // Run immediately on startup (analyze last 30 min)
  setTimeout(() => {
    analyzeLogs(30).catch(console.error);
  }, 10_000); // 10s delay to let server fully start

  // Then every 30 minutes
  setInterval(() => {
    analyzeLogs(30).catch(console.error);
  }, ANALYSIS_INTERVAL_MS);
}
