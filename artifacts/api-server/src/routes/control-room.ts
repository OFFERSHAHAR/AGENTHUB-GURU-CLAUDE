import { Router, type IRouter } from "express";
import { desc, sql, eq, gte, count } from "drizzle-orm";
import {
  db,
  clientsTable,
  agentsTable,
  assignmentsTable,
  triggerEventsTable,
  triggersTable,
  activityTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/control-room/stats", async (_req, res): Promise<void> => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

  const [clients, agents, recentEvents, recentActivity, agentDeployments] =
    await Promise.all([
      db.select().from(clientsTable).orderBy(clientsTable.name),

      db.select().from(agentsTable).orderBy(agentsTable.name),

      // Last 30 trigger events with assignment → client/agent info
      db
        .select({
          id: triggerEventsTable.id,
          firedAt: triggerEventsTable.firedAt,
          agentStatus: triggerEventsTable.agentStatus,
          assignmentId: triggerEventsTable.assignmentId,
          agentOutput: triggerEventsTable.agentOutput,
          clientId: assignmentsTable.clientId,
          agentId: assignmentsTable.agentId,
          clientName: clientsTable.name,
          agentName: agentsTable.name,
        })
        .from(triggerEventsTable)
        .innerJoin(assignmentsTable, eq(triggerEventsTable.assignmentId, assignmentsTable.id))
        .innerJoin(clientsTable, eq(assignmentsTable.clientId, clientsTable.id))
        .innerJoin(agentsTable, eq(assignmentsTable.agentId, agentsTable.id))
        .orderBy(desc(triggerEventsTable.firedAt))
        .limit(40),

      // Recent activity log
      db
        .select()
        .from(activityTable)
        .orderBy(desc(activityTable.createdAt))
        .limit(20),

      // Per-agent: deployment count + recent events
      db
        .select({
          agentId: assignmentsTable.agentId,
          clientCount: count(assignmentsTable.clientId),
          eventCount: sql<number>`cast(count(${triggerEventsTable.id}) as int)`,
          lastFiredAt: sql<Date | null>`max(${triggerEventsTable.firedAt})`,
        })
        .from(assignmentsTable)
        .leftJoin(triggerEventsTable, eq(triggerEventsTable.assignmentId, assignmentsTable.id))
        .groupBy(assignmentsTable.agentId),
    ]);

  // Per-client: last trigger event
  const clientEventMap = new Map<number, { lastFiredAt: Date | null; eventCount: number }>();
  for (const ev of recentEvents) {
    const existing = clientEventMap.get(ev.clientId);
    if (!existing) {
      clientEventMap.set(ev.clientId, { lastFiredAt: ev.firedAt, eventCount: 1 });
    } else {
      existing.eventCount += 1;
      if (ev.firedAt > (existing.lastFiredAt ?? new Date(0))) {
        existing.lastFiredAt = ev.firedAt;
      }
    }
  }

  // Per-agent: merge deployment stats
  const agentStatsMap = new Map<number, { clientCount: number; eventCount: number; lastFiredAt: Date | null }>();
  for (const row of agentDeployments) {
    agentStatsMap.set(row.agentId, {
      clientCount: Number(row.clientCount),
      eventCount: Number(row.eventCount),
      lastFiredAt: row.lastFiredAt ? new Date(row.lastFiredAt) : null,
    });
  }

  const now = Date.now();

  res.json({
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    clients: clients.map((c) => {
      const stats = clientEventMap.get(c.id);
      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        lastFiredAt: stats?.lastFiredAt?.toISOString() ?? null,
        recentEventCount: stats?.eventCount ?? 0,
      };
    }),
    agents: agents.map((a) => {
      const stats = agentStatsMap.get(a.id);
      return {
        id: a.id,
        name: a.name,
        category: a.category,
        status: a.status,
        iconEmoji: a.iconEmoji,
        tags: a.tags,
        clientCount: stats?.clientCount ?? 0,
        recentEventCount: stats?.eventCount ?? 0,
        lastFiredAt: stats?.lastFiredAt?.toISOString() ?? null,
      };
    }),
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      firedAt: e.firedAt.toISOString(),
      agentStatus: e.agentStatus,
      clientId: e.clientId,
      clientName: e.clientName,
      agentId: e.agentId,
      agentName: e.agentName,
      agentOutput: e.agentOutput,
    })),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

export default router;
