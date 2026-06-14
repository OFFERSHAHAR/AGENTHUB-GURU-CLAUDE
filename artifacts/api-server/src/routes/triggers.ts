import { Router, type IRouter } from "express";
import { eq, desc, and, gte, inArray, count, sql } from "drizzle-orm";
import { db, triggersTable, triggerEventsTable, assignmentsTable, agentsTable, clientsTable, activityTable, agentLogsTable, palgatePermitsTable } from "@workspace/db";
import { getDedupWarnThreshold, getDedupWindowHours, getDedupWindowUnit, getWebhookTelegramNotificationsEnabled } from "./settings.js";
import { randomUUID } from "crypto";
import {
  GetAssignmentTriggerParams,
  CreateAssignmentTriggerParams,
  FireWebhookTriggerParams,
} from "@workspace/api-zod";
import { notifyWebhookFired, sendTelegramMessage } from "../lib/telegram-notify.js";
import { runModel } from "../services/model-router";
import { publishTriggerEvent, subscribeTriggerEvents, getMissedEvents, type TriggerBusEnvelope } from "../lib/trigger-events-bus.js";
import { ingestPayloadToJournal } from "../services/journal-qa";
import { readSheet, compareWithDb, buildCompareReport, buildWebhookReport } from "../services/sheets-reader.js";

const router: IRouter = Router();

function formatTrigger(
  t: typeof triggersTable.$inferSelect,
  webhookBase: string,
  events: (typeof triggerEventsTable.$inferSelect)[] = [],
) {
  return {
    id: t.id,
    assignmentId: t.assignmentId,
    webhookUrl: `${webhookBase}/api/webhooks/trigger/${t.webhookSecret}`,
    status: t.status,
    lastFiredAt: t.lastFiredAt ? t.lastFiredAt.toISOString() : null,
    lastPayload: t.lastPayload ? JSON.parse(t.lastPayload) : null,
    createdAt: t.createdAt.toISOString(),
    recentEvents: events.map((e) => ({
      id: e.id,
      triggerId: e.triggerId,
      assignmentId: e.assignmentId,
      payload: e.payload ? JSON.parse(e.payload) : null,
      agentStatus: e.agentStatus,
      agentOutput: e.agentOutput ?? null,
      firedAt: e.firedAt.toISOString(),
    })),
  };
}

function getWebhookBase(req: { headers: Record<string, string | string[] | undefined>; protocol: string }): string {
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  return `${proto}://${host}`;
}

// GET /trigger-stats/summary — cross-client roll-up: count of integrations with a high dedup rate
router.get("/trigger-stats/summary", async (req, res): Promise<void> => {
  const windowHours = await getDedupWindowHours();
  const windowUnit = await getDedupWindowUnit();
  const windowDays = windowHours / 24;
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const warnThreshold = await getDedupWarnThreshold();

  // Deduplicated events per assignment in the rolling window
  const dedupRows = await db
    .select({
      assignmentId: triggerEventsTable.assignmentId,
      deduplicated: count(),
    })
    .from(triggerEventsTable)
    .where(
      and(
        eq(triggerEventsTable.agentStatus, "deduplicated"),
        gte(triggerEventsTable.firedAt, windowStart),
      ),
    )
    .groupBy(triggerEventsTable.assignmentId);

  // Only assignments that cross the threshold
  const highDedupAssignmentIds = dedupRows
    .filter((r) => Number(r.deduplicated) >= warnThreshold)
    .map((r) => r.assignmentId);

  if (highDedupAssignmentIds.length === 0) {
    res.json({ highDedupCount: 0, windowDays, windowHours, windowUnit, affectedClients: [] });
    return;
  }

  // Map assignment → client
  const assignments = await db
    .select({ id: assignmentsTable.id, clientId: assignmentsTable.clientId })
    .from(assignmentsTable)
    .where(inArray(assignmentsTable.id, highDedupAssignmentIds));

  const clientIds = [...new Set(assignments.map((a) => a.clientId))];

  const clients = await db
    .select({ id: clientsTable.id, name: clientsTable.name })
    .from(clientsTable)
    .where(inArray(clientsTable.id, clientIds));

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  // Count high-dedup assignments per client
  const perClient = new Map<number, number>();
  for (const a of assignments) {
    perClient.set(a.clientId, (perClient.get(a.clientId) ?? 0) + 1);
  }

  const affectedClients = [...perClient.entries()].map(([clientId, count]) => ({
    clientId,
    clientName: clientMap.get(clientId) ?? "Unknown",
    count,
  }));

  res.json({
    highDedupCount: highDedupAssignmentIds.length,
    windowDays,
    windowHours,
    windowUnit,
    affectedClients,
  });
});

