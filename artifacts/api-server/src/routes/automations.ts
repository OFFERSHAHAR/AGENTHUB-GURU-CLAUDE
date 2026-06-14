import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, assignmentsTable, agentsTable, automationLogsTable, agentLogsTable } from "@workspace/db";
import { parseGuardrails } from "../services/guardrails.js";
import {
  ToggleAutomationBody,
  ToggleAutomationParams,
  DisableAllAutomationsParams,
  DisableAllAutomationsBody,
  ListAutomationLogsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatLog(l: typeof automationLogsTable.$inferSelect) {
  return {
    ...l,
    createdAt: l.createdAt.toISOString(),
  };
}

async function captureLastErrors(assignmentId: number, agentId: number): Promise<string | null> {
  try {
    const errors = await db
      .select()
      .from(agentLogsTable)
      .where(
        and(
          eq(agentLogsTable.agentId, agentId),
          eq(agentLogsTable.status, "error"),
        )
      )
      .orderBy(desc(agentLogsTable.timestamp))
      .limit(5);

    if (errors.length === 0) return null;
    return JSON.stringify(
      errors.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        errorMessage: e.errorMessage,
        inputSummary: e.inputSummary,
        timestamp: e.timestamp?.toISOString(),
      }))
    );
  } catch {
    return null;
  }
}

// PATCH /assignments/:id/automation — toggle single automation
router.patch("/assignments/:id/automation", async (req, res): Promise<void> => {
  const params = ToggleAutomationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = ToggleAutomationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { enabled, disabledBy = "Ops Admin", reason } = parsed.data;

  const [assignment] = await db
    .update(assignmentsTable)
    .set({ automationEnabled: enabled })
    .where(eq(assignmentsTable.id, params.data.id))
    .returning();

  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, assignment.agentId));

  const lastErrors = !enabled ? await captureLastErrors(assignment.id, assignment.agentId) : null;

  await db.insert(automationLogsTable).values({
    assignmentId: assignment.id,
    clientId: assignment.clientId,
    agentId: assignment.agentId,
    action: enabled ? "enabled" : "disabled",
    disabledBy,
    reason: reason || null,
    lastErrors,
  });

  res.json({
    ...assignment,
    deployedAt: assignment.deployedAt ? assignment.deployedAt.toISOString() : null,
    createdAt: assignment.createdAt.toISOString(),
    agent: agent
      ? { ...agent, capabilities: JSON.parse(agent.capabilities || "[]"), createdAt: agent.createdAt.toISOString() }
      : undefined,
  });
});

// POST /clients/:id/automations/disable-all — master kill switch
router.post("/clients/:id/automations/disable-all", async (req, res): Promise<void> => {
  const params = DisableAllAutomationsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = DisableAllAutomationsBody.safeParse(req.body || {});
  const disabledBy = parsed.success ? (parsed.data.disabledBy || "Ops Admin") : "Ops Admin";
  const reason = parsed.success ? parsed.data.reason : undefined;

  const assignments = await db
    .select()
    .from(assignmentsTable)
    .where(and(eq(assignmentsTable.clientId, params.data.id), eq(assignmentsTable.automationEnabled, true)));

  if (assignments.length === 0) { res.json({ disabled: 0 }); return; }

  await db
    .update(assignmentsTable)
    .set({ automationEnabled: false })
    .where(eq(assignmentsTable.clientId, params.data.id));

  await Promise.all(
    assignments.map(async (a) => {
      const lastErrors = await captureLastErrors(a.id, a.agentId);
      return db.insert(automationLogsTable).values({
        assignmentId: a.id,
        clientId: a.clientId,
        agentId: a.agentId,
        action: "disabled_all",
        disabledBy,
        reason: reason || null,
        lastErrors,
      });
    })
  );

  res.json({ disabled: assignments.length });
});

// GET /clients/:id/automation-logs
router.get("/clients/:id/automation-logs", async (req, res): Promise<void> => {
  const params = ListAutomationLogsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const logs = await db
    .select()
    .from(automationLogsTable)
    .where(eq(automationLogsTable.clientId, params.data.id))
    .orderBy(desc(automationLogsTable.createdAt))
    .limit(50);

  res.json(logs.map(formatLog));
});

// GET /assignments/:id/guardrails
router.get("/assignments/:id/guardrails", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [a] = await db.select({ guardrails: assignmentsTable.guardrails })
    .from(assignmentsTable).where(eq(assignmentsTable.id, id)).limit(1);
  if (!a) { res.status(404).json({ error: "Assignment not found" }); return; }
  res.json({ rules: parseGuardrails(a.guardrails) });
});

// PATCH /assignments/:id/guardrails
router.patch("/assignments/:id/guardrails", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { rules } = req.body ?? {};
  if (!Array.isArray(rules)) { res.status(400).json({ error: "rules must be an array" }); return; }
  const [a] = await db.update(assignmentsTable)
    .set({ guardrails: JSON.stringify(rules) })
    .where(eq(assignmentsTable.id, id))
    .returning({ id: assignmentsTable.id });
  if (!a) { res.status(404).json({ error: "Assignment not found" }); return; }
  res.json({ ok: true, rules });
});

export default router;
