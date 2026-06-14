---
name: Journal Q&A (occupancy) feature
description: How agents answer client questions from the structured occupancy journal, and how bookings get ingested into it.
---

# Journal Q&A — "both pipeline"

Lets an assigned agent answer a client's natural-language questions about the occupancy
journal (`palgate_permits`) and ingests booking webhooks into that same journal.

## Gating is by agent tags, not config
- `journal-qa` → chat handler augments the system prompt with a real DB query result.
- `journal-ingest` → webhook handler best-effort ingests booking payloads into the journal.
- Both are isolated fire-and-forget on the webhook path; ingestion must never block or
  break the existing agent runner.

## Answers are grounded, with a deterministic fallback
The **count is computed in JS** (client-scoped filter), placed into the prompt context,
and the model only phrases it. When the model is unavailable (returns `__TEMPLATE__`),
the user-visible reply is the server-built deterministic Hebrew answer.
**Why:** free-tier clients route to Ollama which is frequently down → without the
deterministic fallback a data question would surface the raw `__TEMPLATE__` sentinel.
Non-data questions return null and fall through to normal chat unchanged.

## Ingestion dedup MUST include unit/note
Dedup key = (clientId, guestPhone, checkIn, checkOut, **unitOrNote**), matching the
source key the Optima sync chain already uses (`mapRecordToPermit` lives in
`palgate-chain.ts`). **Why:** without unit in the key, two distinct bookings sharing a
phone + date span but different rooms collapse into one → journal undercounts.
Each record is wrapped in its own try/catch so one bad row never aborts the batch.

## Ingestion must write status="pending" (lifecycle consistency)
The journal display (`GET /api/palgate/permits`) and the journal-qa agent both read the
same `palgate_permits` table. New permits follow `pending → active → removed` (active =
ops confirmed added to gate; removed = confirmed removed). Every creation path (Optima
chain, manual add, sheet sync) starts at "pending", so webhook ingestion must too.
**Why:** writing "active" mislabels a fresh booking as already-on-gate and lets the
departures flow (which matches status="active" at checkout) act on a gate entry that was
never added — and the display would show it as active without the confirm-add step.
queryJournal counts all statuses, matching the display's default (unfiltered) view.

## Roadmap: Optima agent replaces manual report push
The Apps Script → webhook (`/api/webhooks/trigger/:secret`) path that wakes the occupancy
agent on report sync is an **interim bridge**. The end-state intent is that the Optima
agent (the "תפוסה ויומן" agent) pulls occupancy directly from Optima itself and updates
the journal, eliminating the manual Sheets push entirely.
**Why:** matters when scoping webhook work — don't over-invest in the manual-push contract.
**Constraint:** fully unattended auto-pull is blocked by Optima's per-login 2FA (see
optima-attended-2fa.md); attended pulls (human forwards a one-time code) are the feasible
near-term replacement.

## unitOrNote prefix in display
`formatRows` must NOT prepend "חדר" if `unitOrNote` already starts with "חדר/room/unit/דירה/יחידה".
Pattern: `/^(חדר|unit|room|דירה|יחידה)/i.test(unit)` → use as-is; else prepend "חדר ".
**Why:** seeded data and Optima sync both store "חדר X" in unitOrNote, causing "חדר חדר X" output.

## WhatsApp daily agent (id 32)
A dedicated agent record with tag `["whatsapp-daily"]` lets any client get per-assignment
daily WhatsApp reports. Config lives in `assignments.customization` JSON:
`{toPhone, sheetUrl, sendHour, guestMessagesEnabled, enabled}`.
Route: `POST /api/whatsapp/send-assignment/:assignmentId`.
UI: `WhatsAppAssignmentConfig` panel auto-appears in `AgentDeployCard` when agent has the tag.
Scheduler: `sendAllAssignmentsDailyWhatsApp()` runs alongside legacy global-settings path.

## presence + weekday semantics
For `basis="presence"` with a weekday filter, a stay matches if any day in the overlap
of `[checkIn, checkOut]` with the requested `[from, to]` window falls on that weekday
(walk day by day). Entry/exit bases just check the single check-in/check-out date.
