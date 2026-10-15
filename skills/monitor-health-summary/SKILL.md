---
name: monitor-health-summary
description: Generate a one-shot health snapshot — monitor counts by state, which are currently down, recent incident count, and total downtime — useful as a daily brief or ad-hoc check.
tags: [monitoring, health, summary, uptime, downtime, uptimerobot]
---

# Monitor health summary

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

A fast overview of your monitoring account's current state. Combines account-wide stats, live down/paused lists, and recent incident activity into a single report.

Use this when the user asks "how's everything looking?", "give me a health check", "what's our monitoring status?", or "morning standup brief".

## Step 1 — Account-wide snapshot

```json
{ "timeRange": "24h" }
```

Call `get-monitor-stats`. Returns:

- `monitorsUp`, `monitorsDegraded`, `monitorsDown`, `monitorsPaused` — counts of monitors in each state.
- `overallUptime` — a fraction from 0 to 1; multiply by 100 for the percentage.
- `totalIncidents` and `totalIncidentsDuration` (seconds) for the range.
- `totalMonitors` vs. `totalMonitorsLimit` — current usage vs. plan cap.

Adjust `timeRange` if the user wants a longer window (e.g. `"7d"` for a weekly brief).

## Step 2 — List currently down monitors

```json
{ "filter": ["DOWN"], "limit": 50 }
```

Paginate with `nextCursor` until `hasMore: false`. Collect each monitor's `id`, `name`, and `currentStateDuration` (how long it has been in its current state — use it for "down for ~58 min").

If there are zero DOWN monitors, skip step 3 and say so clearly.

## Step 3 — List paused monitors

```json
{ "filter": ["PAUSED"], "limit": 50 }
```

Paginate until `hasMore: false`. You only need names and count — no need to fetch details for each.

## Step 4 — Recent incidents

```json
{ "timeRange": "24h", "limit": 25 }
```

Call `list-incidents`. Paginate with `nextCursor` until `hasMore: false`. Collect the total count for the report footer. For total downtime, use `totalIncidentsDuration` (seconds) from step 1 — the per-incident `duration` is text like `"15m 55s"`, not seconds.

## Step 5 — Spot-check degraded monitors (optional)

For each DOWN monitor (limit to the top 3–5 by name if there are many), check response times to distinguish a full outage from degradation:

```json
{ "monitorId": 800123456, "timeRange": "1h", "bucketSize": 60 }
```

Only call this when the user wants more detail or when the monitor count is small. Avoid looping over dozens of monitors.

## Output format

```
Health summary — 2026-05-01 (last 24h)

Status: 2 DOWN · 1 DEGRADED · 3 PAUSED · 41 UP  (47 total)
Uptime: 98.7% across active monitors
Incidents last 24h: 4  (total downtime: 2h 13min)

Currently DOWN (2):
  • prod-api (800123456) — down since 14:02 UTC (~58 min)
  • staging-db (800123457) — down since 13:45 UTC (~1h 15min)

Paused (3): deploy-preview, load-test-env, sandbox-api
```

If everything is up:

```
Health summary — 2026-05-01 (last 24h)

Status: 0 DOWN · 1 PAUSED · 46 UP  (47 total)
Uptime: 100.00% across active monitors
Incidents last 24h: 0

All active monitors are up. One monitor paused: sandbox-api.
```

## Common mistakes

- Showing `overallUptime` as-is. It's a fraction (`0.987` = 98.7%).
- Ignoring `monitorsDegraded` — degraded monitors are up but not healthy. Show the count when it's above zero.
- Reporting `PAUSED` monitors as "healthy" — they're unmonitored. Always surface them so the user is aware.
- Looping `get-response-times` over every UP monitor — expensive and unnecessary. Reserve it for DOWN or flagged monitors.
- Forgetting to paginate `list-monitors` or `list-incidents` — with many monitors or incidents you'll silently under-count.

## Related

- `incident-response` — to triage what the summary surfaces as down.
- `stats` — simpler alternative when the user only wants uptime % without the full breakdown.
- `incidents` — to list and investigate individual downtime events.
- `bulk-pause` — to act on the paused-monitor list (resume all at once).
- `conventions` — time range formats and pagination patterns.
