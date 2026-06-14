---
name: Expo workflow readiness false-failure
description: restart_workflow reports DIDNT_OPEN_A_PORT for expo-domain artifacts even though Metro serves fine
---

For `expo-domain` router artifacts (e.g. `agent-hub-mobile`), `restart_workflow` can
consistently fail with `DIDNT_OPEN_A_PORT` even though Metro starts cleanly and serves.

**What is actually true when this happens:**
- Workflow log shows full successful Metro startup ("Web is waiting on http://localhost:PORT"), no errors.
- Metro binds the port in ~6s; `GET /status` returns 200 (`packager-status:running`) via
  BOTH `http://localhost:PORT/status` AND `https://$REPLIT_EXPO_DEV_DOMAIN/status`.
- Container has a single loopback IP (`hostname -i` = 127.0.0.1), so `--localhost` bind is correct and reachable.
- The expo port is intentionally NOT in `.replit` `[[ports]]` (expo-domain bypasses the shared proxy).
- No orphaned metro processes / no port contention.

**Conclusion:** this is a platform readiness-detection issue, not a code/config bug. The
detector's SIGKILL-on-timeout kills the working Metro, so after a failed restart the port is dead.

**How to apply:**
- Don't loop on `restart_workflow` for this — it won't pass; each attempt just kills Metro and burns resources.
- To verify the app manually: `cd artifacts/<expo-app>; export PORT=<port> EXPO_PACKAGER_PROXY_URL=https://$REPLIT_EXPO_DEV_DOMAIN ...; pnpm exec expo start --localhost --port $PORT` then curl `/status`.
- The bash tool SIGKILLs the whole process group at command timeout, taking nohup/setsid children with it — keep verify-curls SHORT; don't run 100s+ foreground bundle compiles in the same call as the launch.
- Surface to the user that the workflow needs to be (re)started from the main project after merge / on project boot.
