/**
 * Optima occupancy sync with a MANDATORY human-in-the-loop approval gate.
 *
 * runSyncForConnector(): pull fresh data from Optima → diff against the last
 * APPLIED snapshot → create one PENDING approval → notify the client's Telegram
 * chat with Approve/Cancel buttons. Nothing is committed until a human approves.
 *
 * applyApproval()/cancelApproval(): the only ways a pending sync moves forward.
 * The most-recent APPLIED approval's proposedData IS the current snapshot, so a
 * commit is simply flipping status to "applied".
 */
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db,
  rpaConnectorsTable,
  clientsTable,
  optimaSyncApprovalsTable,
  type OptimaSyncApproval,
} from "@workspace/db";
import {
  runAction,
  establishOptimaSession,
  getSessionStatus,
  type SystemType,
} from "./rpa-engine.js";
import {
  sendMessageWithButtons,
  editMessageText,
  getOpsChatId,
} from "../lib/telegram-api.js";
import { chainOptimaToPalgate } from "./palgate-chain.js";

const SYNC_ACTION = "get_occupancy";

function decodePassword(enc: string): string {
  try { return Buffer.from(enc, "base64").toString("utf-8"); } catch { return enc; }
}

// ─── Auto-sync config (stored in rpaConnectorsTable.metadata JSON) ────────────

export interface AutoSyncConfig {
  enabled: boolean;
  intervalHours: number;
}

export function readAutoSync(metadata: string | null): AutoSyncConfig {
  if (!metadata) return { enabled: false, intervalHours: 5 };
  try {
    const m = JSON.parse(metadata) as { autoSync?: Partial<AutoSyncConfig> };
    return {
      enabled: Boolean(m.autoSync?.enabled),
      intervalHours: m.autoSync?.intervalHours ?? 5,
    };
  } catch {
    return { enabled: false, intervalHours: 5 };
  }
}

export function writeAutoSync(metadata: string | null, cfg: AutoSyncConfig): string {
  let base: Record<string, unknown> = {};
  if (metadata) { try { base = JSON.parse(metadata); } catch { base = {}; } }
  base.autoSync = cfg;
  return JSON.stringify(base);
}

// ─── Normalisation + diff ─────────────────────────────────────────────────────

function toRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["rows", "data", "items", "records", "occupancy"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
    return [obj];
  }
  return [];
}

function recordKey(rec: Record<string, unknown>, idx: number): string {
  for (const k of ["id", "key", "date", "room", "unit", "code"]) {
    if (rec[k] != null) return String(rec[k]);
  }
  return `__idx_${idx}`;
}

export interface DiffSummary {
  newCount: number;
  overwriteCount: number;
  removedCount: number;
  unchangedCount: number;
}

export function diffRecords(
  previous: Record<string, unknown>[],
  next: Record<string, unknown>[],
): DiffSummary {
  const prevMap = new Map<string, string>();
  previous.forEach((r, i) => prevMap.set(recordKey(r, i), JSON.stringify(r)));
  const nextKeys = new Set<string>();

  let newCount = 0, overwriteCount = 0, unchangedCount = 0;
  next.forEach((r, i) => {
    const key = recordKey(r, i);
    nextKeys.add(key);
    const serialized = JSON.stringify(r);
    if (!prevMap.has(key)) newCount++;
    else if (prevMap.get(key) !== serialized) overwriteCount++;
    else unchangedCount++;
  });

  // Records present in the snapshot but absent from the fresh pull = removals.
  let removedCount = 0;
  for (const key of prevMap.keys()) {
    if (!nextKeys.has(key)) removedCount++;
  }

  return { newCount, overwriteCount, removedCount, unchangedCount };
}

export function hasChanges(diff: DiffSummary): boolean {
  return diff.newCount > 0 || diff.overwriteCount > 0 || diff.removedCount > 0;
}

export interface RecordDelta {
  added: Record<string, unknown>[];
  removed: Record<string, unknown>[];
}

