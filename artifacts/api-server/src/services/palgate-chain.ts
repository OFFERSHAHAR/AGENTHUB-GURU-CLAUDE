/**
 * Optima → PalGate chaining.
 *
 * When an Optima occupancy sync is APPROVED, the occupancy delta becomes the
 * authoritative entries/exits feed for PalGate gate permits:
 *   - each NEW occupancy record  → a PalGate permit (status "pending"), which the
 *     existing daily-check turns into an "add to gate" reminder on its check-in
 *     date and a "remove from gate" reminder on its check-out date.
 *   - each REMOVED occupancy record (a booking that vanished before its
 *     check-out) → an immediate "early removal" Telegram notice for any matching
 *     permit that is not already removed.
 *
 * The chain only runs for clients that actually own a PalGate connector, so it
 * is a no-op for every other client. Field extraction is tolerant: Optima
 * occupancy rows are matched against a set of common field-name variants.
 */
import { eq, and } from "drizzle-orm";
import {
  db,
  rpaConnectorsTable,
  clientsTable,
  palgatePermitsTable,
} from "@workspace/db";
import { sendTelegramMessage } from "../lib/telegram-notify.js";

type Rec = Record<string, unknown>;

interface MappedPermit {
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  unitOrNote: string | null;
}

const NAME_KEYS = ["guestName", "guest_name", "name", "guest", "fullName", "full_name", "customer", "tenant", "שם", "שם_אורח"];
const PHONE_KEYS = ["guestPhone", "guest_phone", "phone", "mobile", "tel", "phoneNumber", "phone_number", "טלפון", "נייד"];
const CHECKIN_KEYS = ["checkIn", "check_in", "checkin", "arrival", "from", "startDate", "start_date", "start", "date", "כניסה", "תאריך_כניסה"];
const CHECKOUT_KEYS = ["checkOut", "check_out", "checkout", "departure", "to", "endDate", "end_date", "end", "עזיבה", "תאריך_עזיבה"];
const UNIT_KEYS = ["unitOrNote", "unit", "room", "apartment", "code", "unit_or_note", "יחידה", "חדר", "דירה"];

function pick(rec: Rec, keys: string[]): string | null {
  for (const k of keys) {
    const v = rec[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/** Normalise a date-ish value to YYYY-MM-DD; returns null if unparseable. */
function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

export function mapRecordToPermit(rec: Rec): MappedPermit | null {
  const guestName = pick(rec, NAME_KEYS);
  const guestPhone = pick(rec, PHONE_KEYS);
  const checkIn = toIsoDate(pick(rec, CHECKIN_KEYS));
  const checkOut = toIsoDate(pick(rec, CHECKOUT_KEYS));
  if (!guestName || !guestPhone || !checkIn || !checkOut) return null;
  return { guestName, guestPhone, checkIn, checkOut, unitOrNote: pick(rec, UNIT_KEYS) };
}

function sourceKey(clientId: number, p: MappedPermit): string {
  // Client-scoped + full date span so distinct bookings (same phone, same
  // check-in but different stay/unit) never collapse into one permit.
  return `optima:${clientId}:${p.guestPhone}:${p.checkIn}:${p.checkOut}:${p.unitOrNote ?? "-"}`;
}

async function resolveChatId(clientId: number | null): Promise<string | null> {
  if (clientId != null) {
    const [c] = await db
      .select({ chat: clientsTable.telegramChatId })
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId))
      .limit(1);
    if (c?.chat) return c.chat;
  }
  return process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_CHAT_ID || null;
}

export interface ChainResult {
  ran: boolean;
  reason?: string;
  created: number;
  skippedExisting: number;
  skippedUnmappable: number;
  flaggedRemovals: number;
}

export async function chainOptimaToPalgate(opts: {
  clientId: number | null;
  added: Rec[];
  removed: Rec[];
}): Promise<ChainResult> {
  const result: ChainResult = {
    ran: false,
    created: 0,
    skippedExisting: 0,
    skippedUnmappable: 0,
    flaggedRemovals: 0,
  };

  if (opts.clientId == null) {
    result.reason = "no_client";
    return result;
  }

  // Only chain for clients that actually own a PalGate connector.
  const [palgate] = await db
    .select({ id: rpaConnectorsTable.id })
    .from(rpaConnectorsTable)
    .where(and(
      eq(rpaConnectorsTable.clientId, opts.clientId),
      eq(rpaConnectorsTable.systemType, "palgat"),
    ))
    .limit(1);
  if (!palgate) {
    result.reason = "no_palgate_connector";
    return result;
  }

  result.ran = true;

  // ── Entries: new occupancy records → pending permits ───────────────────────
  for (const rec of opts.added) {
    const mapped = mapRecordToPermit(rec);
    if (!mapped) { result.skippedUnmappable++; continue; }

    const key = sourceKey(opts.clientId, mapped);
    const existing = await db
      .select({ id: palgatePermitsTable.id })
      .from(palgatePermitsTable)
      .where(and(
        eq(palgatePermitsTable.clientId, opts.clientId),
        eq(palgatePermitsTable.sheetRowId, key),
      ))
      .limit(1);
    if (existing.length > 0) { result.skippedExisting++; continue; }

    await db.insert(palgatePermitsTable).values({
      clientId: opts.clientId,
      guestName: mapped.guestName,
      guestPhone: mapped.guestPhone,
      unitOrNote: mapped.unitOrNote,
      checkIn: mapped.checkIn,
      checkOut: mapped.checkOut,
      sheetRowId: key,
      status: "pending",
      notes: "נוצר אוטומטית מסנכרון תפוסה — אופטימה",
    });
    result.created++;
  }

  // ── Exits: removed occupancy records → early-removal notice ─────────────────
  const removalLines: string[] = [];
  for (const rec of opts.removed) {
    const mapped = mapRecordToPermit(rec);
    if (!mapped) { result.skippedUnmappable++; continue; }

    const [permit] = await db
      .select()
      .from(palgatePermitsTable)
      .where(and(
        eq(palgatePermitsTable.clientId, opts.clientId),
        eq(palgatePermitsTable.guestPhone, mapped.guestPhone),
        eq(palgatePermitsTable.checkIn, mapped.checkIn),
      ))
      .limit(1);
    if (!permit || permit.status === "removed") continue;

    result.flaggedRemovals++;
    removalLines.push(
      `🚪 <b>${permit.guestName}</b> · 📱 ${permit.guestPhone}${permit.unitOrNote ? ` · 🏠 ${permit.unitOrNote}` : ""} (permit #${permit.id})`,
    );
  }

  if (removalLines.length > 0) {
    const chatId = await resolveChatId(opts.clientId);
    if (chatId) {
      const text = [
        "⚠️ <b>הסרה מוקדמת — PALGATE</b>",
        "הרשומות הבאות נעלמו מתפוסת אופטימה לפני מועד העזיבה.",
        "<b>נא להסיר את ההרשאה מ-PALGATE</b> ולאשר במערכת:",
        "",
        ...removalLines,
      ].join("\n");
      await sendTelegramMessage(chatId, text);
    }
  }

  return result;
}
