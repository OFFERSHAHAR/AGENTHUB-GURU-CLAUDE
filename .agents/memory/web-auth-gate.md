---
name: Web interface login gate
description: How the agent-hub web interface is protected by a single shared password
---

The agent-hub web interface (not the API, not mobile, not webhooks) is protected by a single shared password.

**Design:**
- Backend: `auth.ts` exposes `/api/auth/session`, `/api/auth/login`, `/api/auth/logout`. Login does a constant-time compare against the `APP_ACCESS_PASSWORD` secret and sets a signed httpOnly cookie `ah_auth=1`. Cookie signing uses the `SESSION_SECRET` secret (app boot fails fast if it is missing in non-test env).
- Frontend: `AuthGate` wraps the app; the full-screen surfaces `/gever`, `/jarvis`, `/aor` intentionally bypass the gate (they are public Telegram/personal surfaces).

**Why scoped to web only:** the single api-server is shared by many artifacts (mobile, client-intake, webhooks, telegram). Global API auth would break them, so the gate lives at the web frontend; the API stays open as before.

**How to apply:** changing the password = update the `APP_ACCESS_PASSWORD` secret then restart api-server (secrets load at process start). This is separate from Replit's deployment-level password visibility.
