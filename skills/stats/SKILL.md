---
name: stats
description: Query aggregated monitor statistics (up/down/paused counts, uptime percentage) and per-monitor response-time time series.
tags: [stats, uptime, response-time, metrics, uptimerobot]
---

# Stats

Two tools:

- `get-monitor-stats` — account-wide aggregated counts and uptime percentage.
- `get-response-times` — per-monitor response-time time series.

Both take a `timeRange` (see format below).

## Time range format

Accepted by both tools and by `list-incidents`:

- Relative: `"1h"` – `"90d"` (e.g. `"24h"`, `"7d"`, `"30d"`).
- Absolute ISO 8601 interval: `"2024-01-01T00:00:00Z/2024-01-31T23:59:59Z"`. Start must be before end, range must be 1h–90d.

Default is `"7d"` when omitted.

## Get monitor stats

```json
{ "timeRange": "7d" }
```

Returns account-wide aggregates:

- Counts of monitors in each state (`up`, `down`, `paused`, `notStarted`).
- Overall uptime percentage across all active monitors.
- Incident counts and total downtime duration for the range.
- Plan-level monitor cap vs. current usage.

Use this to answer "how's everything looking?" or "what's our uptime this week?".

## Get response times

```json
{
  "monitorId": 800123456,
  "timeRange": "24h",
  "bucketSize": 300
}
```

Parameters:

- `monitorId` — required.
- `timeRange` — same format as above.
- `bucketSize` — seconds per bucket for aggregation. Smaller buckets → finer granularity and more data points. Omit to let the server pick a default based on the range.

Response includes time series with min / max / average / p95 per bucket, plus overall summary stats for the range.

## Examples

Last 24 hours, 5-minute buckets:

```json
{ "monitorId": 800123456, "timeRange": "24h", "bucketSize": 300 }
```

Last 30 days, default bucket size:

```json
{ "monitorId": 800123456, "timeRange": "30d" }
```

Custom range for incident post-mortem:

```json
{
  "monitorId": 800123456,
  "timeRange": "2025-04-10T14:00:00Z/2025-04-10T18:00:00Z",
  "bucketSize": 60
}
```

## Common mistakes

- Asking for ranges older than 90 days — rejected. Break the question into chunks or tell the user UptimeRobot's MCP caps at 90 days.
- Using `get-monitor-stats` to get per-monitor data. It's account-level only. For per-monitor detail use `get-monitor-details` + `get-response-times`.
- Interpreting a missing `monitorId` monitor result as "the monitor is up". It means the monitor doesn't exist or isn't accessible — the tool throws `-30001`.
- Omitting the time range in the final user summary. Always say "over the last 7 days" or similar.

## Output tips

- Always cite the time range alongside the percentage.
- When response times spike, correlate with `list-incidents` for the same range before claiming a cause.
- Don't round uptime above three decimals if the user cares about 99.9% SLAs. `99.942%` and `99.9%` are very different months.

## Related

- `incidents` — to explain downtime dips.
- `manage-monitors` — `get-monitor-details` for per-monitor config context.
