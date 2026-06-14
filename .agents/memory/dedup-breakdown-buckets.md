---
name: Dedup breakdown bucket granularity
description: How the dedup trigger-stats breakdown chooses hourly vs daily buckets
---

The `/clients/:id/trigger-stats` response carries a `breakdownUnit` ("hour"|"day")
that governs the granularity of BOTH the client-level `dailyBreakdown` and every
per-assignment `dailyBreakdown`.

**Rule:** `windowHours < 24` → hourly buckets; otherwise daily buckets.

- Hourly bucket key = full ISO hour `YYYY-MM-DDTHH:00:00Z` (UTC).
- Daily bucket key = calendar date `YYYY-MM-DD` (UTC).
- Zero-fill keys (built in JS) MUST match the SQL bucket expression exactly:
  hourly uses `to_char(date_trunc('hour', fired_at), 'YYYY-MM-DD"T"HH24":00:00Z"')`,
  daily uses `DATE(fired_at)`. Any tz drift between JS keys and SQL drops counts.

**Why:** sub-day windows (6h/12h) previously collapsed into a single day bucket,
hiding the intra-day pattern that motivated the short window.

**How to apply:** the UI `DedupSparkline` branches on `breakdownUnit` for labels.
Both JS and SQL assume the DB session is UTC (same assumption the daily path
already relied on). The field name stays `dailyBreakdown` for back-compat even
when it holds hourly points.
