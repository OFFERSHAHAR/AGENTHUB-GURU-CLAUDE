import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db, rpaConnectorsTable, optimaSyncApprovalsTable } from "@workspace/db";
import {
  runSyncForConnector,
  approveAndApply,
  cancelApproval,
  readAutoSync,
  writeAutoSync,
  loginConnector,
  connectorSession,
} from "../services/optima-sync.js";

const router: IRouter = Router();

// GET /optima-sync/approvals?status=pending&connectorId=1
router.get("/optima-sync/approvals", async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const connectorId = req.query.connectorId ? Number(req.query.connectorId) : null;

  const conditions = [];
  if (status) conditions.push(eq(optimaSyncApprovalsTable.status, status));
  if (connectorId) conditions.push(eq(optimaSyncApprovalsTable.connectorId, connectorId));

  const rows = await db
    .select()
    .from(optimaSyncApprovalsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(optimaSyncApprovalsTable.createdAt))
    .limit(50);

  // Strip the heavy data payloads from the list view.
  res.json(rows.map((r) => ({
    ...r,
    proposedData: undefined,
    previousData: undefined,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    appliedAt: r.appliedAt?.toISOString() ?? null,
  })));
});

// POST /optima-sync/run/:connectorId — run a sync now (creates a pending approval)
router.post("/optima-sync/run/:connectorId", async (req, res): Promise<void> => {
  const connectorId = Number(req.params.connectorId);
  if (!Number.isFinite(connectorId)) {
    res.status(400).json({ error: "connectorId לא תקין" });
    return;
  }
  // notify=false (skip the Telegram message) is a dev/testing escape hatch only.
  // In production every run must send the approval message first.
  const notify = process.env.NODE_ENV === "production" ? true : req.query.notify !== "false";
  // Manual runs are attended: they reuse the live session the operator
  // established by signing in herself, and never auto-login with stored
  // credentials (which 2FA blocks).
  const result = await runSyncForConnector(connectorId, { triggeredBy: "manual", notify, attended: true });
  res.json(result);
});

// GET /optima-sync/session/:connectorId — is there a live signed-in Optima session?
router.get("/optima-sync/session/:connectorId", async (req, res): Promise<void> => {
  const connectorId = Number(req.params.connectorId);
  if (!Number.isFinite(connectorId)) {
    res.status(400).json({ error: "connectorId לא תקין" });
    return;
  }
  res.json(connectorSession(connectorId));
});

// POST /optima-sync/login/:connectorId — attended sign-in (optional one-time { code })
router.post("/optima-sync/login/:connectorId", async (req, res): Promise<void> => {
  const connectorId = Number(req.params.connectorId);
  if (!Number.isFinite(connectorId)) {
    res.status(400).json({ error: "connectorId לא תקין" });
    return;
  }
  const code = typeof req.body?.code === "string" && req.body.code.trim() ? req.body.code.trim() : undefined;
  const result = await loginConnector(connectorId, code);
  res.json(result);
});

// POST /optima-sync/approvals/:id/approve
router.post("/optima-sync/approvals/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const decidedBy = typeof req.body?.decidedBy === "string" ? req.body.decidedBy : "ממשק AgentHub";
  const result = await approveAndApply(id, decidedBy);
  if (!result.ok) { res.status(409).json(result); return; }
  res.json(result);
});

// POST /optima-sync/approvals/:id/cancel
router.post("/optima-sync/approvals/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const decidedBy = typeof req.body?.decidedBy === "string" ? req.body.decidedBy : "ממשק AgentHub";
  const result = await cancelApproval(id, decidedBy);
  if (!result.ok) { res.status(409).json(result); return; }
  res.json(result);
});

// GET /optima-sync/config/:connectorId — read the auto-sync schedule config
router.get("/optima-sync/config/:connectorId", async (req, res): Promise<void> => {
  const connectorId = Number(req.params.connectorId);
  const [conn] = await db
    .select()
    .from(rpaConnectorsTable)
    .where(eq(rpaConnectorsTable.id, connectorId))
    .limit(1);
  if (!conn) { res.status(404).json({ error: "מחבר לא נמצא" }); return; }
  res.json(readAutoSync(conn.metadata));
});

// PUT /optima-sync/config/:connectorId — enable/disable the every-N-hours schedule
router.put("/optima-sync/config/:connectorId", async (req, res): Promise<void> => {
  const connectorId = Number(req.params.connectorId);
  const [conn] = await db
    .select()
    .from(rpaConnectorsTable)
    .where(eq(rpaConnectorsTable.id, connectorId))
    .limit(1);
  if (!conn) { res.status(404).json({ error: "מחבר לא נמצא" }); return; }

  const enabled = Boolean(req.body?.enabled);
  const intervalHours = Number(req.body?.intervalHours) > 0 ? Number(req.body.intervalHours) : 5;
  const metadata = writeAutoSync(conn.metadata, { enabled, intervalHours });

  await db
    .update(rpaConnectorsTable)
    .set({ metadata })
    .where(eq(rpaConnectorsTable.id, connectorId));

  res.json({ enabled, intervalHours });
});

export default router;