// GET /clients/:id/trigger-stats — dedup summary for last 7 days across all assignments
router.get("/clients/:id/trigger-stats", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.id, 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client id" }); return; }

  const windowHours = await getDedupWindowHours();
  const windowUnit = await getDedupWindowUnit();
  const windowDays = windowHours / 24;
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  // Sub-day windows (< 24h) are bucketed by hour so the intra-day pattern that
  // motivated the short window stays readable; day-or-longer windows keep their
  // calendar-day buckets. `breakdownUnit` tells the UI how to label the series.
  const useHourly = windowHours < 24;
  const breakdownUnit: "hour" | "day" = useHourly ? "hour" : "day";

  // Build the ordered bucket keys (UTC, oldest → newest) spanning the window for
  // zero-filling. Hourly keys are full ISO hours (YYYY-MM-DDTHH:00:00Z); daily
  // keys are calendar dates (YYYY-MM-DD). A sub-day window still covers >= 1 hour.
  const bucketKeys = useHourly
    ? Array.from({ length: Math.max(1, windowHours) }, (_, i) => {
        const d = new Date(Date.now() - (windowHours - 1 - i) * 60 * 60 * 1000);
        d.setUTCMinutes(0, 0, 0);
        return `${d.toISOString().slice(0, 13)}:00:00Z`;
      })
    : (() => {
        const breakdownDays = Math.max(1, Math.ceil(windowHours / 24));
        return Array.from({ length: breakdownDays }, (_, i) => {
          const d = new Date(Date.now() - (breakdownDays - 1 - i) * 24 * 60 * 60 * 1000);
          return d.toISOString().slice(0, 10);
        });
      })();

  // SQL expression that produces a bucket key matching the zero-fill keys above.
  const bucketExpr = useHourly
    ? sql<string>`to_char(date_trunc('hour', ${triggerEventsTable.firedAt}), 'YYYY-MM-DD"T"HH24":00:00Z"')`
    : sql<string>`DATE(${triggerEventsTable.firedAt})`;

  // Get all assignment IDs for this client
  const clientAssignments = await db
    .select({ id: assignmentsTable.id })
    .from(assignmentsTable)
    .where(eq(assignmentsTable.clientId, clientId));

  if (clientAssignments.length === 0) {
    res.json({
      totalDeduplicated: 0,
      windowDays,
      windowHours,
      windowUnit,
      breakdownUnit,
      dailyBreakdown: bucketKeys.map((date) => ({ date, count: 0 })),
      perAssignment: [],
    });
    return;
  }

  const assignmentIds = clientAssignments.map((a) => a.id);

  // Count deduplicated events per assignment AND per bucket in the rolling window
  const dedupRows = await db
    .select({
      assignmentId: triggerEventsTable.assignmentId,
      day: bucketExpr.as("day"),
      deduplicated: count(),
    })
    .from(triggerEventsTable)
    .where(
      and(
        inArray(triggerEventsTable.assignmentId, assignmentIds),
        eq(triggerEventsTable.agentStatus, "deduplicated"),
        gte(triggerEventsTable.firedAt, windowStart),
      ),
    )
    .groupBy(triggerEventsTable.assignmentId, bucketExpr);

    // Aggregate per-assignment totals and per-assignment daily breakdowns
    const assignmentTotals = new Map<number, number>();
    const assignmentDaily = new Map<number, Map<string, number>>();

    for (const row of dedupRows) {
      const aId = row.assignmentId;
      const n = Number(row.deduplicated);
      assignmentTotals.set(aId, (assignmentTotals.get(aId) ?? 0) + n);
      if (!assignmentDaily.has(aId)) assignmentDaily.set(aId, new Map());
      assignmentDaily.get(aId)!.set(row.day, n);
    }

    const totalDeduplicated = Array.from(assignmentTotals.values()).reduce((s, v) => s + v, 0);
    const warnThreshold = await getDedupWarnThreshold();

    // Build client-level breakdown (sum across all assignments per bucket)
    const globalDailyMap = new Map<string, number>();
    for (const row of dedupRows) {
      globalDailyMap.set(row.day, (globalDailyMap.get(row.day) ?? 0) + Number(row.deduplicated));
    }
    const dailyBreakdown = bucketKeys.map((date) => ({ date, count: globalDailyMap.get(date) ?? 0 }));

  res.json({
    totalDeduplicated,
    windowDays,
    windowHours,
    windowUnit,
    breakdownUnit,
    warnThreshold,
    dailyBreakdown,
    perAssignment: assignmentIds.map((aId) => {
      const deduplicated = assignmentTotals.get(aId) ?? 0;
      return {
        assignmentId: aId,
        deduplicated,
        highDedupRate: deduplicated >= warnThreshold,
        dailyBreakdown: bucketKeys.map((date) => ({
          date,
          count: assignmentDaily.get(aId)?.get(date) ?? 0,
        })),
      };
    }).filter((r) => r.deduplicated > 0 || assignmentDaily.has(r.assignmentId)),
  });
});

