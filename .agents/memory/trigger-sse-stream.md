---
name: Trigger SSE push channel
description: How instant trigger-dashboard updates work via Server-Sent Events
---

The trigger dashboard updates instantly (no idle polling) via an in-process pub/sub bus + SSE.

- API server has an in-process EventEmitter bus (`lib/trigger-events-bus.ts`). The webhook handler `publishTriggerEvent` at every state transition (triggered/running/idle/deduplicated), keyed by `clientId`.
- SSE route `GET /api/clients/:id/trigger/stream` filters bus events by clientId and writes `event: trigger\ndata: {json}` frames. Sends `: ping` heartbeat every 25s.
- GLOBAL SSE route `GET /api/trigger/stream` is the same handler with NO clientId filter — emits every bus event. Powers app-wide surfaces (Clients list, Dashboard activity feed, Logs page).
- Shared frontend hook `hooks/use-trigger-stream.ts` (`useTriggerStream(onEvent)`) wraps one `EventSource` on the global stream; Clients/Dashboard pages invalidate react-query keys on each frame, Logs page re-fetches. `client-detail.tsx` keeps its own per-client `EventSource` (in parent, not per row).

**Why:** The bus is in-process only — it works because the API server is a single process. If the API server is ever scaled to multiple instances, SSE subscribers on instance A will miss events published on instance B; would need Redis pub/sub or sticky routing then.

**How to apply:** Existing react-query polling (4-5s while status is triggered/running) is kept as the graceful fallback when the stream disconnects. Don't remove it.
