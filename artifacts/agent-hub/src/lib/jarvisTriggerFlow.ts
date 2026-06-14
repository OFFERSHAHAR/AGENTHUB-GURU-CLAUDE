// ─── Jarvis remote trigger-run decision logic ─────────────────────────────────
// Pure, dependency-free helpers extracted from the desktop Jarvis component so
// the security-sensitive multi-step trigger flow (pick-list → confirm) can be
// unit-tested in isolation. No React, no fetch, no refs — just the decisions.

export interface ResolvedTrigger {
  secret: string;
  label: string;
  assignmentId: number;
  // Live trigger status (idle / running / triggered) so the pick-list can show
  // whether each candidate agent is already busy.
  status: string;
}

// A multi-trigger pick-list, held on the desktop while ops chooses an agent.
// Secrets stay here; the Mini App only ever sends back the chosen index.
export interface PendingTriggerChoices {
  triggers: ResolvedTrigger[];
  ts: number;
}

// Pending confirm + pick-list both expire after 2 minutes so a stale Telegram
// tap can never fire a trigger ops has since walked away from.
export const TRIGGER_PENDING_TTL_MS = 120_000;

// ── Decide what to do once a "run trigger X" query has been resolved to a set
//    of configured triggers. One match → go straight to confirm (skip the
//    pick-list, unchanged single-trigger behaviour); many → render a pick-list
//    so ops can choose which agent to run. ──
export type RunPlan =
  | { kind: "confirm"; trigger: ResolvedTrigger }
  | { kind: "pick"; triggers: ResolvedTrigger[] };

export function planTriggerRun(triggers: ResolvedTrigger[]): RunPlan {
  if (triggers.length > 1) return { kind: "pick", triggers };
  return { kind: "confirm", trigger: triggers[0] };
}

// ── Validate a select_trigger choice coming back from the Mini App pick-list.
//    Rejects gracefully when there is no pending pick-list, it has expired, or
//    the index is missing / out of range. ──
export type SelectResult =
  | { ok: true; chosen: ResolvedTrigger }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "invalid" };

export function selectTriggerChoice(
  pending: PendingTriggerChoices | null,
  choiceIndex: number | null | undefined,
  now: number = Date.now(),
): SelectResult {
  if (!pending || now - pending.ts > TRIGGER_PENDING_TTL_MS) {
    return { ok: false, reason: "expired" };
  }
  const chosen = typeof choiceIndex === "number" ? pending.triggers[choiceIndex] : undefined;
  if (!chosen) return { ok: false, reason: "invalid" };
  return { ok: true, chosen };
}