// GET /assignments/:id/trigger
router.get("/assignments/:id/trigger", async (req, res): Promise<void> => {
  const params = GetAssignmentTriggerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trigger] = await db
    .select()
    .from(triggersTable)
    .where(eq(triggersTable.assignmentId, params.data.id))
    .limit(1);

  if (!trigger) {
    res.status(404).json({ error: "No trigger configured for this assignment" });
    return;
  }

  const events = await db
    .select()
    .from(triggerEventsTable)
    .where(eq(triggerEventsTable.triggerId, trigger.id))
    .orderBy(desc(triggerEventsTable.firedAt))
    .limit(10);

  res.json(formatTrigger(trigger, getWebhookBase(req as any), events));
});

// GET /assignments/:id/trigger/events — full history (newest first, default 20)
router.get("/assignments/:id/trigger/events", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid assignment id" }); return; }

  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);

  const [trigger] = await db
    .select()
    .from(triggersTable)
    .where(eq(triggersTable.assignmentId, id))
    .limit(1);

  if (!trigger) { res.status(404).json({ error: "No trigger configured for this assignment" }); return; }

  const events = await db
    .select()
    .from(triggerEventsTable)
    .where(eq(triggerEventsTable.triggerId, trigger.id))
    .orderBy(desc(triggerEventsTable.firedAt))
    .limit(limit);

  res.json(
    events.map((e) => ({
      id: e.id,
      triggerId: e.triggerId,
      assignmentId: e.assignmentId,
      payload: e.payload ? JSON.parse(e.payload) : null,
      agentStatus: e.agentStatus,
      agentOutput: e.agentOutput ?? null,
      firedAt: e.firedAt.toISOString(),
    })),
  );
});

// GET /clients/:id/trigger/events — all events across all assignments for a client (last 20)
router.get("/clients/:id/trigger/events", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.id, 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client id" }); return; }

  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);

  const events = await db
    .select({
      id: triggerEventsTable.id,
      triggerId: triggerEventsTable.triggerId,
      assignmentId: triggerEventsTable.assignmentId,
      payload: triggerEventsTable.payload,
      agentStatus: triggerEventsTable.agentStatus,
      firedAt: triggerEventsTable.firedAt,
      agentName: agentsTable.name,
    })
    .from(triggerEventsTable)
    .innerJoin(assignmentsTable, eq(triggerEventsTable.assignmentId, assignmentsTable.id))
    .innerJoin(agentsTable, eq(assignmentsTable.agentId, agentsTable.id))
    .where(eq(assignmentsTable.clientId, clientId))
    .orderBy(desc(triggerEventsTable.firedAt))
    .limit(limit);

  res.json(
    events.map((e) => ({
      id: e.id,
      triggerId: e.triggerId,
      assignmentId: e.assignmentId,
      payload: e.payload ? JSON.parse(e.payload) : null,
      agentStatus: e.agentStatus,
      firedAt: e.firedAt.toISOString(),
      agentName: e.agentName,
    })),
  );
});

