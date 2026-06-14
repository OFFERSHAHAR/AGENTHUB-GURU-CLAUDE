---
name: Jarvis Telegram command bridge
description: Durable architecture + security decisions for the Jarvis desktop↔Telegram remote-control bridge
---

# Jarvis Telegram command bridge

The Telegram Mini App and the desktop Jarvis talk through the api-server, never directly. State is in-memory only (no DB), by scope decision.

## Executor isolation (critical)
The desktop Jarvis component is the ONLY command executor — it holds the SSE bridge and runs commands. It must NOT mount inside the Mini App route, or the Mini App becomes a fake executor that can receive/run/report its own commands and falsely report success with no real desktop present.
**Why:** a prior implementation mounted the executor globally on every route (incl. the Mini App route), which broke the core "Telegram → real desktop executes → result back" guarantee.
**How to apply:** gate the desktop executor so it renders only on real desktop routes, never on standalone/Mini-App routes.

## Access control (the bridge endpoints are public)
- **Command injection** is gated by Telegram WebApp `initData` HMAC verification (key = HMAC("WebAppData", botToken)), with an auth_date freshness window. Enforced whenever a bot token is configured; open in dev when no token exists (bridge can't reach Telegram anyway).
- **Result injection** is gated by a per-connection executor token issued in the SSE `connected` event. Only a live executor holding that token may resolve a command; this blocks anonymous callers from posting fake results / hijacking a pending command.
**Why:** without these, any caller could inject commands into a connected desktop or forge results, since app URLs are publicly reachable.

## Flow
Telegram → POST command (verified) → SSE broadcast to desktop → desktop executes read/navigate side-effects → POST result (with executor token) → Mini App polls result. Unknown commands fall back to an LLM interpret endpoint (Hebrew JARVIS persona); graceful template reply when no model is available.

## Scope boundaries
Read/navigate run immediately. Write actions (firing a trigger) require an explicit two-step confirm: Telegram "run trigger X" → desktop resolves client→assignment→trigger and returns a `confirm` payload → Mini App shows one-tap confirm/cancel → desktop fires the webhook and returns the agent result.
**Why:** write actions must never auto-execute from a remote surface.
**How to apply:** the command POST carries an allow-listed `action` verb (`confirm_trigger`/`cancel_trigger`); the result POST carries an optional `confirm:{label}`. The webhook secret stays on the desktop in a ref (`pendingTriggerRef`) — the Mini App only ever sends the confirm verb, never the secret. Pending confirm expires after 2 min. Agent runs async, so the desktop polls the trigger to idle (~18s) to surface output; `__TEMPLATE__` output means no model configured.

## Multi-trigger disambiguation (pick-list before confirm)
When a client name matches more than one configured trigger, the desktop resolves *all* candidates and returns a `choices:[{label}]` payload (no confirm yet). The Mini App renders a pick-list; tapping one sends `action:select_trigger` + a zero-based `choiceIndex`, the desktop picks that candidate and emits the normal `confirm` payload, then the existing confirm→fire flow proceeds. Single-trigger clients skip the pick-list (direct confirm, unchanged).
**Why:** previously the resolver returned only the *first* matching trigger, so ops couldn't choose which agent to fire from Telegram.
**How to apply:** candidate secrets stay on the desktop in `pendingTriggerChoicesRef` (mirrors `pendingTriggerRef`, 2-min expiry); the Mini App only ever sends the index, never a secret. `choices`/`choiceIndex` ride the same command/result/poll messages, and `select_trigger` is allow-listed alongside the confirm/cancel verbs.
