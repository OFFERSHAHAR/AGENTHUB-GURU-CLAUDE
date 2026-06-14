import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, orchestratorsTable } from "@workspace/db";
import {
  GetOrchestratorParams,
  UpsertOrchestratorParams,
  UpsertOrchestratorBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/clients/:id/orchestrator", async (req, res): Promise<void> => {
  const params = GetOrchestratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [config] = await db
    .select()
    .from(orchestratorsTable)
    .where(eq(orchestratorsTable.clientId, params.data.id));

  if (!config) {
    res.status(404).json({ error: "Orchestrator config not found" });
    return;
  }

  res.json({ ...config, updatedAt: config.updatedAt.toISOString() });
});

router.put("/clients/:id/orchestrator", async (req, res): Promise<void> => {
  const params = UpsertOrchestratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpsertOrchestratorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(orchestratorsTable)
    .where(eq(orchestratorsTable.clientId, params.data.id));

  let config;
  if (existing.length > 0) {
    const [updated] = await db
      .update(orchestratorsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(orchestratorsTable.clientId, params.data.id))
      .returning();
    config = updated;
  } else {
    const [created] = await db
      .insert(orchestratorsTable)
      .values({ clientId: params.data.id, ...parsed.data })
      .returning();
    config = created;
  }

  res.json({ ...config, updatedAt: config.updatedAt.toISOString() });
});

export default router;
