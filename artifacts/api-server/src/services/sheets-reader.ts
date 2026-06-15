/**
 * Google Sheets reader + DB comparison — read-only audit.
 * Reads the room/booking journal from Google Sheets via Replit connector,
 * compares it against palgate_permits in the DB, and returns a diff report.
 *
 * NO writes of any kind — pure read + compare.
 */

import crypto from "node:crypto";
import type { PalgatePermit } from "@workspace/db";

export interface SheetRow {
  [column: string]: string;
}

export interface SheetData {
  headers: string[];
  rows: SheetRow[];
  fetchedAt: string;
  sheetId: string;
}

export interface CompareResult {
  sheetTotal: number;
  dbTotal: number;
  matched: { sheetRow: SheetRow; permit: PalgatePermit }[];
  onlyInSheet: SheetRow[];   // in Sheet but NOT in DB → possibly missing
  onlyInDb: PalgatePermit[]; // in DB but NOT in Sheet → possibly extra
}

// ── Column detection helpers ──────────────────────────────────────────────────

const NAME_COLS    = ["שם", "שם אורח", "שם דייר", "אורח", "name", "guest"];
const PHONE_COLS   = ["טלפון", "נייד", "פלאפון", "phone", "mobile", "tel"];
const UNIT_COLS    = ["חדר", "יחידה", "דירה", "unit", "room", "apt"];
const CHECKIN_COLS = ["כניסה", "תאריך כניסה", "check-in", "checkin", "check in", "from"];
const CHECKOUT_COLS= ["יציאה", "תאריך יציאה", "check-out", "checkout", "check out", "to"];

function findCol(headers: string[], candidates: string[]): string | undefined {
  const lc = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lc.indexOf(c.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  // fuzzy: partial match
  for (const c of candidates) {
    const found = headers.find((h) => h.toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
  }
  return undefined;
}

function normalisePhone(p: string): string {
  return p.replace(/\D/g, "").replace(/^972/, "0").slice(-9);
}

function normaliseName(n: string): string {
  return n.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseDateStr(s: string): string {
  // Return YYYY-MM-DD regardless of input format (DD/MM/YYYY or YYYY-MM-DD)
  if (!s) return "";
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2,"0")}-${parts[2].padStart(2,"0")}`;
    return `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
  }
  return s;
}

// ── Read sheet via connector ──────────────────────────────────────────────────

function extractSheetId(urlOrId: string): string {
  const m = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : urlOrId;
}

