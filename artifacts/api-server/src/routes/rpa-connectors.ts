import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, rpaConnectorsTable, rpaRunLogsTable } from "@workspace/db";
import { testConnection, runAction, SYSTEM_ACTIONS, clearSession, getSessionStatus, type SystemType } from "../services/rpa-engine.js";

const router: IRouter = Router();

function decodePassword(enc: string): string {
  try { return Buffer.from(enc, "base64").toString("utf-8"); } catch { return enc; }
}

function encodePassword(plain: string): string {
  return Buffer.from(plain, "utf-8").toString("base64");
}

function formatConnector(c: typeof rpaConnectorsTable.$inferSelect) {
  return {
    ...c,
    encryptedPassword: undefined,
    hasPassword: !!c.encryptedPassword,
    createdAt: c.createdAt.toISOString(),
    lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
    lastSuccessAt: c.lastSuccessAt?.toISOString() ?? null,
    availableActions: SYSTEM_ACTIONS[c.systemType as SystemType] ?? [],
    sessionStatus: getSessionStatus(c.id),
  };
}

// GET /rpa-connectors
router.get("/rpa-connectors", async (_req, res): Promise<void> => {
  const rows = await db.select().from(rpaConnectorsTable).orderBy(desc(rpaConnectorsTable.createdAt));
  res.json(rows.map(formatConnector));
});

// GET /rpa-connectors/systems — list supported systems + their actions
router.get("/rpa-connectors/systems", (_req, res): Promise<void> => {
  const systems = [
    { id: "palgat", label: "PAL GAT", labelHe: "פעל גאט", icon: "💼", description: "מערכת שכר ומשאבי אנוש", vendor: "פעל גאט" },
    { id: "optima", label: "OPTIMA Cloud", labelHe: "אופטימה ענן", icon: "☁️", description: "מערכת ERP בענן לניהול עסקי", vendor: "OPTIMA" },
    { id: "priority", label: "Priority ERP", labelHe: "פריוריטי", icon: "📊", description: "מערכת ERP עם OData API", vendor: "Priority Software" },
    { id: "hashavshevet", label: "Hashavshevet", labelHe: "חשבשבת", icon: "📒", description: "מערכת הנהלת חשבונות", vendor: "Yael Software" },
    { id: "generic_form", label: "Generic Web Form", labelHe: "אתר כללי", icon: "🌐", description: "כל מערכת עם טפסי כניסה רגילים", vendor: "כל ספק" },
  ].map(s => ({
    ...s,
    actions: SYSTEM_ACTIONS[s.id as SystemType] ?? [],
  }));
  res.json(systems);
  return Promise.resolve();
});

// POST /rpa-connectors
router.post("/rpa-connectors", async (req, res): Promise<void> => {
  const { name, systemType, baseUrl, username, password, notes, clientId } = req.body;

  if (!name || !systemType || !baseUrl || !username || !password) {
    res.status(400).json({ error: "חסרים שדות חובה: name, systemType, baseUrl, username, password" });
    return;
  }

  const [conn] = await db.insert(rpaConnectorsTable).values({
    name,
    systemType,
    baseUrl: baseUrl.replace(/\/$/, ""),
    username,
    encryptedPassword: encodePassword(password),
    notes: notes ?? null,
    metadata: null,
    clientId: clientId ? Number(clientId) : null,
    status: "disconnected",
  }).returning();

  res.status(201).json(formatConnector(conn));
});

// PATCH /rpa-connectors/:id
router.patch("/rpa-connectors/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, baseUrl, username, password, notes, clientId, status } = req.body;
  const updates: Partial<typeof rpaConnectorsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (baseUrl !== undefined) updates.baseUrl = baseUrl.replace(/\/$/, "");
  if (username !== undefined) updates.username = username;
  if (password !== undefined) updates.encryptedPassword = encodePassword(password);
  if (notes !== undefined) updates.notes = notes;
  if (clientId !== undefined) updates.clientId = clientId ? Number(clientId) : null;
  if (status !== undefined) updates.status = status;

  if (password !== undefined) clearSession(id);

  const [conn] = await db.update(rpaConnectorsTable).set(updates).where(eq(rpaConnectorsTable.id, id)).returning();
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatConnector(conn));
});

// DELETE /rpa-connectors/:id
router.delete("/rpa-connectors/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  clearSession(id);
  await db.delete(rpaConnectorsTable).where(eq(rpaConnectorsTable.id, id));
  res.json({ ok: true });
});

// POST /rpa-connectors/:id/test — test login
router.post("/rpa-connectors/:id/test", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [conn] = await db.select().from(rpaConnectorsTable).where(eq(rpaConnectorsTable.id, id));
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  const start = Date.now();
  const result = await testConnection(
    id,
    conn.systemType as SystemType,
    conn.baseUrl,
    conn.username,
    decodePassword(conn.encryptedPassword)
  );
  const durationMs = Date.now() - start;

  const newStatus = result.success ? "connected" : "error";
  const [updated] = await db.update(rpaConnectorsTable).set({
    status: newStatus,
    lastTestedAt: new Date(),
    ...(result.success ? { lastSuccessAt: new Date() } : {}),
  }).where(eq(rpaConnectorsTable.id, id)).returning();

  await db.insert(rpaRunLogsTable).values({
    connectorId: id,
    action: "test_connection",
    status: result.success ? "success" : "error",
    result: result.data ? JSON.stringify(result.data) : null,
    errorMessage: result.error ?? null,
    durationMs,
    triggeredBy: "manual",
  });

  res.json({ ...result, durationMs, connector: formatConnector(updated) });
});

// POST /rpa-connectors/:id/run/:action
router.post("/rpa-connectors/:id/run/:action", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const action = req.params.action;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [conn] = await db.select().from(rpaConnectorsTable).where(eq(rpaConnectorsTable.id, id));
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  const [logRow] = await db.insert(rpaRunLogsTable).values({
    connectorId: id,
    action,
    status: "running",
    triggeredBy: "manual",
  }).returning();

  const start = Date.now();
  const params = (req.body?.params as Record<string, string>) ?? {};

  const result = await runAction(
    id,
    conn.systemType as SystemType,
    conn.baseUrl,
    conn.username,
    decodePassword(conn.encryptedPassword),
    action,
    params
  );
  const durationMs = Date.now() - start;

  await db.update(rpaRunLogsTable).set({
    status: result.success ? "success" : "error",
    result: result.data ? JSON.stringify(result.data) : null,
    errorMessage: result.error ?? null,
    durationMs,
  }).where(eq(rpaRunLogsTable.id, logRow.id));

  if (result.success) {
    await db.update(rpaConnectorsTable).set({ status: "connected", lastSuccessAt: new Date() })
      .where(eq(rpaConnectorsTable.id, id));
  }

  res.json({ ...result, durationMs, logId: logRow.id });
});

// GET /rpa-connectors/:id/logs
router.get("/rpa-connectors/:id/logs", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const logs = await db.select().from(rpaRunLogsTable)
    .where(eq(rpaRunLogsTable.connectorId, id))
    .orderBy(desc(rpaRunLogsTable.createdAt))
    .limit(50);

  res.json(logs.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    result: l.result ? JSON.parse(l.result) : null,
  })));
});

export default router;
