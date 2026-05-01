---
name: monitor-health-summary
description: Generate a one-shot health snapshot — monitor counts by state, which are currently down, recent incident count, and total downtime — useful as a daily brief or ad-hoc check.
tags: [monitoring, health, summary, uptime, downtime, uptimerobot]
---

# Monitor health summary

A fast overview of your monitoring account's current state. Combines account-wide stats, live down/paused lists, and recent incident activity into a single report.

Use this when the user asks "how's everything looking?", "give me a health check", "what's our monitoring status?", or "morning standup brief".

## Step 1 — Account-wide snapshot

```json
{ "timeRange": "24h" }
```

Call `get-monitor-stats`. Returns:

- Counts of monitors in each state (`up`, `down`, `paused`, `notStarted`).
- Overall uptime percentage across active monitors.
- Total incident count and downtime duration for the range.
- Plan-level monitor cap vs. current usage.

Adjust `timeRange` if the user wants a longer window (e.g. `"7d"` for a weekly brief).

## Step 2 — List currently down monitors

```json
{ "filter": ["DOWN"], "limit": 50 }
```

Paginate with `cursor` until `hasMore: false`. Collect each monitor's `id` and `friendlyName` and the timestamp from `get-monitor-details` if you need exact downtime duration.

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

Call `list-incidents`. Paginate until `hasMore: false`. Collect total count and sum of incident durations for the report footer.

## Step 5 — Spot-check degraded monitors (optional)

For each DOWN monitor (limit to the top 3–5 by name if there are many), check response times to distinguish a full outage from degradation:

```json
{ "monitorId": 800123456, "timeRange": "1h", "bucketSize": 60 }
```

Only call this when the user wants more detail or when the monitor count is small. Avoid looping over dozens of monitors.

## Output format

```
Health summary — 2026-05-01 (last 24h)

Status: 2 DOWN · 3 PAUSED · 42 UP  (47 total)
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

- Counting `NOT_STARTED` monitors as "down" — they're unstarted, not failing. Exclude them from down/up tallies or list them separately.
- Reporting `PAUSED` monitors as "healthy" — they're unmonitored. Always surface them so the user is aware.
- Looping `get-response-times` over every UP monitor — expensive and unnecessary. Reserve it for DOWN or flagged monitors.
- Forgetting to paginate `list-monitors` or `list-incidents` — with many monitors or incidents you'll silently under-count.
- Confusing `notStarted` with `paused` — they're different states. `notStarted` means the monitor was never activated.

## Related

- `incident-response` — to triage what the summary surfaces as down.
- `stats` — simpler alternative when the user only wants uptime % without the full breakdown.
- `incidents` — to list and investigate individual downtime events.
- `bulk-pause` — to act on the paused-monitor list (resume all at once).
- `conventions` — time range formats and pagination patterns.