/** Record-level delta (the actual rows, not just counts) between two snapshots. */
export function splitRecords(
  previous: Record<string, unknown>[],
  next: Record<string, unknown>[],
): RecordDelta {
  const prevKeys = new Set<string>();
  previous.forEach((r, i) => prevKeys.add(recordKey(r, i)));
  const nextKeys = new Set<string>();
  next.forEach((r, i) => nextKeys.add(recordKey(r, i)));

  const added = next.filter((r, i) => !prevKeys.has(recordKey(r, i)));
  const removed = previous.filter((r, i) => !nextKeys.has(recordKey(r, i)));
  return { added, removed };
}

// ─── Snapshot lookup ──────────────────────────────────────────────────────────

async function getLastAppliedData(connectorId: number): Promise<Record<string, unknown>[]> {
  const [last] = await db
    .select()
    .from(optimaSyncApprovalsTable)
    .where(and(
      eq(optimaSyncApprovalsTable.connectorId, connectorId),
      eq(optimaSyncApprovalsTable.status, "applied"),
    ))
    .orderBy(desc(optimaSyncApprovalsTable.appliedAt))
    .limit(1);
  if (!last?.proposedData) return [];
  try { return toRecords(JSON.parse(last.proposedData)); } catch { return []; }
}

async function hasOpenApproval(connectorId: number): Promise<boolean> {
  const open = await db
    .select({ id: optimaSyncApprovalsTable.id })
    .from(optimaSyncApprovalsTable)
    .where(and(
      eq(optimaSyncApprovalsTable.connectorId, connectorId),
      inArray(optimaSyncApprovalsTable.status, ["pending", "approved"]),
    ))
    .limit(1);
  return open.length > 0;
}

// ─── Telegram message ─────────────────────────────────────────────────────────

function buildApprovalMessage(opts: {
  clientName: string;
  connectorName: string;
  diff: DiffSummary;
}): string {
  const { clientName, connectorName, diff } = opts;
  const timeStr = new Date().toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
  });
  return [
    "🔄 <b>סנכרון נתוני תפוסה — Optima</b>",
    "",
    `👤 <b>לקוח:</b> ${clientName}`,
    `🔌 <b>מחבר:</b> ${connectorName}`,
    `🕐 <b>זמן:</b> ${timeStr}`,
    "",
    "📊 <b>סיכום השינויים שיבוצעו:</b>",
    `🆕 רשומות חדשות: <b>${diff.newCount}</b>`,
    `♻️ רשומות שיוחלפו: <b>${diff.overwriteCount}</b>`,
    `🗑️ רשומות שיוסרו: <b>${diff.removedCount}</b>`,
    `✅ ללא שינוי: <b>${diff.unchangedCount}</b>`,
    "",
    "⚠️ <b>נדרש אישור אנושי לפני ביצוע.</b>",
    "בחר פעולה:",
  ].join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SyncResult {
  status: "approval_created" | "no_changes" | "skipped_open" | "error";
  approvalId?: number;
  diff?: DiffSummary;
  reason?: string;
}

