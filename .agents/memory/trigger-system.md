---
name: Webhook trigger system design
description: How the per-assignment trigger system is designed (DB, backend, frontend)
---

# Webhook Trigger System

## DB Tables
- `triggers`: id, assignment_id, webhook_secret (UUID), status (idle/triggered/running), last_fired_at, last_payload, created_at
- `trigger_events`: id, trigger_id, assignment_id, payload, agent_status, fired_at
  — One event per lifecycle phase (triggered, running, idle) per fire

## Backend endpoints
- `GET /assignments/:id/trigger` — returns trigger config + recentEvents (up to 10)
- `POST /assignments/:id/trigger` — create or regenerate trigger (upsert: delete+insert)
- `POST /webhooks/trigger/:secret` — inbound webhook: sets status triggered→running(3s)→idle(13s), inserts event per phase

## Webhook URL
Derived at runtime from x-forwarded-host/x-forwarded-proto headers. Pattern: `${proto}://${host}/api/webhooks/trigger/${secret}`

## Frontend
- `TriggerRow` component: per-assignment, polls every 5s (triggered/running) or 30s (idle/waiting) — polls from idle so external fires are detected live
- `AgentDeployCardWithTrigger` wrapper: same polling logic, passes status to card footer badge
- Status labels: idle→"Waiting", triggered→"Triggered", running→"Running"
- Recent Events list in TriggerRow shows up to 10 events with timestamp, payload summary, agentStatus badge

**Why:** Polling from idle state is critical — without it, external webhook fires (from the client's live app) would never update the UI. Polling 30s from idle is a good balance.
