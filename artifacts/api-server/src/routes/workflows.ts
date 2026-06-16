import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, workflowsTable } from "@workspace/db";
import {
  CreateWorkflowBody,
  UpdateWorkflowBody,
  UpdateWorkflowParams,
  DeleteWorkflowParams,
  GetWorkflowParams,
} from "@workspace/api-zod";
import { runWorkflow, type WFNode, type WFEdge } from "../services/workflow-engine.js";

const router: IRouter = Router();

const IdParam = GetWorkflowParams;

function serializeWorkflow(w: typeof workflowsTable.$inferSelect) {
  return {
    ...w,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

router.get("/workflows", async (_req, res): Promise<void> => {
  const workflows = await db.select().from(workflowsTable).orderBy(workflowsTable.createdAt);
  res.json(workflows.map(serializeWorkflow));
});

router.post("/workflows", async (req, res): Promise<void> => {
  const parsed = CreateWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [workflow] = await db
    .insert(workflowsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.status ?? "draft",
      nodes: parsed.data.nodes ?? "[]",
      edges: parsed.data.edges ?? "[]",
    })
    .returning();

  res.status(201).json(serializeWorkflow(workflow));
});

router.get("/workflows/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [workflow] = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.id, params.data.id));

  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  res.json(serializeWorkflow(workflow));
});

router.patch("/workflows/:id", async (req, res): Promise<void> => {
  const params = UpdateWorkflowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [workflow] = await db
    .update(workflowsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(workflowsTable.id, params.data.id))
    .returning();

  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  res.json(serializeWorkflow(workflow));
});

// Execute a workflow for real (bounded). Body: { input?: object }.
router.post("/workflows/:id/run", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [workflow] = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.id, params.data.id));

  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  let nodes: WFNode[] = [];
  let edges: WFEdge[] = [];
  try {
    nodes = JSON.parse(workflow.nodes || "[]");
    edges = JSON.parse(workflow.edges || "[]");
  } catch {
    res.status(400).json({ error: "Workflow graph is corrupt (invalid JSON in nodes/edges)" });
    return;
  }
  if (!Array.isArray(nodes) || nodes.length === 0) {
    res.status(400).json({ error: "ל-workflow אין צמתים להרצה" });
    return;
  }

  try {
    const input = req.body && typeof req.body.input === "object" ? req.body.input : undefined;
    const run = await runWorkflow(nodes, edges, input);
    res.json({ workflowId: workflow.id, name: workflow.name, ...run });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/workflows/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkflowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(workflowsTable).where(eq(workflowsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
