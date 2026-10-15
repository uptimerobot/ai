---
name: stats
description: Query aggregated monitor statistics (up/down/paused counts, uptime percentage) and per-monitor response-time time series.
tags: [stats, uptime, response-time, metrics, uptimerobot]
---

# Stats

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

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

- `monitorsUp`, `monitorsDegraded`, `monitorsDown`, `monitorsPaused` — counts of monitors in each state.
- `overallUptime` — a **fraction from 0 to 1**, not a percentage. Multiply by 100 before showing it (`0.99942` → `99.942%`).
- `totalIncidents`, `totalIncidentsDuration` (seconds), and `mtbf` for the range.
- `totalMonitors` vs. `totalMonitorsLimit` — current usage vs. plan cap.
- `startDate`, `endDate` — the range the server actually used.

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

Response shape:

```json
{
  "responseTimes": [[1760486400, 212], [1760486700, 198]],
  "summary": { "min": 150, "max": 940, "avg": 214, "p95": 410, "totalDataPoints": 288 },
  "metadata": { "monitorId": 800123456, "bucketSize": 300, "timeRange": "24h" }
}
```

- `responseTimes` — pairs of `[unixSeconds, milliseconds]`.
- `summary` — min / max / avg / p95 in ms over the whole range.
- `bucketSize` is an integer in **seconds** (`60`, `300`), not a string like `"1m"`.

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

- Asking for a range longer than 90 days — rejected. The limit is on the range length (1h–90d). Break the question into chunks or tell the user UptimeRobot's MCP caps each call at 90 days.
- Using `get-monitor-stats` to get per-monitor data. It's account-level only. For per-monitor detail use `get-monitor-details` + `get-response-times`.
- Interpreting a missing `monitorId` monitor result as "the monitor is up". It means the monitor doesn't exist or isn't accessible — the tool returns the plain-text error `Monitor not found or access denied` (treat it as `-30001`).
- Showing `overallUptime` as-is. `0.999` is 99.9%, not 0.999%.
- Omitting the time range in the final user summary. Always say "over the last 7 days" or similar.

## Output tips

- Always cite the time range alongside the percentage.
- When response times spike, correlate with `list-incidents` for the same range before claiming a cause.
- Don't round uptime above three decimals if the user cares about 99.9% SLAs. `99.942%` and `99.9%` are very different months.

## Related

- `incidents` — to explain downtime dips.
- `manage-monitors` — `get-monitor-details` for per-monitor config context.