// ── Google auth (Service Account JWT, no extra deps) ──────────────────────────
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`); signer.end();
  const sig = b64url(signer.sign(sa.private_key));
  const jwt = `${header}.${claim}.${sig}`;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const j = await resp.json() as { access_token?: string; error?: string; error_description?: string };
  if (!j.access_token) throw new Error(`google auth failed: ${j.error_description || j.error || "unknown"}`);
  return j.access_token;
}

// Minimal CSV parser (handles quotes, commas, newlines)
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function fetchValues(sheetId: string, sheetName: string | undefined, range: string): Promise<string[][]> {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (sa) {
    // Secure path: Sheets API v4 via Service Account
    const token = await getAccessToken(sa);
    const rangeParam = sheetName ? `${sheetName}!${range}` : range;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeParam)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`sheets api ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const json = await r.json() as { values?: string[][] };
    return json.values ?? [];
  }
  // Fallback: public CSV (requires sheet shared "anyone with link: viewer")
  const tab = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : "";
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${tab}`;
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`gviz csv ${r.status} — ודא שהגיליון משותף לצפייה או הגדר GOOGLE_SERVICE_ACCOUNT_JSON`);
  const text = await r.text();
  if (text.trim().startsWith("<")) throw new Error("הגיליון אינו ציבורי — שתף לצפייה-בקישור או הגדר Service Account");
  return parseCsv(text);
}

export async function readSheet(sheetUrlOrId: string, sheetName?: string, range = "A1:Z1000"): Promise<SheetData> {
  const sheetId = extractSheetId(sheetUrlOrId);
  const values = await fetchValues(sheetId, sheetName, range);

  if (!values || values.length === 0) {
    return { headers: [], rows: [], fetchedAt: new Date().toISOString(), sheetId };
  }
  const json = { values };

  const [headerRow, ...dataRows] = json.values;
  const headers = headerRow.map((h) => String(h).trim());
  const rows: SheetRow[] = dataRows
    .filter((r) => r.some((v) => String(v).trim() !== ""))
    .map((r) => {
      const row: SheetRow = {};
      // Positional keys first — never collide, even when headers are empty
      // (Google Sheets gviz CSV drops headers for date/number columns).
      r.forEach((v, idx) => { row[`__c${idx}`] = String(v ?? "").trim(); });
      // Named keys for columns that DO have a header label.
      headers.forEach((h, idx) => { if (h) row[h] = String(r[idx] ?? "").trim(); });
      return row;
    });

  return { headers, rows, fetchedAt: new Date().toISOString(), sheetId };
}

// ── Compare sheet vs DB ───────────────────────────────────────────────────────

/**
 * Compare sheet rows against DB palgate_permits (read-only).
 * Matching key: phone (normalised) → fallback: name + checkIn date.
 */
export function compareWithDb(data: SheetData, permits: PalgatePermit[]): CompareResult {
  const phoneCol   = findCol(data.headers, PHONE_COLS);
  const nameCol    = findCol(data.headers, NAME_COLS);
  const checkInCol = findCol(data.headers, CHECKIN_COLS);

  const matchedPermitIds = new Set<number>();
  const matchedSheetIdxs = new Set<number>();
  const matched: CompareResult["matched"] = [];

  data.rows.forEach((row, ri) => {
    const sheetPhone = phoneCol ? normalisePhone(row[phoneCol] || "") : "";
    const sheetName  = nameCol  ? normaliseName(row[nameCol]  || "") : "";
    const sheetDate  = checkInCol ? parseDateStr(row[checkInCol] || "") : "";

    for (const permit of permits) {
      if (matchedPermitIds.has(permit.id)) continue;

      const dbPhone = normalisePhone(permit.guestPhone || "");
      const dbName  = normaliseName(permit.guestName  || "");
      const dbDate  = permit.checkIn || "";

      const phoneMatch = sheetPhone.length >= 8 && sheetPhone === dbPhone;
      const nameMatch  = sheetName.length > 2 && sheetName === dbName;
      const dateMatch  = sheetDate && dbDate && parseDateStr(dbDate) === sheetDate;

      if (phoneMatch || (nameMatch && dateMatch)) {
        matched.push({ sheetRow: row, permit });
        matchedPermitIds.add(permit.id);
        matchedSheetIdxs.add(ri);
        break;
      }
    }
  });

  const onlyInSheet = data.rows.filter((_, i) => !matchedSheetIdxs.has(i));
  const onlyInDb    = permits.filter((p) => !matchedPermitIds.has(p.id));

  return {
    sheetTotal: data.rows.length,
    dbTotal: permits.length,
    matched,
    onlyInSheet,
    onlyInDb,
  };
}

// ── Format helpers ────────────────────────────────────────────────────────────

/** YYYY-MM-DD or DD/MM/YYYY → DD/MM for display */
function fmtDate(d: string): string {
  if (!d || d === "—") return d || "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [, m, day] = d.slice(0, 10).split("-");
    return `${day}/${m}`;
  }
  if (/^\d{2}\/\d{2}/.test(d)) return d.slice(0, 5);
  return d;
}

// Flexible field keys for webhook payloads (mirrors the column aliases above)
const PL_NAME    = ["guestName","guest_name","name","guest","fullName","full_name","customer","tenant","שם","שם_אורח"];
const PL_UNIT    = ["unit","unitOrNote","unit_or_note","room","apartment","code","יחידה","חדר","דירה"];
const PL_CHECKIN = ["checkIn","check_in","checkin","arrival","from","startDate","start","date","כניסה","תאריך_כניסה"];
const PL_CHECKOUT= ["checkOut","check_out","checkout","departure","to","endDate","end","עזיבה","תאריך_עזיבה"];

function pickField(rec: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = rec[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "—";
}

function extractPayloadRecords(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const arr = p.records ?? p.bookings ?? p.items ?? p.guests ?? null;
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
}

function sortRows(
  rows: Record<string, unknown>[],
  unitKeys: string[],
  dateKeys: string[],
): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    const ua = pickField(a, unitKeys), ub = pickField(b, unitKeys);
    if (ua !== ub) return ua.localeCompare(ub, "he");
    return pickField(a, dateKeys).localeCompare(pickField(b, dateKeys));
  });
}

/**
 * Deterministic structured Hebrew webhook report — stored in trigger_events.agentOutput.
 * Shows ONLY: incoming guests + check-ins, each row ✅ (matched in sheet/DB) or ⚠️ (new).
 * Sorted: room → check-in date. No sections, no prose, no approval prompts.
 */
export function buildWebhookReport(
  clientName: string,
  payload: unknown,
  cmp: CompareResult | null,
  sheetData: SheetData | null,
): string {
  const timeStr = new Date().toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit",
  });

  const lines: string[] = [
    `🏠 ${clientName} — כניסות`,
    `🕐 ${timeStr}`,
    "",
  ];

  // ── Payload records (what arrived) ────────────────────────────────────────
  const incoming = extractPayloadRecords(payload);
  if (incoming.length > 0) {
    // For each incoming record, check if it appears in cmp.matched (i.e. known in DB)
    const matchedNames = new Set(
      (cmp?.matched ?? []).map(({ permit }) =>
        (permit.guestName ?? "").trim().toLowerCase(),
      ),
    );
    sortRows(incoming, PL_UNIT, PL_CHECKIN).forEach((r) => {
      const name  = pickField(r, PL_NAME);
      const unit  = pickField(r, PL_UNIT);
      const ci    = fmtDate(pickField(r, PL_CHECKIN));
      const co    = fmtDate(pickField(r, PL_CHECKOUT));
      const inDb  = matchedNames.has(name.toLowerCase());
      const icon  = inDb ? "✅" : "⚠️";
      const unitPart = unit && unit !== "—" ? `חדר ${unit}  |  ` : "";
      const dates = ci && ci !== "—" ? `  |  ${ci}${co && co !== "—" ? ` → ${co}` : ""}` : "";
      lines.push(`${icon}  ${unitPart}${name}${dates}`);
    });
    return lines.join("\n");
  }

  // ── No payload records — show sheet comparison only ───────────────────────
  if (cmp && sheetData) {
    const nc = findCol(sheetData.headers, NAME_COLS);
    const uc = findCol(sheetData.headers, UNIT_COLS);
    const ic = findCol(sheetData.headers, CHECKIN_COLS);
    const oc = findCol(sheetData.headers, CHECKOUT_COLS);

    type Entry = { name: string; unit: string; ci: string; co: string; inDb: boolean };
    const entries: Entry[] = [];

    cmp.matched.forEach(({ sheetRow }) => {
      entries.push({ name: (nc && sheetRow[nc]) || "—", unit: (uc && sheetRow[uc]) || "", ci: fmtDate((ic && sheetRow[ic]) || ""), co: fmtDate((oc && sheetRow[oc]) || ""), inDb: true });
    });
    cmp.onlyInSheet.forEach((row) => {
      entries.push({ name: (nc && row[nc]) || "—", unit: (uc && row[uc]) || "", ci: fmtDate((ic && row[ic]) || ""), co: fmtDate((oc && row[oc]) || ""), inDb: false });
    });

    entries.sort((a, b) => a.ci.localeCompare(b.ci) || a.name.localeCompare(b.name, "he"));

    if (entries.length === 0) {
      lines.push("אין רשומות");
    } else {
      entries.forEach((e) => {
        const icon     = e.inDb ? "✅" : "⚠️";
        const unitPart = e.unit ? `חדר ${e.unit}  |  ` : "";
        const dates    = e.ci ? `  |  ${e.ci}${e.co ? ` → ${e.co}` : ""}` : "";
        lines.push(`${icon}  ${unitPart}${e.name}${dates}`);
      });
    }
  } else {
    lines.push("אין נתונים");
  }

  return lines.join("\n");
}

// ── Build Telegram report ─────────────────────────────────────────────────────

export function buildCompareReport(
  cmp: CompareResult,
  data: SheetData,
  clientName: string,
): string {
  const nameCol    = findCol(data.headers, NAME_COLS);
  const unitCol    = findCol(data.headers, UNIT_COLS);
  const checkInCol = findCol(data.headers, CHECKIN_COLS);
  const checkOutCol= findCol(data.headers, CHECKOUT_COLS);

  const timeStr = new Date(data.fetchedAt).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit",
  });

  // Build a unified sorted list: matched rows ✅, sheet-only rows ⚠️
  type Entry = { name: string; unit: string; ci: string; co: string; inDb: boolean };
  const entries: Entry[] = [];

  cmp.matched.forEach(({ sheetRow }) => {
    entries.push({
      name:  (nameCol    && sheetRow[nameCol])    || "—",
      unit:  (unitCol    && sheetRow[unitCol])    || "",
      ci:    fmtDate((checkInCol  && sheetRow[checkInCol])  || ""),
      co:    fmtDate((checkOutCol && sheetRow[checkOutCol]) || ""),
      inDb:  true,
    });
  });

  cmp.onlyInSheet.forEach((sheetRow) => {
    entries.push({
      name:  (nameCol    && sheetRow[nameCol])    || "—",
      unit:  (unitCol    && sheetRow[unitCol])    || "",
      ci:    fmtDate((checkInCol  && sheetRow[checkInCol])  || ""),
      co:    fmtDate((checkOutCol && sheetRow[checkOutCol]) || ""),
      inDb:  false,
    });
  });

  // Sort by check-in date then name
  entries.sort((a, b) => {
    if (a.ci !== b.ci) return a.ci.localeCompare(b.ci);
    return a.name.localeCompare(b.name, "he");
  });

  const lines: string[] = [
    `🏠 <b>${clientName} — כניסות</b>`,
    `🕐 ${timeStr}`,
    "",
  ];

  if (entries.length === 0) {
    lines.push("אין רשומות בגיליון");
  } else {
    entries.forEach((e) => {
      const icon   = e.inDb ? "✅" : "⚠️";
      const dates  = e.ci ? `${e.ci}${e.co ? ` → ${e.co}` : ""}` : "";
      const unit   = e.unit ? `חדר ${e.unit}  |  ` : "";
      lines.push(`${icon}  ${unit}${e.name}${dates ? `  |  ${dates}` : ""}`);
    });
  }

  return lines.join("\n");
}

// ── Daily occupancy report ────────────────────────────────────────────────────

export type ReportIntent = "full" | "arrivals" | "departures";

// Hebrew day-of-week index (matches JS Date.getDay(): 0=Sun)
const HEB_DAYS: Record<string, number> = {
  ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5, שבת: 6,
};

function isoFromDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

/**
 * Parse a date from free Hebrew text.
 * Supports:
 *   - DD.MM.YY / DD.MM.YYYY / DD/MM... / DD-MM...
 *   - Relative: "מחר", "מחרתיים"
 *   - Hebrew day names: "יום שלישי", "שלישי הקרוב", etc.
 * Returns YYYY-MM-DD string (Israel TZ), or null if no date found.
 */
export function parseDateFromQuery(text: string): string | null {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const todayDow = now.getDay();

  // Relative keywords — avoid \b (Hebrew chars are non-word in JS regex)
  if (text.includes("מחרתיים")) {
    const d = new Date(now); d.setDate(d.getDate() + 2); return isoFromDate(d);
  }
  if (text.includes("מחר")) {
    const d = new Date(now); d.setDate(d.getDate() + 1); return isoFromDate(d);
  }
  if (text.includes("היום")) return isoFromDate(now);

  // Hebrew day name ("יום שלישי", "שלישי הקרוב", "ביום רביעי" etc.)
  for (const [name, dow] of Object.entries(HEB_DAYS)) {
    if (new RegExp(`(יום\\s*)?${name}`).test(text)) {
      let daysAhead = (dow - todayDow + 7) % 7;
      if (daysAhead === 0) daysAhead = 7;   // same day → next week
      const d = new Date(now); d.setDate(d.getDate() + daysAhead);
      return isoFromDate(d);
    }
  }

  // Explicit date: DD.MM.YY(YY) etc.
  const cleaned = text.replace(/ב-?/g, " ");
  const m = cleaned.match(/(\d{1,2})[.\/\-](\d{1,2})(?:[.\/\-](\d{2,4}))?/);
  if (!m) return null;
  const day   = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let   year  = m[3] ? parseInt(m[3], 10) : now.getFullYear();
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Determine report intent from free Hebrew text.
 * "נכנס/נכנסים/כניסות" → arrivals, "יוצא/יוצאים/יציאות" → departures, else full.
 */
export function parseReportIntent(text: string): ReportIntent {
  if (/נכנס|נכנסים|כניסה|כניסות|arrival/i.test(text)) return "arrivals";
  if (/יוצא|יוצאים|יציאה|יציאות|departure/i.test(text))  return "departures";
  return "full";
}

/**
 * Extract a room name filter from free Hebrew text.
 * Matches patterns like "חדר עדי", "לחדר עדי", "בחדר עדי", "ל עדי", "בעדי" etc.
 * Returns the bare room name, or null if not found.
 */
export function parseRoomFilter(text: string): string | null {
  // Room names are single Hebrew words (e.g. עדי, שיטה, ראג׳ה, יורט).
  // Match "חדר <word>" / "לחדר <word>" / "בחדר <word>" — no spaces in room name.
  const m = text.match(/(?:ל?ב?חדר\s+)([\u05D0-\u05EA\u05F3'"]+)/);
  if (m) return m[1].trim();
  return null;
}

/**
 * Build a Hebrew daily report from the "Turnovers" sheet tab.
 * Shows: check-ins, check-outs, turnovers, and vacant rooms for the target date.
 * @param targetDateISO  Optional YYYY-MM-DD override; defaults to today (Israel TZ).
 * @param intent         "full" | "arrivals" | "departures"
 * @param roomFilter     Optional room name to narrow results to a single room.
 */
export function buildDailyReport(
  data: SheetData,
  clientName: string,
  targetDateISO?: string,
  intent: ReportIntent = "full",
  roomFilter?: string,
): string {
  const todayISO = targetDateISO
    ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

  // Format for display (DD.MM.YYYY)
  const [y, mo, d] = todayISO.split("-");
  const todayDisplay = `${d}.${mo}.${y}`;

  // Detect columns — Beit Williams "Turnovers" sheet (fixed schema).
  // Google Sheets gviz CSV DROPS headers for date/number columns, so a
  // name-based lookup returns undefined for arrivalDate/departureDate.
  // We map by FIXED POSITION (the schema never changes), and fall back to
  // the named header when it exists (e.g. Service Account API returns them).
  //   col1=room · col2=date · col3=guests · col4=children · col5=babies
  //   col8=notes · col17=eventType · col19=arrivalDate · col20=departureDate
  const col = (name: string, pos: number): string =>
    data.headers.includes(name) ? name : `__c${pos}`;

  const unitCol        = col("room", 1);
  const dateCol        = col("date", 2);
  const eventTypeCol   = col("eventType", 17);
  const arrivalCol     = col("arrivalDate", 19);
  const departureCol   = col("departureDate", 20);
  const notesCol       = col("notes", 8);
  const guestsCountCol = col("guests", 3);
  const childrenCol    = col("children", 4);
  const babiesCol      = col("babies", 5);

  // Parse guest name & phone out of the notes field
  // Format: "אורח: NAME · טלפון: PHONE · שהות: N לילות · ..."
  function parseGuest(r: SheetRow): { name: string; phone: string } {
    const notes = notesCol ? r[notesCol] || "" : "";
    const nameMatch  = notes.match(/אורח:\s*([^·\n]+)/);
    const phoneMatch = notes.match(/טלפון:\s*([^·\n]+)/);
    return {
      name:  nameMatch  ? nameMatch[1].trim()  : "",
      phone: phoneMatch ? phoneMatch[1].trim() : "",
    };
  }

  function guestLabel(r: SheetRow): string {
    const { name, phone } = parseGuest(r);
    const room     = unitCol        ? r[unitCol]        || "" : "";
    const adults   = guestsCountCol ? Number(r[guestsCountCol]  || 0) : 0;
    const children = childrenCol    ? Number(r[childrenCol]     || 0) : 0;
    const babies   = babiesCol      ? Number(r[babiesCol]       || 0) : 0;

    // Build occupancy string: "2 מבוגרים, 1 ילד, 1 תינוק"
    const occ: string[] = [];
    if (adults   > 0) occ.push(`${adults} מבוגר${adults === 1 ? "" : "ים"}`);
    if (children > 0) occ.push(`${children} יל${children === 1 ? "ד" : "דים"}`);
    if (babies   > 0) occ.push(`${babies} תינוק${babies === 1 ? "" : "ות"}`);

    const parts: string[] = [];
    if (name)        parts.push(name);
    if (room)        parts.push(room);
    if (occ.length)  parts.push(occ.join(", "));
    if (phone)       parts.push(phone);
    return parts.join(" | ") || "(ללא פרטים)";
  }

  // Classify arrivals vs departures for today's date.
  // Each booking has TWO rows (an arrival-type row + a departure-type row),
  // both carrying the same arrivalDate/departureDate. We key off eventType so
  // each booking is counted once on the correct side.
  const ARRIVAL_TYPES   = new Set(["arrival", "check-in", "checkin", "swap", "report-arrival", "booking"]);
  const SWAP_TYPES      = new Set(["swap"]);
  const DEPARTURE_TYPES = new Set(["departure", "check-out", "checkout", "report-departure"]);

  const eventOf = (r: SheetRow) => (r[eventTypeCol] || "").toLowerCase();

  let arrivalsToday: SheetRow[] = data.rows.filter(r =>
    ARRIVAL_TYPES.has(eventOf(r)) && parseDateStr(r[arrivalCol] || "") === todayISO,
  );
  let departuresToday: SheetRow[] = data.rows.filter(r =>
    DEPARTURE_TYPES.has(eventOf(r)) && parseDateStr(r[departureCol] || "") === todayISO,
  );

  // Apply room filter (case-insensitive, partial match allowed)
  if (roomFilter && unitCol) {
    const rf = roomFilter.trim().toLowerCase();
    const roomMatch = (r: SheetRow) => (r[unitCol] || "").toLowerCase().includes(rf);
    arrivalsToday   = arrivalsToday.filter(roomMatch);
    departuresToday = departuresToday.filter(roomMatch);
  }

  // All unique room names in the sheet
  const allRooms = unitCol
    ? [...new Set(data.rows.map(r => r[unitCol] || "").filter(Boolean))].sort()
    : [];

  // Occupied TONIGHT: booking that spans tonight
  // (arrivalDate <= today AND departureDate > today — departing today = vacant tonight)
  const occupiedTonight = new Set<string>();
  if (unitCol) {
    for (const r of data.rows) {
      const room = r[unitCol];
      if (!room) continue;
      const ci = arrivalCol   ? parseDateStr(r[arrivalCol]   || "") : "";
      const co = departureCol ? parseDateStr(r[departureCol] || "") : "";
      if (ci && co && ci <= todayISO && co > todayISO) occupiedTonight.add(room);
    }
  }

  // Turnovers: rooms with BOTH a departure AND an arrival today
  const roomsArriving  = new Set(arrivalsToday.map(r  => unitCol ? r[unitCol] : "").filter(Boolean));
  const roomsDeparting = new Set(departuresToday.map(r => unitCol ? r[unitCol] : "").filter(Boolean));
  const turnoverRooms  = [...roomsDeparting].filter(r => roomsArriving.has(r)).sort();

  const vacantRooms = allRooms.filter(r => !occupiedTonight.has(r));

  const dayLabel  = todayISO === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" })
    ? "היום" : `ב-${todayDisplay}`;

  const roomLabel = roomFilter ? ` · חדר ${roomFilter}` : "";
  const lines: string[] = [
    `📋 <b>דוח — ${clientName}${roomLabel}</b>`,
    `📅 ${todayDisplay}`,
    "",
  ];

  if (intent === "full" || intent === "arrivals") {
    lines.push(
      `🟢 <b>נכנסים ${dayLabel} (${arrivalsToday.length}):</b>`,
      ...(arrivalsToday.length === 0
        ? ["  אין כניסות"]
        : arrivalsToday.map(r => `  • ${guestLabel(r)}`)),
    );
  }

  if (intent === "full") lines.push("");

  if (intent === "full" || intent === "departures") {
    lines.push(
      `🔴 <b>יוצאים ${dayLabel} (${departuresToday.length}):</b>`,
      ...(departuresToday.length === 0
        ? ["  אין יציאות"]
        : departuresToday.map(r => `  • ${guestLabel(r)}`)),
    );
  }

  if (intent === "full") {
    // Swaps: a same-day turnover — the new guest's arrivalDate is today.
    let swapsToday: SheetRow[] = data.rows.filter(r =>
      SWAP_TYPES.has(eventOf(r)) && parseDateStr(r[arrivalCol] || "") === todayISO,
    );
    if (roomFilter && unitCol) {
      const rf = roomFilter.trim().toLowerCase();
      swapsToday = swapsToday.filter(r => (r[unitCol] || "").toLowerCase().includes(rf));
    }

    if (swapsToday.length > 0) {
      lines.push(
        "",
        `🔄 <b>החלפות ${dayLabel} (${swapsToday.length}):</b>`,
        ...swapsToday.map(r => `  • ${guestLabel(r)}`),
      );
    }

    if (turnoverRooms.length > 0) {
      lines.push("", `✨ <b>חדרים מתחלפים (${turnoverRooms.length}):</b>`);
      turnoverRooms.forEach(room => lines.push(`  ${room}`));
    }

    const occupiedRooms = allRooms.filter(r => occupiedTonight.has(r));
    lines.push(
      "",
      `🟦 <b>חדרים מאוכלסים הלילה (${occupiedRooms.length}/${allRooms.length}):</b>`,
      ...(occupiedRooms.length === 0
        ? ["  אין חדרים מאוכלסים"]
        : occupiedRooms.map(r => `  • ${r}`)),
    );

    lines.push(
      "",
      `🏠 <b>חדרים ריקים הלילה (${vacantRooms.length}/${allRooms.length}):</b>`,
      ...(vacantRooms.length === 0
        ? ["  כל החדרים מאוכלסים ✅"]
        : vacantRooms.map(r => `  • ${r}`)),
    );
  }

  return lines.join("\n");
}

export interface OccupancySnapshot {
  todayISO: string;
  todayDisplay: string;
  allRooms: string[];
  occupiedRooms: string[];
  vacantRooms: string[];
  arrivalRooms: string[];
  departureRooms: string[];
  swapRooms: string[];
  turnoverRooms: string[];
}

/**
 * Core occupancy computation — single source of truth shared by /דוח and the
 * free-text chat answers. Same column mapping (fixed Turnovers positions, with
 * named-header fallback) and the same arrivalDate<=today<departureDate rule.
 */
export function computeOccupancy(data: SheetData, targetDateISO?: string): OccupancySnapshot {
  const todayISO = targetDateISO
    ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const [y, mo, d] = todayISO.split("-");
  const todayDisplay = `${d}.${mo}.${y}`;

  const col = (name: string, pos: number): string =>
    data.headers.includes(name) ? name : `__c${pos}`;
  const unitCol      = col("room", 1);
  const eventTypeCol = col("eventType", 17);
  const arrivalCol   = col("arrivalDate", 19);
  const departureCol = col("departureDate", 20);

  const ARRIVAL_TYPES   = new Set(["arrival", "check-in", "checkin", "swap", "report-arrival", "booking"]);
  const SWAP_TYPES      = new Set(["swap"]);
  const DEPARTURE_TYPES = new Set(["departure", "check-out", "checkout", "report-departure"]);
  const eventOf = (r: SheetRow) => (r[eventTypeCol] || "").toLowerCase();
  const roomsOf = (rows: SheetRow[]) =>
    [...new Set(rows.map(r => r[unitCol]).filter(Boolean))].sort();

  const allRooms = [...new Set(data.rows.map(r => r[unitCol] || "").filter(Boolean))].sort();

  const occupied = new Set<string>();
  for (const r of data.rows) {
    const room = r[unitCol];
    if (!room) continue;
    const ci = parseDateStr(r[arrivalCol]   || "");
    const co = parseDateStr(r[departureCol] || "");
    if (ci && co && ci <= todayISO && co > todayISO) occupied.add(room);
  }
  const occupiedRooms = allRooms.filter(r => occupied.has(r));
  const vacantRooms   = allRooms.filter(r => !occupied.has(r));

  const arrivalRooms = roomsOf(data.rows.filter(r =>
    ARRIVAL_TYPES.has(eventOf(r)) && parseDateStr(r[arrivalCol] || "") === todayISO));
  const departureRooms = roomsOf(data.rows.filter(r =>
    DEPARTURE_TYPES.has(eventOf(r)) && parseDateStr(r[departureCol] || "") === todayISO));
  const swapRooms = roomsOf(data.rows.filter(r =>
    SWAP_TYPES.has(eventOf(r)) && parseDateStr(r[arrivalCol] || "") === todayISO));

  const arrivingSet = new Set(arrivalRooms);
  const turnoverRooms = departureRooms.filter(r => arrivingSet.has(r)).sort();

  return { todayISO, todayDisplay, allRooms, occupiedRooms, vacantRooms, arrivalRooms, departureRooms, swapRooms, turnoverRooms };
}

/**
 * Structured occupancy facts block — injected into the chat system prompt so the
 * model can phrase answers grounded in real numbers (never invents counts).
 */
export function buildOccupancyFacts(
  data: SheetData,
  clientName: string,
  targetDateISO?: string,
): string {
  const s = computeOccupancy(data, targetDateISO);
  const j = (a: string[]) => a.join(", ") || "—";
  return [
    "---",
    "",
    `## 📊 נתוני תפוסה — ${clientName} (לתאריך ${s.todayDisplay} · מקור אמת: הגיליון)`,
    `- סה"כ חדרים: ${s.allRooms.length} (${j(s.allRooms)})`,
    `- מאוכלסים הלילה: ${s.occupiedRooms.length} (${j(s.occupiedRooms)})`,
    `- ריקים הלילה: ${s.vacantRooms.length} (${j(s.vacantRooms)})`,
    `- נכנסים היום: ${s.arrivalRooms.length} (${j(s.arrivalRooms)})`,
    `- יוצאים היום: ${s.departureRooms.length} (${j(s.departureRooms)})`,
    `- החלפות היום (יציאה+כניסה באותו חדר): ${s.turnoverRooms.length} (${j(s.turnoverRooms)})`,
    `- חדרים בהחלפה (swap) היום: ${s.swapRooms.length} (${j(s.swapRooms)})`,
    "",
    "## הנחיות תשובה",
    "- ענה בעברית, בקצרה וברור, אך ורק על סמך המספרים שלמעלה.",
    "- אל תמציא חדרים, שמות או מספרים שלא מופיעים למעלה.",
  ].join("\n");
}