// GET /clients/:id/trigger/stream — Server-Sent Events push channel.
// Emits a `trigger` event whenever any of this client's triggers fires or
// changes status, so the dashboard updates instantly with zero idle polling.
router.get("/clients/:id/trigger/stream", (req, res): void => {
  const clientId = parseInt(req.params.id, 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client id" }); return; }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  // Initial comment flushes headers and confirms the stream is open.
  res.write(": connected\n\n");

  const send = (e: TriggerBusEnvelope) =>
    res.write(`id: ${e.id}\nevent: trigger\ndata: ${JSON.stringify(e)}\n\n`);

  // Replay (below) may hit the DB asynchronously. Hold any live events that
  // arrive in the meantime so we don't write a newer id before older replayed
  // ones — that would leave the client's Last-Event-ID pointing backwards.
  let replayed = false;
  const pending: TriggerBusEnvelope[] = [];

  const unsubscribe = subscribeTriggerEvents((event) => {
    if (event.clientId !== clientId) return;
    if (!replayed) {
      pending.push(event);
      return;
    }
    send(event);
  });

  // Flush replayed events (oldest → newest), then any live events buffered
  // during replay whose id wasn't already covered by the backfill.
  const finishReplay = (missed: TriggerBusEnvelope[]) => {
    const maxReplayId = missed.length ? missed[missed.length - 1].id : -Infinity;
    for (const m of missed) send(m);
    for (const p of pending) if (p.id > maxReplayId) send(p);
    pending.length = 0;
    replayed = true;
  };

  // Replay any fires the client missed during a disconnect or while the server
  // was restarting. EventSource resends the last id it saw via Last-Event-ID;
  // getMissedEvents serves from the in-memory ring for brief drops and falls
  // back to the durable trigger_events table for gaps the ring can't cover.
  const lastEventIdHeader = req.headers["last-event-id"];
  const lastEventId = lastEventIdHeader ? parseInt(String(lastEventIdHeader), 10) : NaN;
  if (!isNaN(lastEventId)) {
    getMissedEvents(clientId, lastEventId)
      .then(finishReplay)
      .catch((err) => {
        console.error("[trigger-stream] replay backfill failed:", err);
        // Still flush live events so the stream keeps working after a DB hiccup.
        finishReplay([]);
      });
  } else {
    finishReplay([]);
  }

  // Heartbeat keeps proxies from closing an idle connection.
  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on("close", cleanup);
  res.on("close", cleanup);
});

// GET /trigger/stream — GLOBAL Server-Sent Events push channel.
// Emits a `trigger` event whenever ANY trigger anywhere in the system fires or
// changes status. Powers app-wide surfaces (Clients list, Dashboard activity
// feed, Logs page) so they update live regardless of which client fired.
router.get("/trigger/stream", (req, res): void => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  // Initial comment flushes headers and confirms the stream is open.
  res.write(": connected\n\n");

  const unsubscribe = subscribeTriggerEvents((event) => {
    res.write(`event: trigger\ndata: ${JSON.stringify(event)}\n\n`);
  });

  // Heartbeat keeps proxies from closing an idle connection.
  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on("close", cleanup);
  res.on("close", cleanup);
});

