---
name: API server test runner
description: How automated tests run in artifacts/api-server (test framework, command, SSE testing pattern)
---

The api-server uses the **Node built-in test runner** via tsx — no vitest/jest.

- Test command: `pnpm --filter @workspace/api-server run test` → `node --import tsx --test "src/**/*.test.ts"`.
- Test files live next to source as `*.test.ts` and import source with `.js` extensions (matches NodeNext source style).
- `tsx` is a devDependency (catalog version).

**SSE route testing pattern (trigger stream):** mount ONLY the triggers router on a
minimal express app (`app.use("/api", triggersRouter)`) and `http.createServer` on
port 0 — avoids booting the full app (schedulers/log-processor start on `routes/index` import).
Read SSE frames from the `fetch` Response body reader, split on `\n\n`, ignore `:`-comment
heartbeats, parse `id:`/`event:`/`data:` lines. Use an `AbortController` to simulate a drop.
Drive the bus directly with `publishTriggerEvent` for deterministic live/replay assertions;
the Last-Event-ID replay test seeds a real client/agent/assignment/trigger and POSTs the
actual webhook. The webhook's fire-and-forget runner logs a harmless `[model-router] ollama failed`
(no model configured in tests) — expected, not a failure.

**Dedup bucketing tests:** trigger-stats hourly/daily bucket coverage lives in the
same file. Force the window via `setDedupWindowHours()` (upsert `dedup_window_hours`
setting, delete to restore default); seed via `seedDedupEvents(firedAts[])`. Pin
firedAt to minute 30 of target hours (and noon-yesterday for the day case) so clock
drift between test and handler can't shift a bucket. The 2 SSE tests are flaky/slow
in CI (NaN ids, 25s replay timeout) — they fail even in isolation, run BEFORE the
bucketing block, and are unrelated to bucketing.

**Jarvis bridge tests (`routes/jarvis.test.ts`):** mount only the jarvis router; a
`FakeDesktop` holds the SSE stream, captures the `connected` token, and queues
`command` broadcasts. Aborting the client socket cleans up server-side only on the
next `close` event, so `close()` must poll `/jarvis/status` until `connections===0`
before the next test. CAVEAT: `TELEGRAM_BOT_TOKEN` present in the dev env gates the
command POST behind initData (401), breaking the protocol tests — clear it in
`before`/restore in `after`; a dedicated describe sets its own token and signs
initData with key `HMAC("WebAppData", botToken)`.

**agent-hub now has a runner too:** same node:test+tsx setup
(`pnpm --filter @workspace/agent-hub run test`). Pure, React-free Jarvis trigger
decision logic lives in `src/lib/jarvisTriggerFlow.ts` (extracted from `jarvis.tsx`)
so single-vs-multi pick-list + select_trigger index/expiry gating can be unit-tested.

**Note:** `pnpm --filter @workspace/api-server run typecheck` has pre-existing failures
unrelated to tests (stale `lib/db/dist` declarations missing newer schema exports like
`palgatePermitsTable`/`settingsTable`, and `agentOutput` on trigger_events). Test files
themselves are clean.
