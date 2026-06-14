import { Router, type IRouter } from "express";
import { eq, and, inArray, gte, sql, count } from "drizzle-orm";
import {
  db,
  clientsTable,
  activityTable,
  assignmentsTable,
  agentsTable,
  triggerEventsTable,
  agentLogsTable,
} from "@workspace/db";
import {
  CreateClientBody,
  GetClientParams,
  UpdateClientParams,
  UpdateClientBody,
  DeleteClientParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const REPORT_WINDOW_DAYS = 30;

router.get("/clients", async (_req, res): Promise<void> => {
  const clients = await db.select().from(clientsTable).orderBy(clientsTable.createdAt);

  res.json(
    clients.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    }))
  );
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [client] = await db.insert(clientsTable).values(parsed.data).returning();

  await db.insert(activityTable).values({
    type: "client_created",
    message: `Client "${client.name}" was onboarded`,
    entityType: "client",
    entityId: client.id,
  });

  res.status(201).json({ ...client, createdAt: client.createdAt.toISOString() });
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, params.data.id));

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  res.json({ ...client, createdAt: client.createdAt.toISOString() });
});

// GET /clients/:id/report — per-client usage & performance report.
// Aggregates real agent activity from trigger_events over the last 30 days,
// joined through this client's assignments. Each processed webhook fire is
// recorded as a "triggered" event (the running/idle lifecycle rows and any
// "deduplicated" suppressions are excluded so the count reflects actual tasks).
router.get("/clients/:id/report", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.id, 10);
  if (isNaN(clientId)) {
    res.status(400).json({ error: "Invalid client id" });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, clientId));

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  // Build the calendar-day strings (UTC) spanned by the window for zero-filling.
  const windowDayStrings = Array.from({ length: REPORT_WINDOW_DAYS }, (_, i) => {
    const d = new Date(Date.now() - (REPORT_WINDOW_DAYS - 1 - i) * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const windowStart = new Date(
    Date.now() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // All assignments for this client, with the deployed agent's display fields.
  const assignments = await db
    .select({
      assignmentId: assignmentsTable.id,
      agentId: agentsTable.id,
      agentName: agentsTable.name,
      category: agentsTable.category,
      iconEmoji: agentsTable.iconEmoji,
      status: assignmentsTable.status,
    })
    .from(assignmentsTable)
    .innerJoin(agentsTable, eq(assignmentsTable.agentId, agentsTable.id))
    .where(eq(assignmentsTable.clientId, clientId));

  const emptyDaily = () => windowDayStrings.map((date) => ({ date, count: 0 }));

  if (assignments.length === 0) {
    res.json({
      clientId,
      clientName: client.name,
      windowDays: REPORT_WINDOW_DAYS,
      generatedAt: new Date().toISOString(),
      totalTasks: 0,
      totalSuccess: 0,
      totalFailure: 0,
      agents: [],
      dailyTotals: emptyDaily(),
    });
    return;
  }

  const assignmentIds = assignments.map((a) => a.assignmentId);

  // Per-assignment, per-day count of real (processed) fires in the window.
  const volumeRows = await db
    .select({
      assignmentId: triggerEventsTable.assignmentId,
      day: sql<string>`DATE(${triggerEventsTable.firedAt})`.as("day"),
      tasks: count(),
    })
    .from(triggerEventsTable)
    .where(
      and(
        inArray(triggerEventsTable.assignmentId, assignmentIds),
        eq(triggerEventsTable.agentStatus, "triggered"),
        gte(triggerEventsTable.firedAt, windowStart),
      ),
    )
    .groupBy(triggerEventsTable.assignmentId, sql`DATE(${triggerEventsTable.firedAt})`);

  // Last activity (any event, including running/idle) per assignment in window.
  const lastActiveRows = await db
    .select({
      assignmentId: triggerEventsTable.assignmentId,
      lastActive: sql<string>`MAX(${triggerEventsTable.firedAt})`.as("last_active"),
    })
    .from(triggerEventsTable)
    .where(
      and(
        inArray(triggerEventsTable.assignmentId, assignmentIds),
        gte(triggerEventsTable.firedAt, windowStart),
      ),
    )
    .groupBy(triggerEventsTable.assignmentId);

  const lastActiveMap = new Map<number, string>();
  for (const row of lastActiveRows) {
    if (row.lastActive) {
      lastActiveMap.set(row.assignmentId, new Date(row.lastActive).toISOString());
    }
  }

  // Real task outcomes for this client from agent_logs (status success/error),
  // grouped per agent. This turns raw task volume into a success/failure story.
  const outcomeRows = await db
    .select({
      agentId: agentLogsTable.agentId,
      status: agentLogsTable.status,
      cnt: count(),
    })
    .from(agentLogsTable)
    .where(
      and(
        eq(agentLogsTable.clientId, clientId),
        inArray(agentLogsTable.status, ["success", "error"]),
        gte(agentLogsTable.timestamp, windowStart),
      ),
    )
    .groupBy(agentLogsTable.agentId, agentLogsTable.status);

  // agentId → { success, failure } (rows with no agentId still count toward
  // the client-wide totals below, but cannot be attributed to an agent row).
  const outcomeByAgent = new Map<number, { success: number; failure: number }>();
  let totalSuccess = 0;
  let totalFailure = 0;
  for (const row of outcomeRows) {
    const n = Number(row.cnt);
    if (row.status === "success") totalSuccess += n;
    else if (row.status === "error") totalFailure += n;

    if (row.agentId == null) continue;
    const entry = outcomeByAgent.get(row.agentId) ?? { success: 0, failure: 0 };
    if (row.status === "success") entry.success += n;
    else if (row.status === "error") entry.failure += n;
    outcomeByAgent.set(row.agentId, entry);
  }

  // assignmentId → (day → count)
  const dailyByAssignment = new Map<number, Map<string, number>>();
  for (const row of volumeRows) {
    if (!dailyByAssignment.has(row.assignmentId)) {
      dailyByAssignment.set(row.assignmentId, new Map());
    }
    dailyByAssignment.get(row.assignmentId)!.set(row.day, Number(row.tasks));
  }

  // Client-level daily totals (sum across assignments per day).
  const globalDaily = new Map<string, number>();
  for (const row of volumeRows) {
    globalDaily.set(row.day, (globalDaily.get(row.day) ?? 0) + Number(row.tasks));
  }

  const agents = assignments
    .map((a) => {
      const daily = dailyByAssignment.get(a.assignmentId);
      const dailyVolume = windowDayStrings.map((date) => ({
        date,
        count: daily?.get(date) ?? 0,
      }));
      const tasksHandled = dailyVolume.reduce((s, d) => s + d.count, 0);
      const outcome = outcomeByAgent.get(a.agentId) ?? { success: 0, failure: 0 };
      return {
        assignmentId: a.assignmentId,
        agentId: a.agentId,
        agentName: a.agentName,
        category: a.category,
        iconEmoji: a.iconEmoji ?? null,
        status: a.status,
        tasksHandled,
        successCount: outcome.success,
        failureCount: outcome.failure,
        lastActive: lastActiveMap.get(a.assignmentId) ?? null,
        dailyVolume,
      };
    })
    .sort((x, y) => y.tasksHandled - x.tasksHandled);

  const totalTasks = agents.reduce((s, a) => s + a.tasksHandled, 0);

  res.json({
    clientId,
    clientName: client.name,
    windowDays: REPORT_WINDOW_DAYS,
    generatedAt: new Date().toISOString(),
    totalTasks,
    totalSuccess,
    totalFailure,
    agents,
    dailyTotals: windowDayStrings.map((date) => ({
      date,
      count: globalDaily.get(date) ?? 0,
    })),
  });
});

router.patch("/clients/:id", async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [client] = await db
    .update(clientsTable)
    .set(parsed.data)
    .where(eq(clientsTable.id, params.data.id))
    .returning();

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  res.json({ ...client, createdAt: client.createdAt.toISOString() });
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(clientsTable).where(eq(clientsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
