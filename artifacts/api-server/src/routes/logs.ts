import { Router, type IRouter } from "express";
import { db, agentLogsTable, agentLogSummariesTable } from "@workspace/db";
import { desc, gte, eq, and, lte } from "drizzle-orm";
import { analyzeLogs } from "../services/log-processor";

const router: IRouter = Router();

const SECRET_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(authorization|token|access_token|refresh_token|api[_-]?key|secret|password)\b\s*[:=]\s*["']?[^"',\s}]+/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];

function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[REDACTED_SECRET]"), value);
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      /authorization|token|api[_-]?key|secret|password/i.test(key)
        ? "[REDACTED_SECRET]"
        : redactSecrets(entry),
    ]),
  );
}

// GET /api/logs — paginated log feed with filters
router.get("/logs", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "100", 10), 500);
  const offset = parseInt((req.query.offset as string) ?? "0", 10);
  const source = req.query.source as string | undefined;
  const status = req.query.status as string | undefined;
  const since = req.query.since as string | undefined;  // ISO timestamp
  const clientIdParam = req.query.clientId as string | undefined;
  const clientId = clientIdParam ? parseInt(clientIdParam, 10) : undefined;

  const conditions = [];
  if (source) conditions.push(eq(agentLogsTable.source, source));
  if (status) conditions.push(eq(agentLogsTable.status, status));
  if (clientId && !isNaN(clientId)) conditions.push(eq(agentLogsTable.clientId, clientId));
  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      conditions.push(gte(agentLogsTable.timestamp, sinceDate));
    }
  }

  const query = db
    .select()
    .from(agentLogsTable)
    .orderBy(desc(agentLogsTable.timestamp))
    .limit(limit)
    .offset(offset);

  const rows = conditions.length > 0
    ? await db.select().from(agentLogsTable)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(agentLogsTable.timestamp))
        .limit(limit)
        .offset(offset)
    : await query;

  res.json(rows.map((r) => ({
    ...r,
    timestamp: r.timestamp.toISOString(),
    inputSummary: redactSecrets(r.inputSummary),
    outputSummary: redactSecrets(r.outputSummary),
    errorMessage: redactSecrets(r.errorMessage),
    metadata: r.metadata ? (() => { try { return redactSecrets(JSON.parse(r.metadata!)); } catch { return null; } })() : null,
  })));
});

// GET /api/logs/summary — latest AI-generated summary
router.get("/logs/summary", async (req, res): Promise<void> => {
  const [latest] = await db
    .select()
    .from(agentLogSummariesTable)
    .orderBy(desc(agentLogSummariesTable.createdAt))
    .limit(1);

  if (!latest) {
    res.json(null);
    return;
  }

  res.json({
    ...latest,
    createdAt: latest.createdAt.toISOString(),
    windowStart: latest.windowStart.toISOString(),
    windowEnd: latest.windowEnd.toISOString(),
    failurePoints: latest.failurePoints ? JSON.parse(latest.failurePoints) : [],
    activeAgents: latest.activeAgents ? JSON.parse(latest.activeAgents) : [],
    recommendations: latest.recommendations ? JSON.parse(latest.recommendations) : [],
    rawStats: latest.rawStats ? JSON.parse(latest.rawStats) : {},
  });
});

// GET /api/logs/summaries — recent summaries list
router.get("/logs/summaries", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(agentLogSummariesTable)
    .orderBy(desc(agentLogSummariesTable.createdAt))
    .limit(10);

  res.json(rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    windowStart: r.windowStart.toISOString(),
    windowEnd: r.windowEnd.toISOString(),
    failurePoints: r.failurePoints ? JSON.parse(r.failurePoints) : [],
    activeAgents: r.activeAgents ? JSON.parse(r.activeAgents) : [],
    recommendations: r.recommendations ? JSON.parse(r.recommendations) : [],
    rawStats: r.rawStats ? JSON.parse(r.rawStats) : {},
  })));
});

// POST /api/logs/analyze — manually trigger log analysis
router.post("/logs/analyze", async (req, res): Promise<void> => {
  const windowMinutes = parseInt((req.body?.windowMinutes as string) ?? "30", 10);
  res.json({ ok: true, message: "Analysis started" });
  // Run async so response is immediate
  analyzeLogs(isNaN(windowMinutes) ? 30 : Math.min(windowMinutes, 1440)).catch(console.error);
});

export default router;
