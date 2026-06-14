/**
 * WhatsApp management routes.
 *
 * GET  /api/whatsapp/settings               — read current settings + credential status
 * POST /api/whatsapp/settings               — save settings (toPhone, sendHour, enabled)
 * POST /api/whatsapp/send-daily             — manual trigger (optional body: { date: "YYYY-MM-DD" })
 * POST /api/whatsapp/send-assignment/:id    — send daily report for one assignment now
 * POST /api/whatsapp/test                   — send a single test message to the configured phone
 */

import { Router, type IRouter } from "express";
import { db, assignmentsTable, agentsTable, clientsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  sendDailyWhatsApp,
  sendAssignmentDailyWhatsApp,
  getWhatsAppSettings,
  saveSetting,
  type AssignmentWhatsAppConfig,
} from "../services/whatsapp-daily.js";
import { sendWhatsAppText, whatsappConfigured, normalisePhone } from "../lib/whatsapp-api.js";

const router: IRouter = Router();

// ── GET /api/whatsapp/settings ───────────────────────────────────────────────
router.get("/whatsapp/settings", async (_req, res) => {
  try {
    const settings = await getWhatsAppSettings();
    res.json({
      ok: true,
      settings,
      credentialsConfigured: whatsappConfigured(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── POST /api/whatsapp/settings ──────────────────────────────────────────────
router.post("/whatsapp/settings", async (req, res) => {
  try {
    const { toPhone, sendHour, enabled, guestMessagesEnabled } = req.body as {
      toPhone?: string;
      sendHour?: number;
      enabled?: boolean;
      guestMessagesEnabled?: boolean;
    };

    if (toPhone !== undefined) {
      await saveSetting("whatsapp_to_phone", normalisePhone(toPhone));
    }
    if (sendHour !== undefined) {
      const h = Number(sendHour);
      if (isNaN(h) || h < 0 || h > 23) {
        res.status(400).json({ ok: false, error: "sendHour must be 0–23" });
        return;
      }
      await saveSetting("whatsapp_send_hour", String(h));
    }
    if (enabled !== undefined) {
      await saveSetting("whatsapp_daily_enabled", enabled ? "true" : "false");
    }
    if (guestMessagesEnabled !== undefined) {
      await saveSetting("whatsapp_guest_msgs_enabled", guestMessagesEnabled ? "true" : "false");
    }

    const updated = await getWhatsAppSettings();
    res.json({ ok: true, settings: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── POST /api/whatsapp/send-assignment/:id ───────────────────────────────────
router.post("/whatsapp/send-assignment/:id", async (req, res) => {
  const assignmentId = parseInt(req.params.id, 10);
  if (isNaN(assignmentId)) {
    res.status(400).json({ ok: false, error: "Invalid assignment id" });
    return;
  }
  try {
    const [row] = await db
      .select({
        customization: assignmentsTable.customization,
        clientName: clientsTable.name,
      })
      .from(assignmentsTable)
      .innerJoin(clientsTable, eq(clientsTable.id, assignmentsTable.clientId))
      .where(eq(assignmentsTable.id, assignmentId))
      .limit(1);

    if (!row) {
      res.status(404).json({ ok: false, error: "Assignment not found" });
      return;
    }

    let config: AssignmentWhatsAppConfig | null = null;
    try { if (row.customization) config = JSON.parse(row.customization) as AssignmentWhatsAppConfig; }
    catch { /* ignore */ }

    if (!config?.toPhone || !config?.sheetUrl) {
      res.status(400).json({ ok: false, error: "חסרות הגדרות WhatsApp — הגדר toPhone ו-sheetUrl" });
      return;
    }

    const { date } = req.body as { date?: string };
    const result = await sendAssignmentDailyWhatsApp(assignmentId, config, row.clientName ?? "הנכס", date);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── POST /api/whatsapp/send-daily ────────────────────────────────────────────
router.post("/whatsapp/send-daily", async (req, res) => {
  try {
    const { date } = req.body as { date?: string };
    // Validate date format if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ ok: false, error: "date must be YYYY-MM-DD" });
      return;
    }
    const result = await sendDailyWhatsApp(date);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── POST /api/whatsapp/test ──────────────────────────────────────────────────
router.post("/whatsapp/test", async (req, res) => {
  try {
    if (!whatsappConfigured()) {
      res.status(400).json({
        ok: false,
        error: "חסרים WHATSAPP_TOKEN ו/או WHATSAPP_PHONE_NUMBER_ID — הגדר ב-Secrets",
      });
      return;
    }
    const settings = await getWhatsAppSettings();
    if (!settings.toPhone) {
      res.status(400).json({
        ok: false,
        error: "לא הוגדר מספר טלפון יעד — שמור הגדרות קודם",
      });
      return;
    }
    const { message } = req.body as { message?: string };
    const text = message || "✅ AgentHub — בדיקת חיבור WhatsApp הצליחה!";
    const sent = await sendWhatsAppText(normalisePhone(settings.toPhone), text);
    res.json({ ok: sent, sent });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
