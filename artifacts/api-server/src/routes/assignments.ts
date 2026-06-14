import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, assignmentsTable, agentsTable, clientsTable, activityTable } from "@workspace/db";
import {
  ListClientAssignmentsParams,
  CreateAssignmentParams,
  CreateAssignmentBody,
  UpdateAssignmentParams,
  UpdateAssignmentBody,
  RemoveAssignmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatAssignment(a: typeof assignmentsTable.$inferSelect, agent?: typeof agentsTable.$inferSelect) {
  return {
    ...a,
    deployedAt: a.deployedAt ? a.deployedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    agent: agent
      ? {
          ...agent,
          capabilities: JSON.parse(agent.capabilities || "[]"),
          createdAt: agent.createdAt.toISOString(),
        }
      : undefined,
  };
}

router.get("/clients/:id/assignments", async (req, res): Promise<void> => {
  const params = ListClientAssignmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const assignments = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.clientId, params.data.id))
    .orderBy(assignmentsTable.createdAt);

  const result = await Promise.all(
    assignments.map(async (a) => {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, a.agentId));
      return formatAssignment(a, agent);
    })
  );

  res.json(result);
});

router.post("/clients/:id/assignments", async (req, res): Promise<void> => {
  const params = CreateAssignmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [assignment] = await db
    .insert(assignmentsTable)
    .values({ clientId: params.data.id, ...parsed.data })
    .returning();

  // Update agent deployed count
  await db
    .update(agentsTable)
    .set({ deployedCount: db.$count(assignmentsTable, eq(assignmentsTable.agentId, parsed.data.agentId)) as unknown as number })
    .where(eq(agentsTable.id, parsed.data.agentId));

  // Update client agent count
  const assignmentCount = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.clientId, params.data.id));
  await db
    .update(clientsTable)
    .set({ agentCount: assignmentCount.length })
    .where(eq(clientsTable.id, params.data.id));

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, parsed.data.agentId));

  if (agent) {
    await db.insert(activityTable).values({
      type: "agent_assigned",
      message: `Agent "${agent.name}" assigned to client`,
      entityType: "assignment",
      entityId: assignment.id,
    });
  }

  res.status(201).json(formatAssignment(assignment, agent));
});

router.patch("/clients/:id/assignments/:agentId", async (req, res): Promise<void> => {
  const params = UpdateAssignmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.customization !== undefined) updateData.customization = parsed.data.customization;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.deployedAt !== undefined) updateData.deployedAt = new Date(parsed.data.deployedAt);

  const [assignment] = await db
    .update(assignmentsTable)
    .set(updateData)
    .where(
      and(
        eq(assignmentsTable.clientId, params.data.id),
        eq(assignmentsTable.agentId, params.data.agentId)
      )
    )
    .returning();

  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, assignment.agentId));
  res.json(formatAssignment(assignment, agent));
});

router.delete("/clients/:id/assignments/:agentId", async (req, res): Promise<void> => {
  const params = RemoveAssignmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(assignmentsTable)
    .where(
      and(
        eq(assignmentsTable.clientId, params.data.id),
        eq(assignmentsTable.agentId, params.data.agentId)
      )
    );

  // Update client agent count
  const remaining = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.clientId, params.data.id));
  await db
    .update(clientsTable)
    .set({ agentCount: remaining.length })
    .where(eq(clientsTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
