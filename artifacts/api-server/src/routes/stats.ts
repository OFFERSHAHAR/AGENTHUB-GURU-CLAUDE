import { Router, type IRouter } from "express";
import { db, agentsTable, clientsTable, assignmentsTable, activityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const [agents, clients, assignments] = await Promise.all([
    db.select().from(agentsTable),
    db.select().from(clientsTable),
    db.select().from(assignmentsTable),
  ]);

  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status === "active").length;
  const totalDeployments = assignments.length;

  const categoryMap: Record<string, { count: number; activeCount: number }> = {};
  for (const a of agents) {
    if (!categoryMap[a.category]) {
      categoryMap[a.category] = { count: 0, activeCount: 0 };
    }
    categoryMap[a.category].count++;
    if (a.status === "active") categoryMap[a.category].activeCount++;
  }

  const categoryCounts = Object.entries(categoryMap).map(([category, counts]) => ({
    category,
    ...counts,
  }));

  res.json({
    totalAgents,
    activeAgents,
    totalClients,
    activeClients,
    totalDeployments,
    categoryCounts,
  });
});

router.get("/activity/recent", async (req, res): Promise<void> => {
  const query = ListRecentActivityQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 20;

  const events = await db
    .select()
    .from(activityTable)
    .orderBy(activityTable.createdAt)
    .limit(limit);

  res.json(
    events.reverse().map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    }))
  );
});

export default router;
