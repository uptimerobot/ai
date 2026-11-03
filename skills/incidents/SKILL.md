---
name: incidents
description: List downtime incidents (including ongoing ones) and read one incident's details, activity log, and sent alerts.
tags: [incidents, downtime, logs, alerts, uptimerobot]
---

# Incidents

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use this for "what went down, when, why, and who was alerted". For working through a live outage see [`incident-response`](../incident-response/SKILL.md).

**Tools:** `list-incidents`, `get-incident-details`, `get-incident-activity-log`, `get-incident-alerts`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

`list-incidents` — every ongoing incident right now (ignores `timeRange`, so an old one is still returned; filter on `type: "Downtime"` for outages, and paginate while `hasMore` is true):

```json
{ "status": "open" }
```

`list-incidents` — one monitor for April 2026 (a fixed range, so paging is stable):

```json
{ "monitorId": 800123456, "timeRange": "2026-04-01T00:00:00Z/2026-05-01T00:00:00Z", "limit": 100 }
```

## Gotchas

- **Incident `id` is a numeric string** (`"123456789012345678"`). Pass it as-is; never invent `inc_...` IDs.
- **`duration` is text** like `"15m 55s"`, not seconds. List items have no `endedAt` — get it from `get-incident-details`, or parse the text. `get-monitor-stats` `totalIncidentsDuration` (seconds) is account-wide only — for one monitor, build the total as [`sla-report`](../sla-report/SKILL.md) Step 3 does (range query, `status: "open"`, lookback, merge overlaps, clip) — the list includes regional sub-incidents that overlap their parent.
- **Not every incident is downtime.** `type` is `Downtime`, `Slow Response` or `Visual Change` — filter on it before counting outages.
- **`timeRange` matches incidents by start time.** An incident that started before the range isn't returned, even if it overlapped it; ongoing ones still show with `status: "open"`.
- **`cause` is a number** (an HTTP status like `401`, or an internal code like `800001`); `reason` is the readable text.
- **Pagination: never copy the call in `instructions`.** Its `timeRange` is a `{from, to}` object the tool rejects. While `hasMore` is true, repeat your own arguments with `cursor` set to `nextCursor`. `totalCount` is `null` after the first page.
- Each call's range is capped at 90 days in length (not in age) — split longer periods into ≤90-day chunks.
- `get-incident-details`: `checkerLocations` is always empty and `errorDetails` is a placeholder (`"Unknown error"`) — use `cause` / `reason`, and take regions from `requestLogs[].region`. `requestLogs` holds at most the 10 newest checks; their `timestamp` is usually `"YYYY-MM-DD HH:MM:SS.mmm"` (UTC, no `Z`), not ISO. `duration` is `null` while the incident is ongoing. There is no traceroute. Request logs include request and response headers, which can carry tokens — never show header values to the user, even if they ask for the full logs; mask secrets, including tokens in request and response bodies and URLs.
- Unknown IDs: `get-incident-details` returns `Incident not found`; the activity-log and alerts tools return `Incident <id> not found` and reject non-numeric IDs.
- `get-incident-alerts` and `get-incident-activity-log` show recipient values only for email, SMS and voice; others are `"[REDACTED]"`. Don't paste addresses or phone numbers unless asked.

## Related

- [`incident-response`](../incident-response/SKILL.md) — triage an ongoing incident.
- [`stats`](../stats/SKILL.md) — total downtime and uptime for a range.
- [`errors`](../errors/SKILL.md) — what the error messages mean.
