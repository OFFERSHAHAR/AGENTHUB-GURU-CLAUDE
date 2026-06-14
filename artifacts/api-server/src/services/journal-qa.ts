/**
 * Journal Q&A — natural-language questions over the structured occupancy journal.
 *
 * Two halves of the "both pipeline":
 *   1. ingestPayloadToJournal  — webhook booking payloads → structured permits.
 *   2. maybeAnswerFromJournal  — a client question → deterministic DB query → factual
 *      context the chat model answers from (never invents counts; the count is computed
 *      in JS, the model only phrases it).
 *
 * Gating happens at the call sites via agent tags ("journal-qa" / "journal-ingest").
 */
import { eq, and, isNull } from "drizzle-orm";
import { db, palgatePermitsTable } from "@workspace/db";
import { runModel, type ModelTier } from "./model-router.js";
import { mapRecordToPermit } from "./palgate-chain.js";

type Permit = typeof palgatePermitsTable.$inferSelect;

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export interface JournalQuery {
  isDataQuestion: boolean;
  metric: "count" | "list";
  basis: "entry" | "exit" | "presence";
  room: string | null;
  guestName: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  dayOfWeek: number | null;
}

export interface JournalQueryResult {
  count: number;
  rows: Permit[];
  totalForClient: number;
}

/** Prefer a working, cheap model for the internal JSON-extraction task. */
function pickInternalTier(): ModelTier {
  // Use the small/fast model for JSON extraction — llama-3.3-70b has only 100 TPD
  // on the free on-demand tier and gets rate-limited quickly.
  if (process.env.GROQ_API_KEY) return "fallback"; // llama-3.1-8b-instant
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_API_KEY) return "pro";
  return "free";
}

function emptyQuery(): JournalQuery {
  return {
    isDataQuestion: false,
    metric: "count",
    basis: "entry",
    room: null,
    guestName: null,
    dateFrom: null,
    dateTo: null,
    dayOfWeek: null,
  };
}

