import { Router, type IRouter } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db, settingsTable, settingsHistoryTable } from "@workspace/db";

const router: IRouter = Router();

const DEDUP_WARN_THRESHOLD_KEY = "dedup_warn_threshold";
const DEFAULT_DEDUP_WARN_THRESHOLD = parseInt(process.env.WEBHOOK_DEDUP_WARN_THRESHOLD ?? "10", 10);

// Global on/off switch for the "Webhook Triggered" Telegram notification.
// Defaults to ON for backwards compatibility (current behaviour).
const WEBHOOK_TELEGRAM_NOTIFICATIONS_KEY = "webhook_telegram_notifications_enabled";

export async function getWebhookTelegramNotificationsEnabled(): Promise<boolean> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, WEBHOOK_TELEGRAM_NOTIFICATIONS_KEY))
    .limit(1);
  if (row) return row.value !== "false";
  return true;
}

// Canonical storage of the dedup window is in HOURS so ops can fine-tune below a day.
// A legacy whole-days key is still read as a fallback for backwards compatibility.
const DEDUP_WINDOW_HOURS_KEY = "dedup_window_hours";
const DEDUP_WINDOW_UNIT_KEY = "dedup_window_unit";
const DEDUP_WINDOW_DAYS_KEY = "dedup_window_days"; // legacy
const DEFAULT_DEDUP_WINDOW_HOURS = (() => {
  const fromHours = parseInt(process.env.WEBHOOK_DEDUP_WINDOW_HOURS ?? "", 10);
  if (!isNaN(fromHours) && fromHours > 0) return fromHours;
  const fromDays = parseInt(process.env.WEBHOOK_DEDUP_WINDOW_DAYS ?? "7", 10);
  return (!isNaN(fromDays) && fromDays > 0 ? fromDays : 7) * 24;
})();

export type DedupWindowUnit = "hours" | "days";

// Upper bound for the rolling detection window. Anything longer makes the
// window stats queries scan an unbounded range and produces confusing context.
export const MAX_DEDUP_WINDOW_HOURS = 8760; // 365 days
export const MAX_DEDUP_WINDOW_DAYS = MAX_DEDUP_WINDOW_HOURS / 24; // 365

export async function getDedupWarnThreshold(): Promise<number> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEDUP_WARN_THRESHOLD_KEY))
    .limit(1);
  if (row) {
    const parsed = parseInt(row.value, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_DEDUP_WARN_THRESHOLD;
}

// Canonical window length, in hours. Reads the new hours key, falls back to the
// legacy whole-days key (× 24), then to the configured default.
export async function getDedupWindowHours(): Promise<number> {
  const [hoursRow] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEDUP_WINDOW_HOURS_KEY))
    .limit(1);
  if (hoursRow) {
    const parsed = parseInt(hoursRow.value, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const [daysRow] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEDUP_WINDOW_DAYS_KEY))
    .limit(1);
  if (daysRow) {
    const parsed = parseInt(daysRow.value, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed * 24;
  }

  return DEFAULT_DEDUP_WINDOW_HOURS;
}

// Display unit chosen by ops (hours/days). Falls back to "days" when never set
// so existing installs keep their day-oriented wording.
export async function getDedupWindowUnit(): Promise<DedupWindowUnit> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEDUP_WINDOW_UNIT_KEY))
    .limit(1);
  if (row && (row.value === "hours" || row.value === "days")) {
    return row.value;
  }
  return "days";
}

// GET /settings/dedup-warn-threshold
router.get("/settings/dedup-warn-threshold", async (_req, res): Promise<void> => {
  const threshold = await getDedupWarnThreshold();
  res.json({ threshold });
});

// GET /settings/dedup-warn-threshold/history
router.get("/settings/dedup-warn-threshold/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(settingsHistoryTable)
    .where(eq(settingsHistoryTable.key, DEDUP_WARN_THRESHOLD_KEY))
    .orderBy(desc(settingsHistoryTable.createdAt))
    .limit(50);

  res.json({
    history: rows.map((r) => ({
      id: r.id,
      oldValue: r.oldValue !== null ? parseInt(r.oldValue, 10) : null,
      newValue: parseInt(r.newValue, 10),
      changedBy: r.changedBy,
      changedAt: r.createdAt,
    })),
  });
});

// PUT /settings/dedup-warn-threshold
router.put("/settings/dedup-warn-threshold", async (req, res): Promise<void> => {
  const raw = req.body?.threshold;
  const threshold = parseInt(String(raw), 10);
  if (isNaN(threshold) || threshold < 1) {
    res.status(400).json({ error: "threshold must be a positive integer" });
    return;
  }

  const changedByRaw = req.body?.changedBy;
  const changedBy =
    typeof changedByRaw === "string" && changedByRaw.trim() ? changedByRaw.trim().slice(0, 120) : "ops";

  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEDUP_WARN_THRESHOLD_KEY))
    .limit(1);

  const oldValue = existing?.value ?? null;

  await db
    .insert(settingsTable)
    .values({ key: DEDUP_WARN_THRESHOLD_KEY, value: String(threshold), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: String(threshold), updatedAt: new Date() },
    });

  // Only record history when the value actually changed
  if (oldValue !== String(threshold)) {
    await db.insert(settingsHistoryTable).values({
      key: DEDUP_WARN_THRESHOLD_KEY,
      oldValue,
      newValue: String(threshold),
      changedBy,
    });
  }

  res.json({ threshold });
});