// POST /assignments/:id/trigger — create or regenerate
router.post("/assignments/:id/trigger", async (req, res): Promise<void> => {
  const params = CreateAssignmentTriggerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const assignmentId = params.data.id;

  // Verify assignment exists
  const [assignment] = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.id, assignmentId))
    .limit(1);

  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  const newSecret = randomUUID();

  // Upsert: delete existing then insert fresh
  await db.delete(triggersTable).where(eq(triggersTable.assignmentId, assignmentId));

  const [trigger] = await db
    .insert(triggersTable)
    .values({
      assignmentId,
      webhookSecret: newSecret,
      status: "idle",
    })
    .returning();

  // Log activity
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, assignment.agentId));
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, assignment.clientId));
  await db.insert(activityTable).values({
    type: "trigger_created",
    message: `Webhook trigger created for agent "${agent?.name ?? "?"}" on client "${client?.name ?? "?"}"`,
    entityType: "trigger",
    entityId: trigger.id,
  });

  res.json(formatTrigger(trigger, getWebhookBase(req as any)));
});

// GET /webhooks/trigger/:secret — read-only: returns current DB state for the
// client bound to this webhook (occupancy/permits) without triggering the agent.
router.get("/webhooks/trigger/:secret", async (req, res): Promise<void> => {
  const params = FireWebhookTriggerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trigger] = await db
    .select()
    .from(triggersTable)
    .where(eq(triggersTable.webhookSecret, params.data.secret))
    .limit(1);

  if (!trigger) {
    res.status(404).json({ error: "Unknown webhook secret" });
    return;
  }

  const [assignment] = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.id, trigger.assignmentId))
    .limit(1);

  const clientId = assignment?.clientId ?? 0;

  const [agent] = assignment
    ? await db.select().from(agentsTable).where(eq(agentsTable.id, assignment.agentId))
    : [undefined];
  const [client] = clientId
    ? await db.select().from(clientsTable).where(eq(clientsTable.id, clientId))
    : [undefined];

  const permits = clientId
    ? await db
        .select()
        .from(palgatePermitsTable)
        .where(eq(palgatePermitsTable.clientId, clientId))
        .orderBy(desc(palgatePermitsTable.checkIn))
        .limit(100)
    : [];

  const recentEvents = await db
    .select()
    .from(triggerEventsTable)
    .where(eq(triggerEventsTable.triggerId, trigger.id))
    .orderBy(desc(triggerEventsTable.firedAt))
    .limit(10);

  res.json({
    mode: "readonly",
    trigger: {
      id: trigger.id,
      status: trigger.status,
      lastFiredAt: trigger.lastFiredAt ? trigger.lastFiredAt.toISOString() : null,
      createdAt: trigger.createdAt.toISOString(),
    },
    client: client ? { id: client.id, name: client.name } : null,
    agent: agent ? { id: agent.id, name: agent.name } : null,
    currentData: {
      permitsCount: permits.length,
      permits: permits.map((p) => ({
        id: p.id,
        guestName: p.guestName,
        guestPhone: p.guestPhone,
        unitOrNote: p.unitOrNote,
        checkIn: p.checkIn,
        checkOut: p.checkOut,
        status: p.status,
        addedToGate: p.addedToGate ? p.addedToGate.toISOString() : null,
        removedFromGate: p.removedFromGate ? p.removedFromGate.toISOString() : null,
        notes: p.notes,
        createdAt: p.createdAt.toISOString(),
      })),
    },
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      agentStatus: e.agentStatus,
      firedAt: e.firedAt.toISOString(),
      agentOutput: e.agentOutput ?? null,
    })),
  });
});

