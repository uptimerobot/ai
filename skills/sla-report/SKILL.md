---
name: sla-report
description: Generate a per-monitor SLA report for a time range — uptime percentage, total downtime, incident count, and p95 latency per monitor — formatted for sharing or review meetings.
tags: [sla, uptime, reporting, metrics, incidents, uptimerobot]
---

# SLA report

Produces a table of uptime % and incident stats for each monitor over a given time range. Designed for copy-paste into Confluence, Slack, or a post-mortem doc.

Use this when the user asks "what was our uptime last month?", "generate an SLA report", "how many nines did we hit?", or "monthly monitoring review".

## Step 1 — Clarify scope and range

Before calling any tools, confirm two things if not already clear:

1. **Which monitors?** All monitors, a search filter (e.g. `"prod"`), or an explicit list?
2. **What time range?** Default to `"30d"`. Accept `"7d"`, `"90d"`, or an ISO 8601 interval like `"2026-04-01T00:00:00Z/2026-04-30T23:59:59Z"`.

If the user says "last month", convert to the ISO interval for the previous calendar month.

## Step 2 — Account aggregate

```json
{ "timeRange": "30d" }
```

Call `get-monitor-stats` to get the aggregate uptime % and total downtime for the header line.

## Step 3 — List monitors in scope

```json
{ "search": "prod", "limit": 50 }
```

Omit `search` to get all monitors. Paginate until `hasMore: false`. Collect `monitorId` and `friendlyName` for every monitor in scope.

Exclude `PAUSED` and `NOT_STARTED` monitors from the report unless the user explicitly wants them — they have no meaningful uptime data for the range. Note how many were excluded.

## Step 4 — Per-monitor incidents

For each monitor, fetch downtime incidents for the range:

```json
{ "monitorId": 800123456, "timeRange": "30d", "limit": 50 }
```

Paginate until `hasMore: false`. Sum `duration` across all incidents to get total downtime seconds. Count the incidents.

## Step 5 — Per-monitor response times

For each monitor, fetch the summary stats for the range:

```json
{ "monitorId": 800123456, "timeRange": "30d" }
```

Call `get-response-times`. Use the overall `average` and `p95` from the response summary. Omit `bucketSize` — you want the full-range summary, not a time series.

## Step 6 — Compute and render

For each monitor, calculate uptime %:

```
uptime_pct = (range_seconds - downtime_seconds) / range_seconds * 100
```

Where `range_seconds` is derived from the time range (e.g. 30 days = 2,592,000 seconds).

Sort rows by uptime % ascending (worst first) so the most critical issues appear at the top.

## Output format

```
SLA Report — 2026-04-01 to 2026-04-30 (30 days)

Monitor               Uptime      Downtime    Incidents  Avg / p95
──────────────────────────────────────────────────────────────────
prod-cdn              99.12%      6h 21min    5          95ms / 210ms
prod-api              99.94%      26 min      2          320ms / 680ms
prod-auth             100.00%     —           0          180ms / 390ms
prod-worker           100.00%     —           0          —

Aggregate SLA: 99.77%  (across 4 monitors, 6h 47min total downtime)
3 monitors excluded (paused or not started).
```

If `p95` is unavailable for a monitor, show `—`. If a monitor had zero downtime, show `—` in the Downtime column.

## Handling large monitor counts

If the account has more than ~20 monitors, ask the user to narrow scope with a `search` filter before looping per-monitor calls. Looping `list-incidents` + `get-response-times` for 100 monitors will be slow and may hit rate limits.

If rate-limited (HTTP 429), pause and retry with exponential backoff — see `errors`.

## Common mistakes

- Comparing uptime % across different time ranges in the same table. Always use the same range for all rows.
- Rounding `99.942%` to `99.9%` when the user cares about SLA thresholds — they're different outcomes for a monthly SLA. Keep at least three decimals.
- Forgetting to paginate `list-incidents` per monitor — partial pages silently under-report downtime and inflate uptime %.
- Including `PAUSED` monitors with `100.00%` uptime — they're unmonitored, not healthy. Exclude and note the count.
- Using `get-monitor-stats` for per-monitor uptime — that tool returns account-level aggregates only.
- Treating `incidentId` as a number. It's always a string.

## Related

- `stats` — simpler alternative for a quick account-wide uptime figure without per-monitor breakdown.
- `incidents` — to drill into specific outages referenced in the report.
- `manage-monitors` — to filter monitors by tag or state before building the report scope.
- `monitor-health-summary` — for a current-state snapshot instead of a historical report.
- `conventions` — time range formats, ISO 8601 intervals, and pagination.