function toIsoDate(value: string): string | null {
  const direct = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const dmy = value.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${m}-${d}`;
  }
  return null;
}

/** Regex/keyword extraction — used as fallback and to fill gaps the LLM misses. */
function heuristicExtract(content: string): JournalQuery {
  const q = emptyQuery();
  const text = content.trim();
  const lc = text.toLowerCase();

  // room: "חדר 12", "חדר A", "room 5", "יחידה 3"
  const roomMatch = text.match(/(?:חדר|יחידה|דירה|room|unit)\s*([\wא-ת\-]+)/i);
  if (roomMatch) q.room = roomMatch[1];

  // dates
  const dates: string[] = [];
  const dateRe = /(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = dateRe.exec(text)) !== null) {
    const iso = toIsoDate(m[1]);
    if (iso) dates.push(iso);
  }
  if (dates.length === 1) {
    q.dateFrom = dates[0];
    q.dateTo = dates[0];
  } else if (dates.length >= 2) {
    dates.sort();
    q.dateFrom = dates[0];
    q.dateTo = dates[dates.length - 1];
  }

  // day of week — "יום חמישי", "ביום חמישי", "בחמישי", "חמישי הקרוב", "הקרוב"
  for (let i = 0; i < HEB_DAYS.length; i++) {
    const day = HEB_DAYS[i];
    if (
      text.includes(`יום ${day}`) ||
      text.includes(`ביום ${day}`) ||
      text.includes(`ב${day}`) ||          // "בחמישי"
      new RegExp(`${day}\\s*(ה?קרוב|ה?בא|זה)?`).test(text)  // "חמישי הקרוב"
    ) {
      q.dayOfWeek = i;
      break;
    }
  }

  // Compute the absolute date for "הקרוב/הבא" references when dayOfWeek is known
  if (q.dayOfWeek != null && !q.dateFrom && /(קרוב|הבא|הבאה|הבא)/.test(text)) {
    const today = new Date();
    const todayDow = today.getUTCDay(); // 0=Sun
    let daysAhead = (q.dayOfWeek - todayDow + 7) % 7;
    if (daysAhead === 0) daysAhead = 7; // "הקרוב" always means in the future
    const target = new Date(today);
    target.setUTCDate(target.getUTCDate() + daysAhead);
    const iso = target.toISOString().split("T")[0];
    q.dateFrom = iso;
    q.dateTo = iso;
  }

  // Guest name: "X לא מופיע/מופיעה", "אורח X", "למה X"
  const guestAbsenceMatch = text.match(/(?:למה|מדוע|איפה)\s+([\u05D0-\u05EA]{2,})\s+(?:לא\s+)?(?:מופיע|מופיעה|נמצא|נמצאת|רשום|רשומה)/);
  const guestNameMatch = text.match(/(?:אורח(?:ת)?|guest|הדייר(?:ת)?)\s+([\u05D0-\u05EA\s]{2,10})/);
  if (guestAbsenceMatch) q.guestName = guestAbsenceMatch[1].trim();
  else if (guestNameMatch) q.guestName = guestNameMatch[1].trim();

  // basis
  if (/(יצא|עזב|עזיבה|יציאה|צ'ק.?אאוט|checkout|check-out|departure)/i.test(lc)) q.basis = "exit";
  else if (/(שוהה|נמצא|מאוכלס|תפוס|תפוסה|present|occupanc|staying)/i.test(lc)) q.basis = "presence";
  else q.basis = "entry";

  q.metric = /(רשימה|מי הם|פרט|list|who)/i.test(lc) ? "list" : "count";

  const hasCountWord = /(כמה|מספר|how many|count)/i.test(lc);
  const hasAbsenceQuery = /(לא מופיע|לא מופיעה|לא רשום|לא רשומה|לא נמצא|למה.*לא|מדוע.*לא)/i.test(lc);
  // Broad status/overview queries — "מה המצב?", "מי נמצא?", "הצג אורחים", "סיכום"
  const hasBroadQuery = /(מה המצב|מה קורה|מי נמצא|מי שוהה|הצג אורח|הצג דייר|סיכום|overview|summary|תפוסה|occupanc|כל האורח|כל הדייר|פעיל|active guest)/i.test(lc);
  q.isDataQuestion = !!(q.room || q.guestName || q.dateFrom || q.dayOfWeek != null || hasCountWord || hasAbsenceQuery || hasBroadQuery);
  // For broad queries with no date filter, default basis to "presence" (who is currently here)
  if (hasBroadQuery && !q.dateFrom && q.basis === "entry") {
    q.basis = "presence";
    q.metric = "list";
    // Default window: today onwards — show current + upcoming stays
    const today = new Date().toISOString().split("T")[0];
    q.dateTo = null; // no upper bound
    q.dateFrom = today; // check_out >= today (handled by presence filter)
  }
  return q;
}

function safeParseQuery(raw: string): Partial<JournalQuery> | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const obj = JSON.parse(s.slice(start, end + 1));
    return obj as Partial<JournalQuery>;
  } catch {
    return null;
  }
}

export async function extractJournalQuery(content: string): Promise<JournalQuery> {
  // Always run the heuristic first — zero cost, zero TPM.
  // Only call the LLM when the heuristic already detected a data question, to refine
  // extraction quality (better date/room parsing). If heuristic says "not a data
  // question", skip the LLM entirely — saves TPM and prevents internal-call spam.
  const heur = heuristicExtract(content);
  if (!heur.isDataQuestion) return heur;

  const todayIso = new Date().toISOString().split("T")[0];
  const todayDow = HEB_DAYS[new Date().getUTCDay()];

  const sys = `אתה ממיר שאלה בשפה טבעית על יומן תפוסת אורחים ל-JSON תקין בלבד.
היום: ${todayIso} (יום ${todayDow}).
החזר אך ורק אובייקט JSON במבנה הבא, ללא טקסט נוסף:
{
  "isDataQuestion": boolean,
  "metric": "count" | "list",
  "basis": "entry" | "exit" | "presence",
  "room": string | null,
  "guestName": string | null,
  "dateFrom": "YYYY-MM-DD" | null,
  "dateTo": "YYYY-MM-DD" | null,
  "dayOfWeek": number | null
}
הסבר שדות:
- isDataQuestion: true אם זו שאלה על נתוני היומן (כניסות/יציאות/תפוסה/חדרים/אורחים/תאריכים/שמות).
  גם "למה X לא מופיע" היא שאלת נתונים (isDataQuestion=true).
- basis: "entry" לכניסות (נכנסים), "exit" ליציאות (עוזבים), "presence" למי ששוהה בתאריך.
- guestName: שם האורח אם השאלה על אורח ספציפי (כולל שאלות "למה X לא מופיע"), null אחרת.
- dayOfWeek: 0=ראשון, 1=שני, 2=שלישי, 3=רביעי, 4=חמישי, 5=שישי, 6=שבת. null אם לא צוין.
  "חמישי הקרוב" → dayOfWeek=4. "ראשון הבא" → dayOfWeek=0.
- אם צוין תאריך יחיד — שים אותו גם ב-dateFrom וגם ב-dateTo.
- פענח תאריכים יחסיים ("היום", "מחר", "השבוע", "חמישי הקרוב") יחסית להיום.
- אם השאלה אינה על נתוני היומן — החזר isDataQuestion=false.`;

  let parsed: Partial<JournalQuery> | null = null;
  try {
    const r = await runModel(pickInternalTier(), sys, content, "journal-qa-extract");
    if (r.content && r.content !== "__TEMPLATE__") parsed = safeParseQuery(r.content);
  } catch {
    parsed = null;
  }

  if (!parsed) return heur;

  const dow =
    typeof parsed.dayOfWeek === "number" && parsed.dayOfWeek >= 0 && parsed.dayOfWeek <= 6
      ? parsed.dayOfWeek
      : heur.dayOfWeek;

  // Prefer heuristic dates for relative references ("הקרוב", "מחר") — the heuristic
  // computes from the actual JS clock. The LLM only knows the date from the prompt
  // and frequently mis-computes relative weekday offsets.
  const llmDateFrom = parsed.dateFrom && toIsoDate(String(parsed.dateFrom));
  const llmDateTo   = parsed.dateTo   && toIsoDate(String(parsed.dateTo));
  const dateFrom = heur.dateFrom || llmDateFrom || null;
  const dateTo   = heur.dateTo   || llmDateTo   || null;

  return {
    isDataQuestion: typeof parsed.isDataQuestion === "boolean" ? parsed.isDataQuestion : heur.isDataQuestion,
    metric: parsed.metric === "list" ? "list" : "count",
    basis: parsed.basis === "exit" || parsed.basis === "presence" ? parsed.basis : heur.basis,
    room: (parsed.room && String(parsed.room).trim()) || heur.room,
    guestName: (parsed.guestName && String(parsed.guestName).trim()) || heur.guestName,
    dateFrom,
    dateTo,
    dayOfWeek: dow,
  };
}

/**
 * For presence queries, a weekday filter means "does the stay include at least one
 * day with this weekday, within the requested window". We walk the overlap of the
 * stay [checkIn, checkOut] with the requested [from, to] window day by day.
 */
function stayCoversWeekday(
  checkIn: string,
  checkOut: string,
  from: string | null,
  to: string | null,
  dow: number,
): boolean {
  let start = checkIn;
  let end = checkOut;
  if (from && from > start) start = from;
  if (to && to < end) end = to;
  if (start > end) return false;

  let d = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  if (isNaN(d.getTime()) || isNaN(endD.getTime())) return false;

  let guard = 0;
  while (d <= endD && guard < 400) {
    if (d.getUTCDay() === dow) return true;
    d.setUTCDate(d.getUTCDate() + 1);
    guard++;
  }
  return false;
}

export async function queryJournal(clientId: number, q: JournalQuery): Promise<JournalQueryResult> {
  const all = await db.select().from(palgatePermitsTable).where(eq(palgatePermitsTable.clientId, clientId));

  let from = q.dateFrom;
  let to = q.dateTo;
  if (from && !to) to = from;
  if (to && !from) from = to;

  const roomNorm      = q.room      ? q.room.trim().toLowerCase()      : null;
  const guestNameNorm = q.guestName ? q.guestName.trim().toLowerCase() : null;

  const filtered = all.filter((r) => {
    if (roomNorm) {
      const u = (r.unitOrNote || "").trim().toLowerCase();
      if (!u || !u.includes(roomNorm)) return false;
    }
    if (guestNameNorm) {
      // Search across both guest name AND room/unit — handles named rooms like "קרון"
      const name = (r.guestName  || "").trim().toLowerCase();
      const unit = (r.unitOrNote || "").trim().toLowerCase();
      if (!name.includes(guestNameNorm) && !unit.includes(guestNameNorm)) return false;
    }

    if (q.basis === "presence") {
      if (from && r.checkOut < from) return false;
      if (to && r.checkIn > to) return false;
    } else {
      const dateForBasis = q.basis === "exit" ? r.checkOut : r.checkIn;
      if (from && dateForBasis < from) return false;
      if (to && dateForBasis > to) return false;
    }

    if (q.dayOfWeek != null) {
      if (q.basis === "presence") {
        if (!stayCoversWeekday(r.checkIn, r.checkOut, from, to, q.dayOfWeek)) return false;
      } else {
        const dateForBasis = q.basis === "exit" ? r.checkOut : r.checkIn;
        const d = new Date(`${dateForBasis}T00:00:00Z`);
        if (isNaN(d.getTime()) || d.getUTCDay() !== q.dayOfWeek) return false;
      }
    }

    return true;
  });

  return { count: filtered.length, rows: filtered.slice(0, 25), totalForClient: all.length };
}

function describeFilters(q: JournalQuery): string {
  const bits: string[] = [];
  if (q.guestName) bits.push(`שם/חדר: "${q.guestName}"`);
  if (q.room) bits.push(`חדר ${q.room}`);
  if (q.dateFrom && q.dateTo && q.dateFrom === q.dateTo) bits.push(`בתאריך ${q.dateFrom}`);
  else if (q.dateFrom || q.dateTo) bits.push(`בטווח ${q.dateFrom || "?"} עד ${q.dateTo || "?"}`);
  if (q.dayOfWeek != null) bits.push(`ביום ${HEB_DAYS[q.dayOfWeek]}`);
  const basisLabel = q.basis === "exit" ? "יציאות" : q.basis === "presence" ? "שהייה" : "כניסות";
  bits.push(`(${basisLabel})`);
  return bits.join(" ");
}

function formatRows(rows: Permit[]): string {
  return rows
    .map((r, i) => {
      const unit = r.unitOrNote || "—";
      // Avoid "חדר חדר X" if unitOrNote already starts with "חדר"
      const unitLabel = /^(חדר|unit|room|דירה|יחידה)/i.test(unit) ? unit : `חדר ${unit}`;
      return `${i + 1}. ${r.guestName} — ${unitLabel} — ${r.checkIn} עד ${r.checkOut} (${r.status})`;
    })
    .join("\n");
}

export function buildJournalContext(
  q: JournalQuery,
  result: JournalQueryResult,
): { contextBlock: string; deterministicAnswer: string } {
  const filters = describeFilters(q);
  const list = result.rows.length > 0 ? `\n${formatRows(result.rows)}` : "";
  const more = result.count > result.rows.length ? `\n…ועוד ${result.count - result.rows.length} רשומות.` : "";

  const contextBlock = `---

## 📒 נתוני יומן רלוונטיים (מקור אמת — טבלת התפוסה)
זוהתה שאלת נתונים. להלן תוצאת שאילתה אמיתית מבסיס הנתונים עבור לקוח זה:
- סינון: ${filters}
- **מספר רשומות תואמות: ${result.count}** (מתוך ${result.totalForClient} רשומות יומן ללקוח זה)${list}${more}

## הנחיות תשובה
- ענה ללקוח בעברית, בקצרה וברור, אך ורק על סמך הנתונים שלמעלה.
- אם מספר הרשומות התואמות הוא 0 — אמור במפורש שאין רשומות תואמות ביומן; אל תמציא.
- אל תמציא שמות, תאריכים או מספרים שלא מופיעים למעלה.`;

  const deterministicAnswer =
    result.count === 0
      ? `לא נמצאו רשומות ביומן התואמות ל${filters}. ייתכן שעדיין לא נקלטו נתונים מתאימים.`
      : `נמצאו ${result.count} רשומות ${filters}:\n${formatRows(result.rows)}${more}`;

  return { contextBlock, deterministicAnswer };
}

/**
 * If the message is a journal data question, run the query and return the context
 * block (to augment the chat system prompt) plus a deterministic answer (used when
 * the chat model is unavailable). Returns null for ordinary conversation.
 */
export async function maybeAnswerFromJournal(
  clientId: number,
  content: string,
): Promise<{ contextBlock: string; deterministicAnswer: string; query: JournalQuery; count: number } | null> {
  const q = await extractJournalQuery(content);
  if (!q.isDataQuestion) return null;
  const result = await queryJournal(clientId, q);
  const { contextBlock, deterministicAnswer } = buildJournalContext(q, result);
  return { contextBlock, deterministicAnswer, query: q, count: result.count };
}

// ─── Ingestion ────────────────────────────────────────────────────────────────

function extractRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["records", "bookings", "data", "rows", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
    if (obj.booking && typeof obj.booking === "object") return [obj.booking as Record<string, unknown>];
    return [obj];
  }
  return [];
}

/**
 * Best-effort: map booking-like webhook records into structured journal permits.
 * Skips records missing required fields and exact duplicates. Never throws to callers
 * that don't await it; failures are isolated per record.
 */
export async function ingestPayloadToJournal(
  clientId: number,
  payload: unknown,
): Promise<{ created: number; skipped: number }> {
  const records = extractRecords(payload);
  let created = 0;
  let skipped = 0;

  for (const rec of records) {
    try {
      const mapped = mapRecordToPermit(rec);
      if (!mapped) {
        skipped++;
        continue;
      }

      // Dedup on the full identity of a booking — including unit/note — so two
      // distinct bookings that share a phone and date span but differ by room are
      // not collapsed (mirrors the source key used by the Optima sync chain).
      const existing = await db
        .select({ id: palgatePermitsTable.id })
        .from(palgatePermitsTable)
        .where(
          and(
            eq(palgatePermitsTable.clientId, clientId),
            eq(palgatePermitsTable.guestPhone, mapped.guestPhone),
            eq(palgatePermitsTable.checkIn, mapped.checkIn),
            eq(palgatePermitsTable.checkOut, mapped.checkOut),
            mapped.unitOrNote == null
              ? isNull(palgatePermitsTable.unitOrNote)
              : eq(palgatePermitsTable.unitOrNote, mapped.unitOrNote),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(palgatePermitsTable).values({
        clientId,
        guestName: mapped.guestName,
        guestPhone: mapped.guestPhone,
        unitOrNote: mapped.unitOrNote,
        checkIn: mapped.checkIn,
        checkOut: mapped.checkOut,
        // Match the canonical creation lifecycle (pending → active → removed). Every
        // other path that creates a permit starts at "pending"; writing "active" here
        // would mislabel a fresh booking as already confirmed-on-gate and let the
        // departures flow (which matches status="active") act on a gate entry that
        // was never actually added.
        status: "pending",
      });
      created++;
    } catch (err) {
      // Per-record isolation: one bad record must not abort the rest of the batch.
      skipped++;
      console.error("[journal-ingest] record failed:", err instanceof Error ? err.message : err);
    }
  }

  return { created, skipped };
}
