---
name: stats
description: Read account-wide monitor statistics (up/down/paused counts, uptime, incident totals) and per-monitor response-time series, and report the numbers in the right units.
tags: [stats, uptime, response-time, metrics, uptimerobot]
---

# Stats

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use this for "what's our uptime?" questions (account-wide) and for one monitor's response times over a period.

**Tools:** `get-monitor-stats`, `get-response-times`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

`get-response-times` — one monitor over the last 24 hours in 5-minute buckets:

```json
{ "monitorId": 800123456, "timeRange": "24h", "bucketSize": 300 }
```

## Gotchas

- **`overallUptime` is a fraction from 0 to 1**, not a percentage. Multiply by 100 (`0.99942` → `99.942%`) — except when `totalMonitors` is 0, where it's already `100`: report 100%.
- **`overallUptime` is a rough figure, not an SLA.** It is the plain average of every monitor's uptime: each monitor weighs the same, paused monitors and paused time count as up, and an account with no monitors reports `100`. For an SLA, compute it per monitor (see [`sla-report`](../sla-report/SKILL.md)).
- **`totalIncidentsDuration` is in seconds** (`955` = 15m 55s) and may be fractional. The stats totals leave out slow-response incidents and incidents excluded from reports, but include visual-change ones — so they can differ from a total you build from `list-incidents`. Ongoing incidents count up to the end of the range.
- `get-monitor-stats` covers every monitor in the account — it can't be scoped to a monitor, tag or group. Default range is 7 days.
- `monitorsUp`, `monitorsDown` and `monitorsPaused` are exact status counts: `LOOKS_DOWN` and not-yet-checked (`STARTED`) monitors are in none of them, so they can add up to less than `totalMonitors`. `monitorsDegraded` is always `0`.
- `timeRange` is `"1h"`–`"90d"` or an ISO interval `"start/end"`; anything longer than 90 days, or with start after end, is rejected. Split longer periods or tell the user the limit. Per-chunk `get-response-times` `p95` values can't be combined into one figure: report each chunk's `p95` with its range, or use only the last 90 days.
- `bucketSize` is an integer number of seconds (`60`, `300`), not `"1m"`. A bucket smaller than the monitor's check interval adds no points (a 5-hour-interval monitor gives about 5 points per day). Omit it and the server picks one.
- `summary` covers the whole range whatever the `bucketSize`. `summary.avg` and `summary.p95` are both computed over the bucket averages, not over individual checks.
- `responseTimes` is a list of `[unixSeconds, milliseconds]` pairs. `metadata.timeRange` comes back as a resolved `{from, to}` object, not the string you sent.
- An unknown monitor returns plain text `Monitor not found or access denied` — that means "doesn't exist", not "up".
- Always state the time range next to any number you report.

## Related

- [`incidents`](../incidents/SKILL.md) — explain dips in uptime.
- [`sla-report`](../sla-report/SKILL.md) — per-monitor uptime reports.
- [`monitor-health-summary`](../monitor-health-summary/SKILL.md) — a quick account snapshot.
