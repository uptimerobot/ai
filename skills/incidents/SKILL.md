---
name: incidents
description: List downtime incidents (including ongoing ones), fetch per-incident checker locations, request logs, and error summary, and read the incident's activity log and sent alerts.
tags: [incidents, downtime, logs, alerts, uptimerobot]
---

# Incidents

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Four tools:

- `list-incidents` — paginated incidents across the account or for one monitor; `status: "open"` returns only ongoing incidents.
- `get-incident-details` — end time, checker locations, request logs, and an error summary for one incident.
- `get-incident-activity-log` — timeline of one incident: status updates, comments, and notification entries, with the checker node per entry.
- `get-incident-alerts` — the alerts sent during one incident, per recipient, with delivery status.

## List incidents

```json
{
  "timeRange": "7d",
  "limit": 25
}
```

Parameters:

- `timeRange` — `"24h"` / `"7d"` / `"30d"` (1h–90d), or ISO 8601 interval `"2024-01-01T00:00:00Z/2024-01-31T23:59:59Z"`. Defaults to `"7d"`.
- `monitorId` — optional, restrict to one monitor.
- `status` — optional, only `"open"`. Returns currently ongoing incidents **regardless of `timeRange`** (an outage that started months ago is still returned).
- `cursor`, `limit` — pagination. `limit` is 1–100 (default 10). `cursor` is the numeric-string incident ID from `nextCursor`; keep calling while `hasMore` is `true`.

Each item:

```json
{
  "id": "363693836190769146",
  "status": "Resolved",
  "cause": "...",
  "reason": "...",
  "duration": "15m 55s",
  "startedAt": "2026-10-14T09:12:03Z",
  "monitorId": 800123456,
  "monitorName": "prod-api",
  "type": "..."
}
```

- `id` is a numeric string — pass it as-is to the other incident tools.
- `duration` is human-readable text (`"15m 55s"`, `"2h 3m"`), **not** seconds. Parse the `d`/`h`/`m`/`s` parts, or get `endedAt` from `get-incident-details`.
- There is no `endedAt` in list items.

## Ongoing incidents only

```json
{ "status": "open" }
```

## Filter by monitor

```json
{
  "monitorId": 800123456,
  "timeRange": "30d"
}
```

## Absolute time range

```json
{
  "timeRange": "2025-04-01T00:00:00Z/2025-04-15T23:59:59Z"
}
```

## Get incident details

```json
{ "incidentId": "363693836190769146" }
```

Note: `incidentId` is a **numeric string** (the `id` from `list-incidents`), not a number.

Response includes the list-item fields plus:

- `endedAt` — absent or empty while the incident is ongoing.
- `checkerLocations[]` — the regions that checked the monitor.
- `requestLogs[]` — per check: `timestamp`, `region`, `requestUrl`, `requestMethod`, `responseStatusCode`, `requestHeaders`, `responseHeaders`.
- `errorDetails` — `primaryError`, `errorCount`, `affectedRegions`.

No traceroute, root-cause category, or response body is returned. Use `cause` / `reason` and `errorDetails.primaryError` for the "what failed" part.

Use this to answer "why did this go down?" — show the user the affected regions first, then the primary error and HTTP status codes, then (if asked) the request logs.

## Activity log and alerts

```json
{ "incidentId": "363693836190769146", "limit": 50 }
```

- `get-incident-activity-log` — a summary (entry counts by kind, contacts involved, most recent entry) and the newest page of entries. Each entry's `remoteNode` has the checker IP and city. Comments and status updates come only on the first page; `limit` is 1–200 (default 50) and counts notification entries only.
- `get-incident-alerts` — a summary (counts by delivery status, contacts involved) and the newest page of sent alerts per recipient. `limit` 1–200 (default 50).

Both use an opaque string `cursor` for the next page. Recipient values are shown only for email, SMS, and voice contacts; other types are `"[REDACTED]"`.

Use these to answer "who was alerted?" and "when did it start and recover?".

## Common mistakes

- Passing a numeric `incidentId`, or inventing an `inc_...` style ID. It's always a numeric string such as `"363693836190769146"`.
- Treating `duration` as seconds. It's text like `"15m 55s"`.
- Filtering by `timeRange` to find what's down now. Use `status: "open"` — an old ongoing incident can fall outside the range.
- Requesting ranges longer than 90 days — the server rejects the call. For older data, the user needs to query it in the UptimeRobot dashboard.
- Forgetting that `list-incidents` is paginated. Loop with `nextCursor` until `hasMore: false`. The `instructions` field is plain prose, not a JSON call.
- Inventing `incidentId`s. Always source them from `list-incidents`.

## Output tips

- Group incidents by monitor before summarising.
- Lead with active (unresolved) incidents, then recent resolved, then older.
- Surface total downtime duration, not just incident counts — the user usually cares about impact.
- Don't paste raw log bodies unless the user asks. Summarise `cause` / `reason` and the HTTP status.

## Related

- `stats` — for aggregated downtime minutes across a time range.
- `manage-monitors` — to pause a flapping monitor after confirming incidents.
