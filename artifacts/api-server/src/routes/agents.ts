import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, agentsTable, activityTable } from "@workspace/db";
import {
  ListAgentsQueryParams,
  CreateAgentBody,
  GetAgentParams,
  UpdateAgentParams,
  UpdateAgentBody,
  DeleteAgentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeAgent(a: typeof agentsTable.$inferSelect) {
  return {
    ...a,
    capabilities: JSON.parse(a.capabilities || "[]"),
    tags: JSON.parse(a.tags || "[]"),
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/agents", async (req, res): Promise<void> => {
  const query = ListAgentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const agents = await db.select().from(agentsTable).orderBy(agentsTable.createdAt);

  const filtered = agents.filter((a) => {
    if (query.data.category && a.category !== query.data.category) return false;
    if (query.data.status && a.status !== query.data.status) return false;
    return true;
  });

  res.json(filtered.map(serializeAgent));
});

router.post("/agents", async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { capabilities, tags, ...rest } = parsed.data;
  const [agent] = await db
    .insert(agentsTable)
    .values({
      ...rest,
      capabilities: JSON.stringify(capabilities ?? []),
      tags: JSON.stringify(tags ?? []),
    })
    .returning();

  await db.insert(activityTable).values({
    type: "agent_created",
    message: `Agent "${agent.name}" was created`,
    entityType: "agent",
    entityId: agent.id,
  });

  res.status(201).json(serializeAgent(agent));
});

router.get("/agents/categories", async (_req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable);
  const categoryMap: Record<string, { count: number; activeCount: number }> = {};

  for (const a of agents) {
    if (!categoryMap[a.category]) {
      categoryMap[a.category] = { count: 0, activeCount: 0 };
    }
    categoryMap[a.category].count++;
    if (a.status === "active") categoryMap[a.category].activeCount++;
  }

  const result = Object.entries(categoryMap).map(([category, counts]) => ({
    category,
    ...counts,
  }));

  res.json(result);
});

router.get("/agents/:id", async (req, res): Promise<void> => {
  const params = GetAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, params.data.id));

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(serializeAgent(agent));
});

router.patch("/agents/:id", async (req, res): Promise<void> => {
  const params = UpdateAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { capabilities, tags, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (capabilities !== undefined) {
    updateData.capabilities = JSON.stringify(capabilities);
  }
  if (tags !== undefined) {
    updateData.tags = JSON.stringify(tags);
  }

  const [agent] = await db
    .update(agentsTable)
    .set(updateData)
    .where(eq(agentsTable.id, params.data.id))
    .returning();

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(serializeAgent(agent));
});

router.delete("/agents/:id", async (req, res): Promise<void> => {
  const params = DeleteAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(agentsTable).where(eq(agentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
