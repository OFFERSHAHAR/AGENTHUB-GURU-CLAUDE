---
name: Optima attended (manual) 2FA sync
description: Why Optima manual runs require a live in-memory session instead of unattended credential auto-login
---

Optima enabled two-factor auth, which breaks unattended username/password login.
The product decision is **attended/manual mode**: the operator signs into Optima
*through AgentHub* (stored per-connector creds + an optional one-time 2FA code
typed live), establishing the per-connector in-memory session; then "Run" reuses
that session and continues the existing Telegram approval flow.

**Rules to keep consistent:**
- The one-time 2FA code is forwarded once to the login request and **never
  persisted** (not in DB, not in the session headers). Don't add storage for it.
- Manual run path must pass `attended:true` to `runSyncForConnector`, which
  requires an existing logged-in session (`getSessionStatus().loggedIn`) and
  returns `{status:"error", reason:"not_logged_in"}` — it must NOT fall back to
  the unattended auto-login inside `runAction` (that's exactly what 2FA blocks).
- The scheduler (auto-sync, gated by `metadata.autoSync.enabled`) is intentionally
  left on the old unattended path; turning auto-sync off = manual mode.

**Why:** the "open screen" metaphor can't literally read the manager's separate
browser tab — AgentHub does its own server-side HTTP login per connector, so the
session it reuses must be one it established itself.

**How to apply:** any new Optima trigger/run surface that should respect 2FA must
go through the attended gate, never call the auto-login fallback directly.