/**
 * Deterministic, targeted Hebrew answer to a free-text occupancy question.
 * Computed in JS from the sheet (no LLM) so the numbers are always correct and
 * never blocked by rate limits. Picks the relevant metric from the question;
 * falls back to a full summary for broad ("מה המצב") questions.
 */
export function buildOccupancyAnswer(
  data: SheetData,
  clientName: string,
  question: string,
  targetDateISO?: string,
): string {
  const s = computeOccupancy(data, targetDateISO);
  const j = (a: string[]) => a.join(", ") || "—";
  const when = targetDateISO ? `ל-${s.todayDisplay}` : "הלילה";
  const head = `🏨 <b>${clientName}</b> · ${s.todayDisplay}`;

  const lc = question.toLowerCase();
  const wantsVacant   = /ריק|פנוי|מתפנה|פנויים/.test(lc);
  const wantsSwap     = /מתחלף|החלפ|swap|turnover/.test(lc);
  const wantsArrival  = /נכנס|כניס|מגיע|צ'ק.?אין|check.?in/.test(lc);
  const wantsDeparture= /יוצא|יציא|עוזב|מתפנ|צ'ק.?אאוט|check.?out/.test(lc);
  const wantsOccupied = /מאוכלס|תפוס|תפוסה|שוהה|מי\s*(נמצא|יש)|דייר|אורח/.test(lc);

  // Specific single-metric questions → focused answer.
  if (wantsVacant && !wantsOccupied) {
    return `${head}\n\n🏠 <b>ריקים ${when} (${s.vacantRooms.length}/${s.allRooms.length}):</b> ${j(s.vacantRooms)}`;
  }
  if (wantsSwap) {
    const tu = s.turnoverRooms.length ? j(s.turnoverRooms) : (s.swapRooms.length ? j(s.swapRooms) : "אין");
    return `${head}\n\n🔄 <b>חדרים בהחלפה היום (${Math.max(s.turnoverRooms.length, s.swapRooms.length)}):</b> ${tu}`;
  }
  if (wantsArrival && !wantsDeparture && !wantsOccupied) {
    return `${head}\n\n🟢 <b>נכנסים היום (${s.arrivalRooms.length}):</b> ${j(s.arrivalRooms)}`;
  }
  if (wantsDeparture && !wantsArrival && !wantsOccupied) {
    return `${head}\n\n🔴 <b>יוצאים היום (${s.departureRooms.length}):</b> ${j(s.departureRooms)}`;
  }
  if (wantsOccupied && !wantsVacant) {
    return `${head}\n\n🟦 <b>מאוכלסים ${when} (${s.occupiedRooms.length}/${s.allRooms.length}):</b> ${j(s.occupiedRooms)}`;
  }

  // Broad / mixed question → full snapshot.
  return [
    head,
    "",
    `🟦 מאוכלסים ${when} (${s.occupiedRooms.length}/${s.allRooms.length}): ${j(s.occupiedRooms)}`,
    `🏠 ריקים ${when} (${s.vacantRooms.length}/${s.allRooms.length}): ${j(s.vacantRooms)}`,
    `🟢 נכנסים היום (${s.arrivalRooms.length}): ${j(s.arrivalRooms)}`,
    `🔴 יוצאים היום (${s.departureRooms.length}): ${j(s.departureRooms)}`,
    `🔄 החלפות היום (${s.turnoverRooms.length}): ${j(s.turnoverRooms)}`,
  ].join("\n");
}