export async function runSyncForConnector(
  connectorId: number,
  opts: { triggeredBy: string; notify?: boolean; attended?: boolean } = { triggeredBy: "manual" },
): Promise<SyncResult> {
  const notify = opts.notify ?? true;

  const [conn] = await db
    .select()
    .from(rpaConnectorsTable)
    .where(eq(rpaConnectorsTable.id, connectorId))
    .limit(1);
  if (!conn) return { status: "error", reason: "connector_not_found" };
  if (conn.systemType !== "optima") return { status: "error", reason: "not_optima" };

  // Attended (manual) mode: the human has already signed in to Optima herself
  // (passing any two-factor challenge). We reuse that live session and never
  // fall back to an unattended stored-credential login, which 2FA would block
  // anyway. If there is no active session, ask her to connect first.
  if (opts.attended && !getSessionStatus(connectorId).loggedIn) {
    return { status: "error", reason: "not_logged_in" };
  }

  if (await hasOpenApproval(connectorId)) {
    return { status: "skipped_open", reason: "approval_already_pending" };
  }

  const result = await runAction(
    conn.id,
    conn.systemType as SystemType,
    conn.baseUrl,
    conn.username,
    decodePassword(conn.encryptedPassword),
    SYNC_ACTION,
  );
  if (!result.success) {
    return { status: "error", reason: result.error ?? "pull_failed" };
  }

  const next = toRecords(result.data);
  const previous = await getLastAppliedData(connectorId);
  const diff = diffRecords(previous, next);

  if (!hasChanges(diff)) {
    return { status: "no_changes", diff };
  }

  // Resolve per-client Telegram chat (fallback to the global ops chat).
  let clientName = "—";
  let chatId: string | null = null;
  if (conn.clientId != null) {
    const [client] = await db
      .select({ name: clientsTable.name, chat: clientsTable.telegramChatId })
      .from(clientsTable)
      .where(eq(clientsTable.id, conn.clientId))
      .limit(1);
    if (client) {
      clientName = client.name;
      chatId = client.chat ?? null;
    }
  }
  if (!chatId) chatId = getOpsChatId();

  let approval: OptimaSyncApproval;
  try {
    [approval] = await db
      .insert(optimaSyncApprovalsTable)
      .values({
        connectorId: conn.id,
        clientId: conn.clientId ?? null,
        action: SYNC_ACTION,
        status: "pending",
        newCount: diff.newCount,
        overwriteCount: diff.overwriteCount,
        removedCount: diff.removedCount,
        unchangedCount: diff.unchangedCount,
        proposedData: JSON.stringify(next),
        previousData: JSON.stringify(previous),
        telegramChatId: chatId,
      })
      .returning();
  } catch (err) {
    // Partial unique index (one pending per connector) — a concurrent run beat us.
    if (String(err).includes("optima_one_pending_per_connector")) {
      return { status: "skipped_open", reason: "approval_already_pending" };
    }
    throw err;
  }

  if (notify && chatId) {
    const text = buildApprovalMessage({ clientName, connectorName: conn.name, diff });
    const messageId = await sendMessageWithButtons(chatId, text, [[
      { text: "✅ אישור וביצוע", callback_data: `optima_approve:${approval.id}` },
      { text: "✋ ביטול", callback_data: `optima_cancel:${approval.id}` },
    ]]);
    if (messageId) {
      await db
        .update(optimaSyncApprovalsTable)
        .set({ telegramMessageId: messageId })
        .where(eq(optimaSyncApprovalsTable.id, approval.id));
    }
  }

  return { status: "approval_created", approvalId: approval.id, diff };
}

export interface DecisionResult {
  ok: boolean;
  reason?: string;
  approval?: OptimaSyncApproval;
}

/** Why an atomic pending→X transition failed: distinguishes missing vs already-decided. */
async function decisionFailureReason(approvalId: number): Promise<string> {
  const [a] = await db
    .select({ status: optimaSyncApprovalsTable.status })
    .from(optimaSyncApprovalsTable)
    .where(eq(optimaSyncApprovalsTable.id, approvalId))
    .limit(1);
  return a ? `already_${a.status}` : "not_found";
}

export async function approveAndApply(approvalId: number, decidedBy: string): Promise<DecisionResult> {
  // Atomic gate: only a row that is STILL pending can be applied. Concurrent
  // approvals or an already-decided row update 0 rows and are rejected.
  const now = new Date();
  const [updated] = await db
    .update(optimaSyncApprovalsTable)
    .set({ status: "applied", decidedBy, decidedAt: now, appliedAt: now })
    .where(and(
      eq(optimaSyncApprovalsTable.id, approvalId),
      eq(optimaSyncApprovalsTable.status, "pending"),
    ))
    .returning();

  if (!updated) return { ok: false, reason: await decisionFailureReason(approvalId) };

  if (updated.telegramChatId && updated.telegramMessageId) {
    await editMessageText(updated.telegramChatId, updated.telegramMessageId, [
      "✅ <b>הסנכרון אושר ובוצע</b>",
      "",
      `👤 אישר/ה: ${decidedBy}`,
      `🆕 חדשות: ${updated.newCount} · ♻️ הוחלפו: ${updated.overwriteCount} · 🗑️ הוסרו: ${updated.removedCount}`,
    ].join("\n"));
  }

  // Chain the approved occupancy delta into PalGate gate permits (entries/exits).
  // Failures here never block the approval itself.
  try {
    const previous = toRecords(JSON.parse(updated.previousData ?? "[]"));
    const next = toRecords(JSON.parse(updated.proposedData ?? "[]"));
    const { added, removed } = splitRecords(previous, next);
    const chain = await chainOptimaToPalgate({ clientId: updated.clientId, added, removed });
    if (chain.ran) {
      console.log(
        `[optima→palgate] approval ${approvalId}: created ${chain.created}, ` +
        `skipped ${chain.skippedExisting} existing / ${chain.skippedUnmappable} unmappable, ` +
        `flagged ${chain.flaggedRemovals} removals`,
      );
    }
  } catch (err) {
    console.error(`[optima→palgate] chaining failed for approval ${approvalId}:`, err);
  }

  return { ok: true, approval: updated };
}

