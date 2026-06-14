---
name: Optima → PalGate chaining
description: How occupancy-diff entries/exits feed PalGate gate permits, and the two-meaning "palgat" trap
---

# Optima → PalGate chaining

The "palgat" system_type is overloaded. The rpa-engine `palgat` adapter is a
salary/HR system (get_employees/get_salary_report/get_attendance). The PalGate
**gate-access** product is a SEPARATE subsystem: `palgate_permits` table + routes
under `/api/palgate/*` + a `daily-check` that turns each permit's check-in /
check-out date into "add to gate" / "remove from gate" Telegram reminders. Gate
execution is a HUMAN-CONFIRM workflow (confirm-add / confirm-remove), there is no
automated grant/revoke API call.

**Chain design:** on Optima `approveAndApply` (optima-sync.ts), the approved
occupancy delta feeds PalGate. `splitRecords(prev,next)` returns the actual
added/removed rows (the count-only `diffRecords` is not enough).
`chainOptimaToPalgate` maps each occupancy row to a permit with a tolerant
field-name matcher (name/phone/checkIn/checkOut/unit variants incl. Hebrew), then:
- added → insert `palgate_permits` (status pending) → existing daily-check handles
  both arrival add + departure remove reminders by date.
- removed → early-removal Telegram notice for a matching non-removed permit.

**Why the scoping matters:** dedup + removal lookups MUST be scoped by `clientId`.
The source key is `optima:<clientId>:<phone>:<checkIn>:<checkOut>:<unit>` stored in
`palgate_permits.sheetRowId`. Without clientId scoping one client's occupancy can
block another client's permit or misfire a removal against the wrong tenant.

**How to apply:** the chain is a no-op unless the client owns a `palgat`
connector. It runs inside a try/catch so chain failures never block the Optima
approval. Overwrite/in-place mutations of occupancy rows are NOT reconciled — only
added/removed are handled.
