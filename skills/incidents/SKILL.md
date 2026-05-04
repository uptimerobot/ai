---
name: incidents
description: List downtime incidents and fetch per-incident checker locations, IPs, logs, and traceroute data.
tags: [incidents, downtime, logs, traceroute, uptimerobot]
---

# Incidents

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Two tools:

- `list-incidents` — paginated incidents across the account or for one monitor.
- `get-incident-details` — checker locations, IPs, logs, traceroute for one incident.

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
- `cursor`, `limit` — pagination (follow the `instructions` field for the next call).

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
{ "incidentId": "inc_abcdef1234567890" }
```

Note: `incidentId` is a **string**, not a number.

Response includes:

- Monitor id and friendly name.
- Start / end timestamps, duration.
- Root cause category (if assigned).
- Per-checker probe results: checker location, IP, HTTP status code observed, error kind, response body snippet.
- Traceroute hops where available.

Use this to answer "why did this go down?" — show the user the checker locations first, then the error types, then (if asked) the verbose logs.

## Common mistakes

- Passing a numeric `incidentId`. It's always a string.
- Requesting ranges longer than 90 days — the server rejects the call. For older data, the user needs to query it in the UptimeRobot dashboard.
- Forgetting that `list-incidents` is paginated. Loop with the cursor from `instructions` until `hasMore: false`.
- Inventing `incidentId`s. Always source them from `list-incidents`.

## Output tips

- Group incidents by monitor before summarising.
- Lead with active (unresolved) incidents, then recent resolved, then older.
- Surface total downtime duration, not just incident counts — the user usually cares about impact.
- Don't paste raw log bodies unless the user asks. Summarise the error kind and HTTP status.

## Related

- `stats` — for aggregated downtime minutes across a time range.
- `manage-monitors` — to pause a flapping monitor after confirming incidents.