export async function cancelApproval(approvalId: number, decidedBy: string): Promise<DecisionResult> {
  const [updated] = await db
    .update(optimaSyncApprovalsTable)
    .set({ status: "cancelled", decidedBy, decidedAt: new Date() })
    .where(and(
      eq(optimaSyncApprovalsTable.id, approvalId),
      eq(optimaSyncApprovalsTable.status, "pending"),
    ))
    .returning();

  if (!updated) return { ok: false, reason: await decisionFailureReason(approvalId) };

  if (updated.telegramChatId && updated.telegramMessageId) {
    await editMessageText(updated.telegramChatId, updated.telegramMessageId, [
      "✋ <b>הסנכרון בוטל</b>",
      "",
      `👤 בוטל ע״י: ${decidedBy}`,
      "לא בוצע שום שינוי.",
    ].join("\n"));
  }
  return { ok: true, approval: updated };
}

// ─── Attended login (manual sign-in, optional one-time 2FA code) ──────────────

export interface LoginResult {
  status: "logged_in" | "needs_code" | "error";
  message: string;
}

/**
 * Sign in to Optima for an attended run. The operator triggers this from the
 * UI; if Optima answers with a two-factor challenge we return "needs_code" so
 * she can enter the one-time code, which is forwarded once and never stored.
 */
export async function loginConnector(connectorId: number, code?: string): Promise<LoginResult> {
  const [conn] = await db
    .select()
    .from(rpaConnectorsTable)
    .where(eq(rpaConnectorsTable.id, connectorId))
    .limit(1);
  if (!conn) return { status: "error", message: "מחבר לא נמצא" };
  if (conn.systemType !== "optima") {
    return { status: "error", message: "התחברות ידנית נתמכת כרגע עבור אופטימה בלבד" };
  }

  const r = await establishOptimaSession(
    conn.id,
    conn.baseUrl,
    conn.username,
    decodePassword(conn.encryptedPassword),
    code,
  );

  if (r.success) return { status: "logged_in", message: "ההתחברות לאופטימה הצליחה" };
  if (r.needsTwoFactor) {
    return { status: "needs_code", message: "נדרש קוד אימות דו-שלבי — הזן את הקוד שקיבלת" };
  }
  return { status: "error", message: r.error ?? "ההתחברות נכשלה" };
}

/** Whether the connector currently holds a live, signed-in Optima session. */
export function connectorSession(connectorId: number): { loggedIn: boolean } {
  return { loggedIn: getSessionStatus(connectorId).loggedIn };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // re-evaluate which connectors are due every 30 min
const lastRunAt = new Map<number, number>();

async function tickScheduler(): Promise<void> {
  try {
    const connectors = await db
      .select()
      .from(rpaConnectorsTable)
      .where(eq(rpaConnectorsTable.systemType, "optima"));

    const now = Date.now();
    for (const conn of connectors) {
      const cfg = readAutoSync(conn.metadata);
      if (!cfg.enabled) continue;

      const dueEvery = Math.max(1, cfg.intervalHours) * 60 * 60 * 1000;
      const last = lastRunAt.get(conn.id) ?? 0;
      if (now - last < dueEvery) continue;

      lastRunAt.set(conn.id, now);
      try {
        const r = await runSyncForConnector(conn.id, { triggeredBy: "schedule" });
        console.log(`[optima-sync] scheduled sync for connector ${conn.id}: ${r.status}`);
      } catch (err) {
        console.error(`[optima-sync] scheduled sync failed for connector ${conn.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[optima-sync] scheduler tick failed:", err);
  }
}

export function startOptimaScheduler(): void {
  if (process.env.NODE_ENV === "test") return;
  setInterval(tickScheduler, CHECK_INTERVAL_MS).unref();
  console.log("[optima-sync] scheduler started (checks every 30m, per-connector interval honoured)");
}
