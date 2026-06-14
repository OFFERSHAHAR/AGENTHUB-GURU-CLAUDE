import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, palgatePermitsTable } from "@workspace/db";
import { sendTelegramMessage } from "../lib/telegram-notify.js";

const router: IRouter = Router();

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatPermit(p: typeof palgatePermitsTable.$inferSelect) {
  return {
    ...p,
    checkIn: typeof p.checkIn === "string" ? p.checkIn : (p.checkIn as Date).toISOString().split("T")[0],
    checkOut: typeof p.checkOut === "string" ? p.checkOut : (p.checkOut as Date).toISOString().split("T")[0],
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    addedToGate: p.addedToGate?.toISOString() ?? null,
    removedFromGate: p.removedFromGate?.toISOString() ?? null,
  };
}

// GET /palgate/permits
router.get("/palgate/permits", async (req, res): Promise<void> => {
  const { status, clientId } = req.query;
  let q = db.select().from(palgatePermitsTable).orderBy(desc(palgatePermitsTable.checkIn)).$dynamic();
  if (status) q = q.where(eq(palgatePermitsTable.status, String(status)));
  if (clientId) q = q.where(eq(palgatePermitsTable.clientId, Number(clientId)));
  const rows = await q;
  res.json(rows.map(formatPermit));
});

// POST /palgate/permits — add single permit (from webhook or manual)
router.post("/palgate/permits", async (req, res): Promise<void> => {
  const { clientId, guestName, guestPhone, unitOrNote, checkIn, checkOut, sheetRowId, notes } = req.body;
  if (!guestName || !guestPhone || !checkIn || !checkOut) {
    res.status(400).json({ error: "חסרים שדות חובה: guestName, guestPhone, checkIn, checkOut" });
    return;
  }
  const [permit] = await db.insert(palgatePermitsTable).values({
    clientId: clientId ? Number(clientId) : null,
    guestName,
    guestPhone,
    unitOrNote: unitOrNote ?? null,
    checkIn,
    checkOut,
    sheetRowId: sheetRowId ?? null,
    notes: notes ?? null,
    status: "pending",
  }).returning();
  res.status(201).json(formatPermit(permit));
});

// POST /palgate/permits/sync-sheet — bulk upsert from Google Sheets data
router.post("/palgate/permits/sync-sheet", async (req, res): Promise<void> => {
  const { rows, clientId } = req.body as {
    rows: Array<{ guestName: string; guestPhone: string; unitOrNote?: string; checkIn: string; checkOut: string; sheetRowId?: string; notes?: string }>;
    clientId?: number;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows must be a non-empty array" });
    return;
  }

  const inserted: number[] = [];
  const skipped: number[] = [];

  for (const row of rows) {
    if (!row.guestName || !row.guestPhone || !row.checkIn || !row.checkOut) { skipped.push(-1); continue; }

    // Upsert by sheetRowId if provided, otherwise by phone+checkIn
    if (row.sheetRowId) {
      const existing = await db.select().from(palgatePermitsTable)
        .where(eq(palgatePermitsTable.sheetRowId, row.sheetRowId)).limit(1);
      if (existing.length > 0) { skipped.push(existing[0].id); continue; }
    } else {
      const existing = await db.select().from(palgatePermitsTable)
        .where(and(
          eq(palgatePermitsTable.guestPhone, row.guestPhone),
          eq(palgatePermitsTable.checkIn, row.checkIn),
        )).limit(1);
      if (existing.length > 0) { skipped.push(existing[0].id); continue; }
    }

    const [p] = await db.insert(palgatePermitsTable).values({
      clientId: clientId ? Number(clientId) : null,
      guestName: row.guestName,
      guestPhone: row.guestPhone,
      unitOrNote: row.unitOrNote ?? null,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      sheetRowId: row.sheetRowId ?? null,
      notes: row.notes ?? null,
      status: "pending",
    }).returning();
    inserted.push(p.id);
  }

  res.json({ inserted: inserted.length, skipped: skipped.length, insertedIds: inserted });
});

// POST /palgate/permits/:id/confirm-add — ops confirmed they added to PALGATE gate
router.post("/palgate/permits/:id/confirm-add", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { confirmedBy } = req.body;
  const now = new Date();
  const [p] = await db.update(palgatePermitsTable).set({
    status: "active",
    addedToGate: now,
    addedConfirmedBy: confirmedBy ?? "ops",
    updatedAt: now,
  }).where(eq(palgatePermitsTable.id, id)).returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatPermit(p));
});

// POST /palgate/permits/:id/confirm-remove — ops confirmed they removed from PALGATE gate
router.post("/palgate/permits/:id/confirm-remove", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { confirmedBy } = req.body;
  const now = new Date();
  const [p] = await db.update(palgatePermitsTable).set({
    status: "removed",
    removedFromGate: now,
    removedConfirmedBy: confirmedBy ?? "ops",
    updatedAt: now,
  }).where(eq(palgatePermitsTable.id, id)).returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatPermit(p));
});

// DELETE /palgate/permits/:id
router.delete("/palgate/permits/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(palgatePermitsTable).where(eq(palgatePermitsTable.id, id));
  res.json({ ok: true });
});

// POST /palgate/daily-check — called by scheduler; sends Telegram reminders
router.post("/palgate/daily-check", async (_req, res): Promise<void> => {
  const t = today();
  const chatId = process.env.TELEGRAM_CHAT_ID ?? process.env.ADMIN_TELEGRAM_CHAT_ID;

  // Arrivals today (pending → need to add to gate)
  const arrivals = await db.select().from(palgatePermitsTable)
    .where(and(eq(palgatePermitsTable.checkIn, t), eq(palgatePermitsTable.status, "pending")));

  // Departures today (active → need to remove from gate)
  const departures = await db.select().from(palgatePermitsTable)
    .where(and(eq(palgatePermitsTable.checkOut, t), eq(palgatePermitsTable.status, "active")));

  const msgs: string[] = [];

  for (const p of arrivals) {
    const msg = `🔑 <b>הגעה היום — ${t}</b>\n👤 <b>${p.guestName}</b>\n📱 ${p.guestPhone}${p.unitOrNote ? `\n🏠 ${p.unitOrNote}` : ""}\n📅 צ׳ק-אין: ${p.checkIn} | צ׳ק-אאוט: ${p.checkOut}\n\n✅ <b>נא להוסיף הרשאה ב-PALGATE</b> ולאשר במערכת (permit #${p.id})`;
    if (chatId) {
      await sendTelegramMessage(chatId, msg).catch(() => {});
    }
    msgs.push(msg);
  }

  for (const p of departures) {
    const msg = `🚪 <b>עזיבה היום — ${t}</b>\n👤 <b>${p.guestName}</b>\n📱 ${p.guestPhone}${p.unitOrNote ? `\n🏠 ${p.unitOrNote}` : ""}\n\n🗑️ <b>נא להסיר הרשאה מ-PALGATE</b> ולאשר במערכת (permit #${p.id})`;
    if (chatId) {
      await sendTelegramMessage(chatId, msg).catch(() => {});
    }
    msgs.push(msg);
  }

  res.json({
    date: t,
    arrivals: arrivals.length,
    departures: departures.length,
    telegramSent: !!chatId,
    messages: msgs,
  });
});

export default router;
