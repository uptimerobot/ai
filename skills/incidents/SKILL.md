---
name: incidents
description: List downtime incidents (including ongoing ones) and read one incident's details, activity log, and sent alerts.
tags: [incidents, downtime, logs, alerts, uptimerobot]
---

# Incidents

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this for "what went down, when, why, and who was alerted". For working through a live outage see [`incident-response`](../incident-response/SKILL.md).

**Tools:** `list-incidents`, `get-incident-details`, `get-incident-activity-log`, `get-incident-alerts`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

`list-incidents` — what is down right now (ignores `timeRange`, so an old ongoing outage is still returned):

```json
{ "status": "open" }
```

`list-incidents` — one monitor over the last 30 days:

```json
{ "monitorId": 800123456, "timeRange": "30d", "limit": 100 }
```

## Gotchas

- **Incident `id` is a numeric string** (`"363693836190769146"`). Pass it as-is; never invent `inc_...` IDs.
- **`duration` is text** like `"15m 55s"`, not seconds. List items have no `endedAt` — get it from `get-incident-details`, or parse the text. For a total over a range, `get-monitor-stats` `totalIncidentsDuration` is in seconds.
- **`cause` is a number** (an HTTP status like `401`, or an internal code like `800001`); `reason` is the readable text.
- **Pagination: never copy the call in `instructions`.** Its `timeRange` is a `{from, to}` object the tool rejects. While `hasMore` is true, repeat your own arguments with `cursor` set to `nextCursor`. `totalCount` is `null` after the first page.
- Ranges are capped at 90 days; older data has to be read in the dashboard.
- `get-incident-details`: `checkerLocations` and `errorDetails.affectedRegions` can be empty even when the checks ran — take regions from `requestLogs[].region`. `requestLogs[].timestamp` is `"YYYY-MM-DD HH:MM:SS.mmm"`, not ISO. There is no traceroute.
- Unknown IDs: `get-incident-details` returns `Incident not found`; the activity-log and alerts tools return `Incident <id> not found` and reject non-numeric IDs.
- `get-incident-alerts` shows recipient values only for email, SMS and voice; others are `"[REDACTED]"`. Don't paste addresses or phone numbers unless asked.

## Related

- [`incident-response`](../incident-response/SKILL.md) — triage an ongoing incident.
- [`stats`](../stats/SKILL.md) — total downtime and uptime for a range.
- [`errors`](../errors/SKILL.md) — what the error messages mean.
