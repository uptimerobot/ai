---
name: stats
description: Read account-wide monitor statistics (up/down/paused counts, uptime, incident totals) and per-monitor response-time series, and report the numbers in the right units.
tags: [stats, uptime, response-time, metrics, uptimerobot]
---

# Stats

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this for "what's our uptime?" questions (account-wide) and for one monitor's response times over a period.

**Tools:** `get-monitor-stats`, `get-response-times`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

`get-response-times` — one monitor over the last 24 hours in 5-minute buckets:

```json
{ "monitorId": 800123456, "timeRange": "24h", "bucketSize": 300 }
```

## Gotchas

- **`overallUptime` is a fraction from 0 to 1**, not a percentage. Multiply by 100 (`0.99942` → `99.942%`).
- **`totalIncidentsDuration` is in seconds** (`955` = 15m 55s).
- `get-monitor-stats` is account-wide only — it has no `monitorId`. Default range is 7 days.
- `timeRange` is `"1h"`–`"90d"` or an ISO interval `"start/end"`; anything longer than 90 days, or with start after end, is rejected. Split longer periods or tell the user the limit.
- `bucketSize` is an integer number of seconds (`60`, `300`), not `"1m"`. A bucket smaller than the monitor's check interval adds no points (a 5-hour-interval monitor gives about 5 points per day).
- `responseTimes` is a list of `[unixSeconds, milliseconds]` pairs. `metadata.timeRange` comes back as a resolved `{from, to}` object, not the string you sent.
- An unknown monitor returns plain text `Monitor not found or access denied` — that means "doesn't exist", not "up".
- Always state the time range next to any number you report.

## Related

- [`incidents`](../incidents/SKILL.md) — explain dips in uptime.
- [`sla-report`](../sla-report/SKILL.md) — per-monitor uptime reports.
- [`monitor-health-summary`](../monitor-health-summary/SKILL.md) — a quick account snapshot.
