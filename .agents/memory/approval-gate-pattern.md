---
name: Human approval gate pattern
description: How to make a mandatory human-in-the-loop approval gate concurrency-safe in this codebase
---

When a feature requires a mandatory human decision before an action is applied
(e.g. Optima occupancy sync), model it as an approvals table with a `status`
column (`pending` → `applied` | `cancelled`) and enforce these two invariants at
the DB layer, not in app logic:

1. **Atomic decision transition.** Apply/cancel with
   `UPDATE ... SET status=... WHERE id=? AND status='pending' RETURNING *`.
   Treat 0 returned rows as "already decided / not found" (look up the current
   status only to report the reason). Never do read-then-write — two concurrent
   approvals would both pass a SELECT check and double-apply.

2. **One open row per owner.** Add a partial unique index, e.g.
   `uniqueIndex(...).on(t.connectorId).where(sql\`${t.status} = 'pending'\`)`.
   On insert, catch the unique-violation (match the index name in the error
   string) and return a "skipped, already pending" result. This closes the race
   between the scheduler tick and a manual run both creating a pending gate.

**Why:** code review proved both the read-then-write approve and the
hasOpenApproval()-then-insert had real double-apply / duplicate-pending race
windows under concurrent scheduler + manual triggers. DB-level guarantees are
the only reliable fix.

**How to apply:** any new "must be approved by a human" flow — reuse this exact
shape (status column + atomic UPDATE…RETURNING + partial unique index). Verified
with a concurrent-approve test: exactly one 200, one 409 `already_applied`.
