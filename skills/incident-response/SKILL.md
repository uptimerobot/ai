---
name: incident-response
description: End-to-end incident workflow — find what's down, diagnose it, pause flapping monitors, and verify recovery.
tags: [incidents, downtime, triage, response, runbook, uptimerobot]
---

# Incident response

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

The full loop a user runs when something's on fire:

1. Find what's down (`list-monitors` with `DOWN` filter, plus `list-incidents` with `status: "open"`).
2. Pull recent incidents for the affected monitors.
3. Diagnose one incident (`get-incident-details`).
4. Log findings as you go with incident comments (requires the `incident-comments` plan feature).
5. Optionally silence flapping monitors while the underlying issue is being fixed (`update-monitor-status` → `PAUSED`).
6. After the fix, verify recovery with `get-monitor-details` and `get-response-times`.

Use this when the user says "what's down?", "is production still broken?", "triage the alerts", or "show me the outage".

## Step 1 — Find what's down

```json
{ "filter": ["DOWN"], "limit": 50 }
```

Paginate until `hasMore: false` by repeating this call (same `filter`, `limit`) with `cursor` set to `nextCursor` — don't copy the call embedded in `instructions`, it drops the filter. Each item has `id`, `name`, `url`, `type`, `status`, `currentStateDuration`, `lastIncidentId`, and `tags`. Group the results by tag or `name` prefix before reporting — the user typically cares "what system is down", not "which individual checks are failing".

`DOWN` by itself excludes paused monitors. To also catch monitors that are failing but not yet confirmed down, add `LOOKS_DOWN`:

```json
{ "filter": ["DOWN", "LOOKS_DOWN"], "limit": 50 }
```

### Ongoing incidents

```json
{ "status": "open", "limit": 50 }
```

Call `list-incidents` with `status: "open"` to get every ongoing incident with its `id`, `monitorId`, `monitorName`, `startedAt`, `cause`, `reason` and `type`. While `hasMore` is true, repeat the same arguments with `cursor` set to `nextCursor`. It ignores `timeRange`, so an outage that started long ago is still returned. It also returns `Slow Response` and `Visual Change` incidents — only `type: "Downtime"` is an outage.

## Step 2 — Pull recent incidents

For each down monitor that the user wants to dig into:

```json
{ "monitorId": 800123456, "timeRange": "<start ISO>/<end ISO>", "limit": 20 }
```

Returns a list of incidents (active and resolved). Each `id` is a **numeric string** such as `"123456789012345678"`, and `duration` is text such as `"15m 55s"`, not seconds.

