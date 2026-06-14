/**
 * WhatsApp daily report service.
 * Reads the "Turnovers" Google Sheet and sends three types of messages:
 *   1. Welcome message per arriving guest
 *   2. Checkout reminder per departing guest
 *   3. Owner summary (arrivals + departures + vacant rooms)
 *
 * Called by the daily scheduler (startWhatsAppScheduler) and the manual
 * trigger endpoint POST /api/whatsapp/send-daily.
 */

import { db, agentsTable, assignmentsTable, clientsTable, settingsTable } from "@workspace/db";
import { eq, like, and } from "drizzle-orm";
import { readSheet, buildDailyReport } from "./sheets-reader.js";
import { sendWhatsAppText, normalisePhone } from "../lib/whatsapp-api.js";

// ─── Settings keys ────────────────────────────────────────────────────────────
const KEY_TO_PHONE      = "whatsapp_to_phone";           // owner/manager phone (E.164 digits)
const KEY_SEND_HOUR     = "whatsapp_send_hour";          // "8" → 08:xx Israel time
const KEY_ENABLED       = "whatsapp_daily_enabled";      // "true" | "false"
const KEY_GUEST_MSGS    = "whatsapp_guest_msgs_enabled"; // "true" | "false" — opt-in, default false

// ─── Settings helpers ─────────────────────────────────────────────────────────
async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

export async function getWhatsAppSettings(): Promise<{
  toPhone: string | null;
  sendHour: number;
  enabled: boolean;
  guestMessagesEnabled: boolean;
}> {
  const [toPhone, sendHourRaw, enabledRaw, guestMsgsRaw] = await Promise.all([
    getSetting(KEY_TO_PHONE),
    getSetting(KEY_SEND_HOUR),
    getSetting(KEY_ENABLED),
    getSetting(KEY_GUEST_MSGS),
  ]);
  return {
    toPhone,
    sendHour: sendHourRaw ? parseInt(sendHourRaw, 10) : 8,
    enabled:  enabledRaw === "true",
    guestMessagesEnabled: guestMsgsRaw === "true", // opt-in, default OFF
  };
}

// ─── Build WhatsApp messages ──────────────────────────────────────────────────

interface SheetRowLike {
  [key: string]: string | undefined;
}

/**
 * Build a welcome message for an arriving guest.
 * Uses the same guest-label parsing as buildDailyReport.
 */
function buildArrivalMessage(
  guestName: string,
  room: string,
  phone: string,
  clientName: string,
): string {
  const greeting = guestName ? `שלום ${guestName} 👋` : "שלום 👋";
  return (
    `${greeting}\n\n` +
    `ברוכים הבאים ל${clientName}!\n` +
    (room ? `🏠 חדר: *${room}*\n` : "") +
    `\nאם יש לכם שאלות, תרגישו חופשי לפנות.\n` +
    `נאחל לכם שהייה נעימה! 🌟`
  );
}

/**
 * Build a checkout reminder for a departing guest.
 */
function buildDepartureMessage(
  guestName: string,
  room: string,
  phone: string,
  clientName: string,
): string {
  const greeting = guestName ? `שלום ${guestName} 👋` : "שלום 👋";
  return (
    `${greeting}\n\n` +
    `תזכורת — היום יום היציאה שלכם מ${clientName}.\n` +
    (room ? `🏠 חדר: *${room}*\n` : "") +
    `⏰ יציאה עד 11:00\n\n` +
    `תודה שבחרתם בנו, נשמח לראותכם שוב! 🙏`
  );
}

// ─── Main send function ───────────────────────────────────────────────────────

export interface DailySendResult {
  ownerSummary: boolean;
  arrivalsSent: number;
  departuresSent: number;
  errors: string[];
}