// GET /settings/dedup-window
router.get("/settings/dedup-window", async (_req, res): Promise<void> => {
  const windowHours = await getDedupWindowHours();
  const unit = await getDedupWindowUnit();
  res.json({ windowHours, windowDays: windowHours / 24, unit });
});

// GET /settings/dedup-window/history
// History values are normalised to hours. Legacy day-based entries (stored under
// the old key) are converted on the fly so the audit trail stays intact.
router.get("/settings/dedup-window/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(settingsHistoryTable)
    .where(inArray(settingsHistoryTable.key, [DEDUP_WINDOW_HOURS_KEY, DEDUP_WINDOW_DAYS_KEY]))
    .orderBy(desc(settingsHistoryTable.createdAt))
    .limit(50);

  res.json({
    history: rows.map((r) => {
      const factor = r.key === DEDUP_WINDOW_DAYS_KEY ? 24 : 1;
      const old = r.oldValue !== null ? parseInt(r.oldValue, 10) : null;
      return {
        id: r.id,
        oldValueHours: old !== null && !isNaN(old) ? old * factor : null,
        newValueHours: parseInt(r.newValue, 10) * factor,
        changedBy: r.changedBy,
        changedAt: r.createdAt,
      };
    }),
  });
});

// PUT /settings/dedup-window
// Accepts { value, unit }, where unit is "hours" or "days". The value is stored
// canonically in hours; the chosen unit is persisted for display.
router.put("/settings/dedup-window", async (req, res): Promise<void> => {
  const value = parseInt(String(req.body?.value), 10);
  if (isNaN(value) || value < 1) {
    res.status(400).json({ error: "value must be a positive integer" });
    return;
  }

  const unit: DedupWindowUnit = req.body?.unit === "hours" ? "hours" : req.body?.unit === "days" ? "days" : null as any;
  if (unit !== "hours" && unit !== "days") {
    res.status(400).json({ error: "unit must be 'hours' or 'days'" });
    return;
  }

  const windowHours = unit === "days" ? value * 24 : value;

  if (windowHours > MAX_DEDUP_WINDOW_HOURS) {
    res.status(400).json({
      error: `window must not exceed ${MAX_DEDUP_WINDOW_DAYS} days (${MAX_DEDUP_WINDOW_HOURS} hours)`,
    });
    return;
  }

  const changedByRaw = req.body?.changedBy;
  const changedBy =
    typeof changedByRaw === "string" && changedByRaw.trim() ? changedByRaw.trim().slice(0, 120) : "ops";

  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEDUP_WINDOW_HOURS_KEY))
    .limit(1);

  const oldValue = existing?.value ?? null;

  await db
    .insert(settingsTable)
    .values({ key: DEDUP_WINDOW_HOURS_KEY, value: String(windowHours), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: String(windowHours), updatedAt: new Date() },
    });

  // Persist the chosen display unit alongside the canonical hours value.
  await db
    .insert(settingsTable)
    .values({ key: DEDUP_WINDOW_UNIT_KEY, value: unit, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: unit, updatedAt: new Date() },
    });

  // Only record history when the canonical value actually changed
  if (oldValue !== String(windowHours)) {
    await db.insert(settingsHistoryTable).values({
      key: DEDUP_WINDOW_HOURS_KEY,
      oldValue,
      newValue: String(windowHours),
      changedBy,
    });
  }

  res.json({ windowHours, windowDays: windowHours / 24, unit });
});

// GET /settings/webhook-telegram-notifications
router.get("/settings/webhook-telegram-notifications", async (_req, res): Promise<void> => {
  const enabled = await getWebhookTelegramNotificationsEnabled();
  res.json({ enabled });
});

// PUT /settings/webhook-telegram-notifications
router.put("/settings/webhook-telegram-notifications", async (req, res): Promise<void> => {
  const raw = req.body?.enabled;
  if (typeof raw !== "boolean") {
    res.status(400).json({ error: "enabled must be a boolean" });
    return;
  }
  const enabled = raw;

  const changedByRaw = req.body?.changedBy;
  const changedBy =
    typeof changedByRaw === "string" && changedByRaw.trim() ? changedByRaw.trim().slice(0, 120) : "ops";

  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, WEBHOOK_TELEGRAM_NOTIFICATIONS_KEY))
    .limit(1);

  const oldValue = existing?.value ?? null;
  const newValue = enabled ? "true" : "false";

  await db
    .insert(settingsTable)
    .values({ key: WEBHOOK_TELEGRAM_NOTIFICATIONS_KEY, value: newValue, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: newValue, updatedAt: new Date() },
    });

  // Only record history when the value actually changed
  if (oldValue !== newValue) {
    await db.insert(settingsHistoryTable).values({
      key: WEBHOOK_TELEGRAM_NOTIFICATIONS_KEY,
      oldValue,
      newValue,
      changedBy,
    });
  }

  res.json({ enabled });
});

// GET /settings/webhook-telegram-notifications/history
router.get("/settings/webhook-telegram-notifications/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(settingsHistoryTable)
    .where(eq(settingsHistoryTable.key, WEBHOOK_TELEGRAM_NOTIFICATIONS_KEY))
    .orderBy(desc(settingsHistoryTable.createdAt))
    .limit(50);

  res.json({
    history: rows.map((r) => ({
      id: r.id,
      previousEnabled: r.oldValue !== null ? r.oldValue !== "false" : null,
      enabled: r.newValue !== "false",
      changedBy: r.changedBy,
      changedAt: r.createdAt,
    })),
  });
});

export default router;