Compute the last 24 hours from the current UTC time and send them as an absolute ISO interval (e.g. `2026-04-29T14:00:00Z/2026-04-30T14:00:00Z` when it's 14:00 UTC on 30 April), so paging is stable — never copy the example dates. If you can't determine the current UTC time, use `"24h"` instead (paging may restart from the first page, so dedupe incidents by `id`). Paginate while `hasMore` is true. This returns only incidents that started in that window. Take the active incident from Step 1's `status: "open"` results (it may have started earlier), then show these recently resolved ones as flap history.

## Step 3 — Diagnose one incident

```json
{ "incidentId": "123456789012345678" }
```

Returns:

- `status` (`"Ongoing"` / `"Resolved"` — use this, not `endedAt`, to tell if it's over), `startedAt`, `endedAt` and `duration` (`null` while ongoing; `endedAt` is also `null` for a resolved incident with zero duration), `cause` (a number, e.g. `401`), `reason` — the readable cause.
- `requestLogs[]` — the 10 newest checks (per check: `timestamp`, `region`, `requestUrl`, `requestMethod`, `responseStatusCode`, `requestHeaderNames`, `responseHeaders`). `requestLogs[].timestamp` is usually not ISO 8601 (`"2026-09-30 14:44:48.587"`, UTC). Request headers come back as names only and credential response headers as `[REDACTED]`; still mask any secret-looking value in request and response bodies and URLs, even when the user asks for the full logs.

`checkerLocations` is always empty and `errorDetails` is a placeholder (`"Unknown error"`) — use `reason` for the cause and `requestLogs[].region` for regions.

No traceroute or root-cause category is returned. For the checker IP and city per check, call `get-incident-activity-log` (`entries[].remoteNode`). For who was notified, call `get-incident-alerts`.

Useful output pattern:

- "All 4 checker regions saw connection refused on port 443 starting at 14:02 UTC."
- "2 of 4 regions (NA, EU) see 503; the other 2 see 200 — looks regional."

Don't paste the full request logs unless asked — summarise `cause` / `reason` and the HTTP status.

## Step 4 — Log findings as an incident comment thread (optional)

Requires the `incident-comments` plan feature. Comments are visible to the whole team, so ask the user once before you start posting. Rather than only reporting a final summary at the end, add a comment each time you learn something material — it builds a timeline other responders (and future you, writing the postmortem) can read directly on the incident:

```json
{ "incidentId": "123456789012345678", "content": "4/4 regions see connection refused on :443 since 14:02 UTC. Not regional — looks like the LB is down." }
```

`incidentId` here is a BigInt passed as a numeric string (same value as `get-incident-details`). If you posted something and later learn it was wrong (e.g. misidentified root cause), fix it with `update-incident-comment` (needs the numeric `commentId` from the create response or `list-incident-comments`) rather than leaving a stale comment alongside a correction — the thread should read as a clean timeline, not a debug log.

When writing the final summary (below), pull the full thread with `list-incident-comments` so nothing gets lost between what was said live and what makes the postmortem.

## Step 5 — Silence flapping monitors (optional)

If a monitor is flapping while the underlying issue is being fixed and the noise is distracting, pause just that monitor (not everything — see `bulk-pause` for that):

```json
{ "monitorId": 800123456, "status": "PAUSED" }
```

Confirm with the user first — pausing a monitor also stops alerts, which is exactly what you want during known downtime but dangerous if the user forgets to resume. Pausing a monitor that is down **resolves its open incident** at that moment (the downtime is cut short and the incident leaves `status: "open"`); resuming starts fresh, and a new incident opens if it's still down. Tell the user before pausing a monitor mid-outage.

Store the paused IDs so you can resume them later. [`maintenance-windows`](../maintenance-windows/SKILL.md) is a better choice when the downtime is planned ahead of time rather than reactive.

## Step 6 — Verify recovery

Once the user says the fix is deployed, confirm the monitor is actually green.

### Resume anything you paused — first

For each paused monitor ID you stored in step 5:

```json
{ "monitorId": 800123456, "status": "STARTED" }
```

Watch for `Monitor limit exceeded` on resume (see `errors`). A paused monitor is never checked, so resume it before the checks below, then wait for at least one check interval: it shows `STARTED` until its first check.

### Current state of one monitor

```json
{ "monitorId": 800123456 }
```

Call `get-monitor-details`. Expect `status: UP` and a short `currentStateDuration` that grows on the next check (there is no last-checked timestamp).

### Response times over the window

`get-monitor-stats` is account-wide only, so it can't confirm one monitor's recovery. Use `get-response-times` on the specific monitor:

```json
{ "monitorId": 800123456, "timeRange": "1h", "bucketSize": 60 }
```

`bucketSize` is an integer number of seconds. Look at `summary.avg` / `summary.p95` returning to baseline, not just "up vs down".

## Reporting back to the user

Typical structured summary:

```
Incident on `prod-api` (monitor 800123456)
- Started: 2026-04-21T14:02:00Z
- Duration: 18 min (resolved)
- Impact: 4/4 checker regions saw 503 Service Unavailable
- Root cause: deploy-related, resolved after rollback at 14:20 UTC
- Currently: UP. Response times at 220ms (baseline 190ms).
Related monitors also down during window: `prod-api-healthz`, `prod-api-db`.
```

## Common mistakes

- Showing raw checker logs without summarising. The user wants cause-and-impact, not JSON.
- Reporting `LOOKS_DOWN` monitors as confirmed outages. Label them "possibly down" until they reach `DOWN`.
- Finding active incidents by `timeRange` alone. Use `list-incidents` with `status: "open"`.
- Pausing monitors and not tracking what you paused. Resuming requires the list.
- Claiming recovery from `status: UP` alone. Check `get-response-times` — a monitor can be UP with 10x response time and still degraded.
- Treating a resolved-then-retriggered incident as one event. Sometimes `list-incidents` returns two rows for a flap.
- Requesting `timeRange` > 90 days. Max is 90d.
- Leaving an incorrect incident comment uncorrected instead of using `update-incident-comment` — the thread is the record other people read.
- Trying to comment on an incident when the account's plan lacks the `incident-comments` feature — if the call fails with an error that mentions the plan or `incident-comments`, fall back to reporting in chat only.

## Related

- `manage-monitors` — for `list-monitors`, `get-monitor-details`, `update-monitor-status`.
- `incidents` — detailed reference for `list-incidents` and `get-incident-details`.
- `stats` — for `get-monitor-stats` and `get-response-times`.
- `bulk-pause` — when many monitors need silencing at once.
- [`maintenance-windows`](../maintenance-windows/SKILL.md) — the scheduled alternative to pausing during known downtime.
- [`status-pages`](../status-pages/SKILL.md) — post a public-facing announcement alongside internal incident comments.
- `errors` — monitor limit on resume, plan-gated features, `not found` on stale IDs, rate limits during heavy loops.