// POST /webhooks/trigger/:secret — inbound webhook from client app
router.post("/webhooks/trigger/:secret", async (req, res): Promise<void> => {
  const params = FireWebhookTriggerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trigger] = await db
    .select()
    .from(triggersTable)
    .where(eq(triggersTable.webhookSecret, params.data.secret))
    .limit(1);

  if (!trigger) {
    res.status(404).json({ error: "Unknown webhook secret" });
    return;
  }

  // Idempotency guard: if a run is already in flight (triggered → running) for
  // this trigger, reject the new fire instead of launching a parallel agent
  // instance. Without this, two webhooks arriving before the first run finishes
  // would double-charge, duplicate actions, and confuse the activity log. This
  // covers runs that outlast the short time-based dedup window below.
  if (trigger.status === "triggered" || trigger.status === "running") {
    res.status(409).json({ error: "Agent already running, try again shortly" });
    return;
  }

  // Deduplication: reject if a trigger event was already recorded within the window
  const dedupWindowSeconds = parseInt(process.env.WEBHOOK_DEDUP_WINDOW_SECONDS ?? "10", 10);
  const dedupCutoff = new Date(Date.now() - dedupWindowSeconds * 1000);
  const [recentEvent] = await db
    .select()
    .from(triggerEventsTable)
    .where(
      and(
        eq(triggerEventsTable.triggerId, trigger.id),
        gte(triggerEventsTable.firedAt, dedupCutoff),
      ),
    )
    .limit(1);

  if (recentEvent) {
    // Log a deduplicated event so ops can audit suppressed retries
    const dedupPayload = JSON.stringify(req.body || {});
    const [dupEvent] = await db.insert(triggerEventsTable).values({
      triggerId: trigger.id,
      assignmentId: trigger.assignmentId,
      payload: dedupPayload,
      agentStatus: "deduplicated",
      firedAt: new Date(),
    }).returning({ id: triggerEventsTable.id });

    // Also surface it in the activity feed
    const [dupAssignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, trigger.assignmentId))
      .limit(1);
    const [dupAgent] = dupAssignment
      ? await db.select().from(agentsTable).where(eq(agentsTable.id, dupAssignment.agentId))
      : [undefined];
    const [dupClient] = dupAssignment
      ? await db.select().from(clientsTable).where(eq(clientsTable.id, dupAssignment.clientId))
      : [undefined];
    await db.insert(activityTable).values({
      type: "webhook_deduplicated",
      message: `Duplicate webhook suppressed for agent "${dupAgent?.name ?? "?"}" on client "${dupClient?.name ?? "?"}"`,
      entityType: "trigger",
      entityId: trigger.id,
    });

    if (dupClient) {
      publishTriggerEvent({
        id: dupEvent.id,
        clientId: dupClient.id,
        assignmentId: trigger.assignmentId,
        triggerId: trigger.id,
        agentStatus: "deduplicated",
        firedAt: new Date().toISOString(),
      });
    }

    res.json({ received: true, deduplicated: true });
    return;
  }

  const payload = req.body || {};

  const now = new Date();
  const payloadJson = JSON.stringify(payload);

  // Update trigger: triggered → running lifecycle
  await db
    .update(triggersTable)
    .set({
      status: "triggered",
      lastFiredAt: now,
      lastPayload: payloadJson,
    })
    .where(eq(triggersTable.id, trigger.id));

  // Insert trigger event record
  const [triggeredEvent] = await db.insert(triggerEventsTable).values({
    triggerId: trigger.id,
    assignmentId: trigger.assignmentId,
    payload: payloadJson,
    agentStatus: "triggered",
    firedAt: now,
  }).returning({ id: triggerEventsTable.id });

  // Look up assignment → agent + client (needed before spawning runner)
  const [assignment] = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.id, trigger.assignmentId))
    .limit(1);

  const agentId = assignment?.agentId ?? 0;
  const clientId = assignment?.clientId ?? 0;

  // Honor the "Automation Enabled" toggle — if the assignment is paused from the UI,
  // abort immediately: reset the trigger status to idle, skip Telegram, skip agent run.
  // Exception: journal-ingest still runs (data capture is independent of automation).
  if (assignment && !assignment.automationEnabled) {
    await db.update(triggersTable).set({ status: "idle" }).where(eq(triggersTable.id, trigger.id));
    // Mark the already-inserted event as skipped so the activity feed stays accurate
    await db
      .update(triggerEventsTable)
      .set({ agentStatus: "idle", agentOutput: "דולג — האוטומציה מושהית לשיוך זה" })
      .where(eq(triggerEventsTable.id, triggeredEvent.id));

    // Still run journal-ingest fire-and-forget even when automation is disabled —
    // data capture should always happen regardless of the automation toggle.
    if (agentId && clientId) {
      const [earlyAgent] = await db.select({ tags: agentsTable.tags }).from(agentsTable).where(eq(agentsTable.id, agentId)).limit(1);
      let earlyTags: string[] = [];
      try { earlyTags = JSON.parse(earlyAgent?.tags || "[]"); } catch { /* ignore */ }
      if (earlyTags.includes("journal-ingest")) {
        ingestPayloadToJournal(clientId, payload)
          .then((r) => { if (r.created > 0) console.log(`[journal-ingest] client ${clientId}: +${r.created} permits (${r.skipped} skipped)`); })
          .catch((err) => console.error("[journal-ingest] failed:", err instanceof Error ? err.message : err));
      }
    }

    res.json({ received: true, agentId, clientId, skipped: true, reason: "automation_disabled" });
    return;
  }

  const [agent] = agentId
    ? await db.select().from(agentsTable).where(eq(agentsTable.id, agentId))
    : [undefined];
  const [client] = clientId
    ? await db.select().from(clientsTable).where(eq(clientsTable.id, clientId))
    : [undefined];

  // Log initial webhook-received event to activity feed
  await db.insert(activityTable).values({
    type: "webhook_fired",
    message: `Webhook triggered for agent "${agent?.name ?? "?"}" on client "${client?.name ?? "?"}"`,
    entityType: "trigger",
    entityId: trigger.id,
  });

  // Send Telegram notification to ops team (fire-and-forget — never blocks response).
  // Skip entirely when the global "Webhook Triggered" notification toggle is OFF.
  getWebhookTelegramNotificationsEnabled()
    .then((enabled) => {
      if (!enabled) return;
      return notifyWebhookFired({
        clientName: client?.name ?? "לקוח לא ידוע",
        agentName: agent?.name ?? "סוכן לא ידוע",
        firedAt: now,
        payload,
      });
    })
    .catch(() => {});

  // Push to any subscribed dashboards so the new fire appears instantly.
  if (clientId) {
    publishTriggerEvent({
      id: triggeredEvent.id,
      clientId,
      assignmentId: trigger.assignmentId,
      triggerId: trigger.id,
      agentStatus: "triggered",
      firedAt: now.toISOString(),
    });
  }

  // Best-effort: ingest booking-like payloads into the structured journal
  // (palgate_permits) when the assignment's agent opts in via the "journal-ingest"
  // tag. Fully isolated fire-and-forget — never blocks or breaks the webhook flow.
  if (clientId && agent) {
    let ingestTags: string[] = [];
    try { ingestTags = JSON.parse(agent.tags || "[]"); } catch { /* ignore malformed tags */ }
    if (ingestTags.includes("journal-ingest")) {
      ingestPayloadToJournal(clientId, payload)
        .then((r) => {
          if (r.created > 0) {
            console.log(`[journal-ingest] client ${clientId}: +${r.created} permits (${r.skipped} skipped)`);
          }
        })
        .catch((err) => console.error("[journal-ingest] failed:", err instanceof Error ? err.message : err));
    }
  }

  // Fire-and-forget: actually run the agent with the incoming payload
  const triggerId = trigger.id;
  const assignmentIdVal = trigger.assignmentId;
  (async () => {
    const startMs = Date.now();
    let outputSummary = "";
    let fullReport = "";
    let errorMessage: string | undefined;
    let provider = "template";
    let model = "none";
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;

    try {
      // Transition: triggered → running (inside try/finally so idle reset always fires)
      await db.update(triggersTable).set({ status: "running" }).where(eq(triggersTable.id, triggerId));
      const [runningEvent] = await db.insert(triggerEventsTable).values({
        triggerId,
        assignmentId: assignmentIdVal,
        payload: payloadJson,
        agentStatus: "running",
      }).returning({ id: triggerEventsTable.id });
      if (clientId) {
        publishTriggerEvent({
          id: runningEvent.id,
          clientId,
          assignmentId: assignmentIdVal,
          triggerId,
          agentStatus: "running",
          firedAt: new Date().toISOString(),
        });
      }

      try {
        // Build a deterministic structured report — no LLM needed.
        // Sort: room → check-in date → guest name. No approval prompts.
        const clientName = client?.name ?? "לקוח";
        let cmp = null;
        let sheetDataForReport = null;
        const sheetUrl = agent?.inputSchema?.trim() || "";
        if (sheetUrl && sheetUrl.includes("docs.google.com/spreadsheets")) {
          try {
            const [sheetData, dbPermits] = await Promise.all([
              readSheet(sheetUrl),
              clientId
                ? db.select().from(palgatePermitsTable).where(eq(palgatePermitsTable.clientId, clientId))
                : Promise.resolve([]),
            ]);
            cmp = compareWithDb(sheetData, dbPermits);
            sheetDataForReport = sheetData;

            // Also send the legacy Telegram comparison report (fire-and-forget)
            const chatId = process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_CHAT_ID || "";
            if (chatId && process.env.NODE_ENV !== "test") {
              sendTelegramMessage(chatId, buildCompareReport(cmp, sheetData, clientName)).catch(() => {});
            }

            console.log(`[sheets-reader] client ${clientId}: ${sheetData.rows.length} rows | DB ${dbPermits.length} permits | matched ${cmp.matched.length} | sheet-only ${cmp.onlyInSheet.length} | db-only ${cmp.onlyInDb.length}`);
          } catch (sheetErr) {
            console.error("[sheets-reader] failed:", sheetErr instanceof Error ? sheetErr.message : sheetErr);
          }
        }

        // Deterministic, structured Hebrew report — full text in agentOutput, brief summary in agent_logs
        fullReport = buildWebhookReport(clientName, payload, cmp, sheetDataForReport);
        outputSummary = fullReport.slice(0, 500);
        provider = "deterministic";
        model = "none";
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[trigger-runner] agent execution failed:", errorMessage);
      }

      const durationMs = Date.now() - startMs;

      // Log to agent_logs
      await db.insert(agentLogsTable).values({
        source: "trigger",
        agentId: agent?.id ?? null,
        agentName: agent?.name ?? null,
        clientId: client?.id ?? null,
        eventType: errorMessage ? "error" : "response",
        status: errorMessage ? "error" : "success",
        inputSummary: `Webhook trigger payload: ${payloadJson.slice(0, 500)}`,
        outputSummary: outputSummary || null,
        provider,
        model,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        durationMs,
        errorMessage: errorMessage ?? null,
        metadata: JSON.stringify({ triggerId, assignmentId: assignmentIdVal }),
      });

      // Log run outcome to activity feed
      const outcomeMsg = errorMessage
        ? `Agent "${agent?.name ?? "?"}" failed on webhook trigger for client "${client?.name ?? "?"}": ${errorMessage}`
        : `Agent "${agent?.name ?? "?"}" completed webhook run for client "${client?.name ?? "?"}": ${outputSummary || "(no output)"}`;
      await db.insert(activityTable).values({
        type: "agent_run",
        message: outcomeMsg,
        entityType: "trigger",
        entityId: triggerId,
      });
    } finally {
      // Always reset trigger back to idle — even if the running transition or logging failed
      try {
        await db.update(triggersTable).set({ status: "idle" }).where(eq(triggersTable.id, triggerId));
        const [idleEvent] = await db.insert(triggerEventsTable).values({
          triggerId,
          assignmentId: assignmentIdVal,
          payload: null,
          agentStatus: "idle",
          agentOutput: fullReport || outputSummary || null,
        }).returning({ id: triggerEventsTable.id });
        if (clientId) {
          publishTriggerEvent({
            id: idleEvent.id,
            clientId,
            assignmentId: assignmentIdVal,
            triggerId,
            agentStatus: "idle",
            firedAt: new Date().toISOString(),
          });
        }
      } catch (finallyErr) {
        console.error("[trigger-runner] failed to reset trigger status to idle:", finallyErr);
      }
    }
  })().catch((err) => {
    console.error("[trigger-runner] unhandled error in fire-and-forget:", err);
  });

  res.json({ received: true, agentId, clientId });
});

export default router;