/** Fallback: plain sheet summary (no DB comparison) */
export function buildSheetSummary(data: SheetData, sheetTitle?: string): string {
  const timeStr = new Date(data.fetchedAt).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const title = sheetTitle ? `📊 <b>${sheetTitle}</b>` : "📊 <b>נתוני Google Sheets</b>";

  if (data.rows.length === 0) {
    return [title, "", `🕐 ${timeStr}`, "⚠️ <b>אין שורות נתונים בגיליון</b>"].join("\n");
  }

  const nameCol = findCol(data.headers, NAME_COLS);
  const previewCount = Math.min(data.rows.length, 10);
  const rowLines = data.rows.slice(0, previewCount).map((row, i) => {
    const label = nameCol ? row[nameCol] : Object.values(row).filter(Boolean).slice(0,3).join(" | ");
    return `${i + 1}. ${label}`;
  });

  return [
    title, "",
    `🕐 <b>זמן קריאה:</b> ${timeStr}`,
    `📋 <b>סה"כ שורות:</b> ${data.rows.length}`,
    `📌 <b>עמודות:</b> ${data.headers.join(", ")}`,
    "", `<b>נתונים:</b>`,
    ...rowLines,
    ...(data.rows.length > previewCount ? [`… ועוד ${data.rows.length - previewCount}`] : []),
  ].join("\n");
}