export async function sendDailyWhatsApp(
  targetDateISO?: string,
): Promise<DailySendResult> {
  const result: DailySendResult = {
    ownerSummary: false,
    arrivalsSent: 0,
    departuresSent: 0,
    errors: [],
  };

  const settings = await getWhatsAppSettings();
  if (!settings.toPhone) {
    result.errors.push("מספר טלפון יעד (whatsapp_to_phone) לא מוגדר");
    return result;
  }

  // Find agent with journal-qa tag and a Google Sheet URL
  const rows = await db
    .select({
      agentId: agentsTable.id,
      inputSchema: agentsTable.inputSchema,
      clientId: assignmentsTable.clientId,
      clientName: clientsTable.name,
    })
    .from(agentsTable)
    .innerJoin(assignmentsTable, eq(assignmentsTable.agentId, agentsTable.id))
    .innerJoin(clientsTable, eq(clientsTable.id, assignmentsTable.clientId))
    .where(like(agentsTable.tags, "%journal-qa%"));

  const agentRow = rows.find((r) => r.inputSchema?.includes("docs.google.com/spreadsheets"));
  if (!agentRow?.inputSchema) {
    result.errors.push("לא נמצא גיליון מוגדר — הגדר URL בשדה inputSchema של הסוכן");
    return result;
  }

  let sheetData: Awaited<ReturnType<typeof readSheet>>;
  try {
    sheetData = await readSheet(agentRow.inputSchema, "Turnovers");
  } catch (err) {
    result.errors.push(`שגיאה בקריאת הגיליון: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const clientName = agentRow.clientName ?? "הנכס";
  const todayISO = targetDateISO
    ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

  // ── 1. Owner summary ────────────────────────────────────────────────────────
  try {
    const summary = buildDailyReport(sheetData, clientName, todayISO, "full");
    const ownerPhone = normalisePhone(settings.toPhone);
    result.ownerSummary = await sendWhatsAppText(ownerPhone, summary);
  } catch (err) {
    result.errors.push(`שגיאה בשליחת סיכום לבעלים: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2. Per-guest arrival + departure messages ────────────────────────────────
  // ONLY when explicitly enabled — never on by default to avoid sending
  // unintentional messages to real guests during setup / testing.
  if (!settings.guestMessagesEnabled) {
    return result;
  }

  // We need to identify arriving/departing guests from the sheet rows.
  const headers = sheetData.headers;
  const findCol = (candidates: string[]) =>
    candidates.find((c) => headers.map((h) => h.toLowerCase()).includes(c.toLowerCase()));

  const unitCol      = findCol(["unit", "חדר", "room", "name"]);
  const dateCol      = findCol(["date", "תאריך"]);
  const eventTypeCol = findCol(["eventType", "eventtype", "event_type", "type"]);
  const arrivalCol   = findCol(["arrivalDate", "arrivaldate", "arrival_date", "checkin", "check-in"]);
  const departureCol = findCol(["departureDate", "departuredate", "departure_date", "checkout", "check-out"]);
  const notesCol     = findCol(["notes", "הערות", "פרטים"]);

  const ARRIVAL_TYPES   = new Set(["swap", "arrival", "check-in", "checkin"]);
  const DEPARTURE_TYPES = new Set(["departure", "check-out", "checkout"]);

  let arrivals: SheetRowLike[] = [];
  let departures: SheetRowLike[] = [];

  if (dateCol && eventTypeCol) {
    arrivals   = sheetData.rows.filter(r => {
      const d = r[dateCol] || "";
      const t = r[eventTypeCol] || "";
      return normaliseSheetDate(d) === todayISO && ARRIVAL_TYPES.has(t.toLowerCase());
    });
    departures = sheetData.rows.filter(r => {
      const d = r[dateCol] || "";
      const t = r[eventTypeCol] || "";
      return normaliseSheetDate(d) === todayISO && DEPARTURE_TYPES.has(t.toLowerCase());
    });
  } else {
    if (arrivalCol)   arrivals   = sheetData.rows.filter(r => normaliseSheetDate(r[arrivalCol] || "") === todayISO);
    if (departureCol) departures = sheetData.rows.filter(r => normaliseSheetDate(r[departureCol] || "") === todayISO);
  }

  // Send arrival welcome to each arriving guest (if they have a phone)
  for (const row of arrivals) {
    try {
      const { guestName, phone } = parseGuestFromNotes(row, notesCol);
      const room = unitCol ? row[unitCol] || "" : "";
      if (phone) {
        const sent = await sendWhatsAppText(normalisePhone(phone), buildArrivalMessage(guestName, room, phone, clientName));
        if (sent) result.arrivalsSent++;
        else result.errors.push(`לא נשלחה הודעת כניסה ל${guestName || phone}`);
      }
    } catch (err) {
      result.errors.push(`שגיאה בשליחת הודעת כניסה: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Send departure reminder to each departing guest (if they have a phone)
  for (const row of departures) {
    try {
      const { guestName, phone } = parseGuestFromNotes(row, notesCol);
      const room = unitCol ? row[unitCol] || "" : "";
      if (phone) {
        const sent = await sendWhatsAppText(normalisePhone(phone), buildDepartureMessage(guestName, room, phone, clientName));
        if (sent) result.departuresSent++;
        else result.errors.push(`לא נשלחה הודעת יציאה ל${guestName || phone}`);
      }
    } catch (err) {
      result.errors.push(`שגיאה בשליחת הודעת יציאה: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

// ─── Per-assignment config (new multi-client model) ──────────────────────────

export interface AssignmentWhatsAppConfig {
  toPhone: string;
  sheetUrl: string;
  sendHour?: number;        // default 8
  guestMessagesEnabled?: boolean; // default false
  enabled?: boolean;        // default true
}

/**
 * Send daily WhatsApp report for ONE assignment, driven by its customization JSON.
 * This is the new multi-client model — each assignment stores its own config.
 */
export async function sendAssignmentDailyWhatsApp(
  assignmentId: number,
  config: AssignmentWhatsAppConfig,
  clientName: string,
  targetDateISO?: string,
): Promise<DailySendResult> {
  const result: DailySendResult = {
    ownerSummary: false,
    arrivalsSent: 0,
    departuresSent: 0,
    errors: [],
  };

  const todayISO = targetDateISO
    ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

  // Read sheet
  let sheetData: Awaited<ReturnType<typeof readSheet>>;
  try {
    sheetData = await readSheet(config.sheetUrl, "Turnovers");
  } catch (err) {
    result.errors.push(`[assignment ${assignmentId}] שגיאה בקריאת הגיליון: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  // Owner summary
  try {
    const summary = buildDailyReport(sheetData, clientName, todayISO, "full");
    result.ownerSummary = await sendWhatsAppText(normalisePhone(config.toPhone), summary);
  } catch (err) {
    result.errors.push(`[assignment ${assignmentId}] שגיאה בשליחת סיכום: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Per-guest messages (opt-in only)
  if (!config.guestMessagesEnabled) return result;

  const headers = sheetData.headers;
  const findCol = (candidates: string[]) =>
    candidates.find((c) => headers.map((h) => h.toLowerCase()).includes(c.toLowerCase()));

  const unitCol      = findCol(["unit", "חדר", "room", "name"]);
  const dateCol      = findCol(["date", "תאריך"]);
  const eventTypeCol = findCol(["eventType", "eventtype", "event_type", "type"]);
  const arrivalCol   = findCol(["arrivalDate", "arrivaldate", "arrival_date", "checkin", "check-in"]);
  const departureCol = findCol(["departureDate", "departuredate", "departure_date", "checkout", "check-out"]);
  const notesCol     = findCol(["notes", "הערות", "פרטים"]);

  const ARRIVAL_TYPES   = new Set(["swap", "arrival", "check-in", "checkin"]);
  const DEPARTURE_TYPES = new Set(["departure", "check-out", "checkout"]);

  let arrivals: SheetRowLike[] = [];
  let departures: SheetRowLike[] = [];

  if (dateCol && eventTypeCol) {
    arrivals   = sheetData.rows.filter(r => normaliseSheetDate(r[dateCol] || "") === todayISO && ARRIVAL_TYPES.has((r[eventTypeCol] || "").toLowerCase()));
    departures = sheetData.rows.filter(r => normaliseSheetDate(r[dateCol] || "") === todayISO && DEPARTURE_TYPES.has((r[eventTypeCol] || "").toLowerCase()));
  } else {
    if (arrivalCol)   arrivals   = sheetData.rows.filter(r => normaliseSheetDate(r[arrivalCol] || "") === todayISO);
    if (departureCol) departures = sheetData.rows.filter(r => normaliseSheetDate(r[departureCol] || "") === todayISO);
  }

  for (const row of arrivals) {
    const { guestName, phone } = parseGuestFromNotes(row, notesCol);
    const room = unitCol ? row[unitCol] || "" : "";
    if (phone) {
      const sent = await sendWhatsAppText(normalisePhone(phone), buildArrivalMessage(guestName, room, phone, clientName));
      if (sent) result.arrivalsSent++;
      else result.errors.push(`לא נשלחה הודעת כניסה ל${guestName || phone}`);
    }
  }

  for (const row of departures) {
    const { guestName, phone } = parseGuestFromNotes(row, notesCol);
    const room = unitCol ? row[unitCol] || "" : "";
    if (phone) {
      const sent = await sendWhatsAppText(normalisePhone(phone), buildDepartureMessage(guestName, room, phone, clientName));
      if (sent) result.departuresSent++;
      else result.errors.push(`לא נשלחה הודעת יציאה ל${guestName || phone}`);
    }
  }

  return result;
}

/**
 * Send daily WhatsApp for ALL active "whatsapp-daily" assignments.
 * Each assignment's customization JSON holds its per-client config.
 */
export async function sendAllAssignmentsDailyWhatsApp(
  targetDateISO?: string,
): Promise<{ assignmentId: number; clientName: string; result: DailySendResult }[]> {
  const assignments = await db
    .select({
      assignmentId: assignmentsTable.id,
      customization: assignmentsTable.customization,
      clientName: clientsTable.name,
    })
    .from(assignmentsTable)
    .innerJoin(agentsTable, eq(agentsTable.id, assignmentsTable.agentId))
    .innerJoin(clientsTable, eq(clientsTable.id, assignmentsTable.clientId))
    .where(and(
      like(agentsTable.tags, "%whatsapp-daily%"),
      eq(assignmentsTable.status, "active"),
    ));

  const results = [];
  for (const row of assignments) {
    let config: AssignmentWhatsAppConfig | null = null;
    try {
      if (row.customization) config = JSON.parse(row.customization) as AssignmentWhatsAppConfig;
    } catch { /* ignore malformed JSON */ }

    if (!config?.toPhone || !config?.sheetUrl) {
      results.push({
        assignmentId: row.assignmentId,
        clientName: row.clientName ?? "לקוח",
        result: { ownerSummary: false, arrivalsSent: 0, departuresSent: 0, errors: ["הגדרות חסרות — toPhone ו-sheetUrl נדרשים"] },
      });
      continue;
    }
    if (config.enabled === false) continue; // explicitly disabled

    const res = await sendAssignmentDailyWhatsApp(row.assignmentId, config, row.clientName ?? "הנכס", targetDateISO);
    results.push({ assignmentId: row.assignmentId, clientName: row.clientName ?? "לקוח", result: res });
  }
  return results;
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the daily WhatsApp scheduler.
 * Checks every minute if it's time to send (configurable hour, Israel TZ).
 *
 * Two paths run in parallel:
 *  1. Per-assignment (new model) — reads all "whatsapp-daily" assignments with customization JSON
 *  2. Global settings (legacy)  — uses the settings table (backward compat for manual setup)
 */
export function startWhatsAppScheduler(): void {
  if (schedulerInterval) return;

  const KEY_LAST_SENT       = "whatsapp_last_sent_date";
  const KEY_ASSIGN_LAST_SENT = "whatsapp_assign_last_sent_date";

  schedulerInterval = setInterval(async () => {
    try {
      const todayISO = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
      const nowIL    = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
      const hour     = new Date(nowIL).getHours();

      // ── Path 1: per-assignment (new model) ──────────────────────────────────
      const assignLastSent = await getSetting(KEY_ASSIGN_LAST_SENT);
      if (assignLastSent !== todayISO) {
        // Check if any assignment wants to fire at this hour
        // (Use default hour 8 if not specified)
        const DEFAULT_HOUR = 8;
        if (hour === DEFAULT_HOUR) {
          await saveSetting(KEY_ASSIGN_LAST_SENT, todayISO);
          const results = await sendAllAssignmentsDailyWhatsApp(todayISO);
          if (results.length > 0) {
            console.info("[whatsapp-scheduler] Per-assignment results:", results);
          }
        }
      }

      // ── Path 2: global settings (legacy) ────────────────────────────────────
      const settings = await getWhatsAppSettings();
      if (settings.enabled && settings.toPhone) {
        const lastSent = await getSetting(KEY_LAST_SENT);
        if (lastSent !== todayISO && hour === settings.sendHour) {
          await saveSetting(KEY_LAST_SENT, todayISO);
          console.info(`[whatsapp-scheduler] Sending global daily report for ${todayISO}`);
          const res = await sendDailyWhatsApp(todayISO);
          console.info("[whatsapp-scheduler] Global done:", res);
        }
      }
    } catch (err) {
      console.error("[whatsapp-scheduler] error:", err);
    }
  }, 60_000).unref();

  console.info("[whatsapp-scheduler] started — checking every minute");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseSheetDate(raw: string): string {
  if (!raw) return "";
  // Accepts DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const dmy = raw.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? "20" + y : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function parseGuestFromNotes(
  row: SheetRowLike,
  notesCol: string | undefined,
): { guestName: string; phone: string } {
  const notes = notesCol ? row[notesCol] || "" : "";
  const nameMatch  = notes.match(/אורח:\s*([^·\n]+)/);
  const phoneMatch = notes.match(/טלפון:\s*([^·\n]+)/);
  return {
    guestName: nameMatch  ? nameMatch[1].trim()  : "",
    phone:     phoneMatch ? phoneMatch[1].trim() : "",
  };
}
