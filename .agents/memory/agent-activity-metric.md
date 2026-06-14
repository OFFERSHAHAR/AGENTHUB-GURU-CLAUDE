---
name: Agent activity / "tasks handled" metric
description: How agent task volume is counted across AgentHub reporting surfaces
---

# Agent activity metric

There is no `agent_tasks` table. The canonical source for "agent activity" /
"tasks handled" is `trigger_events`, counted as rows with
`agentStatus = 'triggered'`.

**Why:** Each processed webhook fire writes a `triggered` row, then `running`,
then `idle` (3 rows per real run), plus separate `deduplicated` rows for
suppressed retries. Counting only `triggered` yields one count per actual task
and excludes lifecycle duplicates and suppressed retries.

**How to apply:** Any new per-client/per-agent usage or volume report should
aggregate `trigger_events` joined through `assignments` (assignment → client,
assignment → agent), filter `agentStatus = 'triggered'` for task counts, and use
`MAX(firedAt)` over all statuses for "last active". Keep this definition
consistent so different report surfaces don't disagree on counts.
