---
name: incident-response
description: End-to-end incident workflow — find what's down, diagnose it, pause flapping monitors, and verify recovery.
tags: [incidents, downtime, triage, response, runbook, uptimerobot]
---

# Incident response

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

The full loop a user runs when something's on fire:

1. Find what's down (`list-monitors` with `DOWN` filter, plus `list-incidents` with `status: "open"`).
2. Pull incident details for the worst offenders (`get-incident-details`).
3. Optionally silence flapping monitors while the underlying issue is being fixed (`update-monitor-status` → `PAUSED`).
4. Log findings as you go with incident comments (requires the `incident-comments` plan feature).
5. After the fix, verify recovery with `get-monitor-stats` and/or `get-response-times`.

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

Call `list-incidents` with `status: "open"` to get every ongoing incident with its `id`, `monitorId`, `monitorName`, `startedAt`, `cause`, and `reason`. It ignores `timeRange`, so an outage that started long ago is still returned.

## Step 2 — Pull recent incidents

For each down monitor that the user wants to dig into:

```json
{ "monitorId": 800123456, "timeRange": "24h", "limit": 5 }
```

Returns a list of incidents (active and resolved). Each `id` is a **numeric string** such as `"363693836190769146"`, and `duration` is text such as `"15m 55s"`, not seconds.

Lead with the active (unresolved) incident, then show recently-resolved ones as flap history.

## Step 3 — Diagnose one incident

```json
{ "incidentId": "363693836190769146" }
```

Returns:

- `startedAt`, `endedAt` (not set while ongoing), `duration`, `cause` (a number, e.g. `401`), `reason`.
- `checkerLocations[]` and `requestLogs[]` (per check: `timestamp`, `region`, `requestUrl`, `requestMethod`, `responseStatusCode`, headers). `requestLogs[].timestamp` is not ISO 8601 (`"2026-09-30 14:44:48.587"`).
- `errorDetails` — `primaryError`, `errorCount`, `affectedRegions`.

`checkerLocations` and `affectedRegions` can come back empty — count regions from `requestLogs[].region` instead.

No traceroute or root-cause category is returned. For the checker IP and city per check, call `get-incident-activity-log` (`entries[].remoteNode`). For who was notified, call `get-incident-alerts`.

Useful output pattern:

- "All 5 checker regions saw connection refused on port 443 starting at 14:02 UTC."
- "2 of 5 regions (NA, EU) see 503; 3 others see 200 — looks regional."

Don't paste the full request logs unless asked — summarise `cause` / `reason` and the HTTP status.

## Step 4 — Log findings as an incident comment thread (optional)

Requires the `incident-comments` plan feature. Rather than only reporting a final summary at the end, add a comment each time you learn something material — it builds a timeline other responders (and future you, writing the postmortem) can read directly on the incident:

```json
{ "incidentId": "363693836190769146", "content": "5/5 checkers see connection refused on :443 since 14:02 UTC. Not regional — looks like the LB is down." }
```

`incidentId` here is a BigInt passed as a numeric string (same value as `get-incident-details`). If you posted something and later learn it was wrong (e.g. misidentified root cause), fix it with `update-incident-comment` (needs the numeric `commentId` from the create response or `list-incident-comments`) rather than leaving a stale comment alongside a correction — the thread should read as a clean timeline, not a debug log.

When writing the final summary (below), pull the full thread with `list-incident-comments` so nothing gets lost between what was said live and what makes the postmortem.

## Step 5 — Silence flapping monitors (optional)

If a monitor is flapping while the underlying issue is being fixed and the noise is distracting, pause just that monitor (not everything — see `bulk-pause` for that):

```json
{ "monitorId": 800123456, "status": "PAUSED" }
```

Confirm with the user first — pausing a monitor also stops alerts, which is exactly what you want during known downtime but dangerous if the user forgets to resume.

Store the paused IDs so you can resume them later. [`maintenance-windows`](../maintenance-windows/SKILL.md) is a better choice when the downtime is planned ahead of time rather than reactive.

## Step 6 — Verify recovery

Once the user says the fix is deployed, confirm the monitor is actually green.

### Current state of one monitor

```json
{ "monitorId": 800123456 }
```

Call `get-monitor-details`. Expect `status: UP` and a short `currentStateDuration` that grows on the next check (there is no last-checked timestamp).

### Aggregate over the window

```json
{ "timeRange": "1h" }
```

Call `get-monitor-stats` to see if overall uptime % is recovering. Pair with `get-response-times` on the specific monitor:

```json
{ "monitorId": 800123456, "timeRange": "1h", "bucketSize": 60 }
```

`bucketSize` is an integer number of seconds. Look at `summary.avg` / `summary.p95` returning to baseline, not just "up vs down".

### Resume anything you paused

For each paused monitor ID you stored in step 5:

```json
{ "monitorId": 800123456, "status": "STARTED" }
```

Watch for `-28001 monitor_limit_exceeded` on resume (see `errors`).

## Reporting back to the user

Typical structured summary:

```
Incident on `prod-api` (monitor 800123456)
- Started: 2026-04-21T14:02:00Z
- Duration: 18 min (resolved)
- Impact: 5/5 checker locations saw 503 Service Unavailable
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
- Trying to comment on an incident when the account's plan lacks the `incident-comments` feature — if the call fails with `-28002` or an error message that mentions the plan or `incident-comments`, fall back to reporting in chat only.

## Related

- `manage-monitors` — for `list-monitors`, `get-monitor-details`, `update-monitor-status`.
- `incidents` — detailed reference for `list-incidents` and `get-incident-details`.
- `stats` — for `get-monitor-stats` and `get-response-times`.
- `bulk-pause` — when many monitors need silencing at once.
- [`maintenance-windows`](../maintenance-windows/SKILL.md) — the scheduled alternative to pausing during known downtime.
- [`status-pages`](../status-pages/SKILL.md) — post a public-facing announcement alongside internal incident comments.
- `errors` — `-28001` on resume, `-28002` for plan-gated features, `-30001` on stale IDs, 429 handling during heavy loops.
