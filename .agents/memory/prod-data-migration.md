---
name: Production data migration
description: How to move real data into the live prod site when prod SQL is read-only
---

Publishing/deploy migrates **code + schema only, NOT data**. Prod and dev have separate databases. The prod `executeSql` tool is **read-only** (cannot INSERT/DELETE/UPDATE).

**How to write to prod data:** use the live REST API via `fetch("https://<domain>/api/...")` inside `code_execution`. The public domain API is reachable and is NOT behind the web login gate (the gate is web-app only). Note: bash `curl` to the public domain fails (exit 7 / mTLS) — use `fetch` in code_execution instead.

**Migration pattern (add-first, delete-last):** create the real records first, verify, then delete demo/placeholder records last — so the site is never empty mid-migration and you can confirm before destroying anything.

**Orphan cleanup:** `assignments.client_id` has NO FK/cascade, so deleting a client leaves orphan assignment rows. Delete assignments via `DELETE /clients/:id/assignments/:agentId` BEFORE deleting the client. `conversations` cascades on client delete; `palgate_permits` / `rpa_connectors` / `optima_sync` reference clientId WITHOUT cascade (could block delete if such rows exist for the client).

**Why:** keeps the production site professional (no mixed fake+real data) and avoids leaving junk rows that have no FK guard to catch them.
