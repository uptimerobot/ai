---
name: create-heartbeat-monitor
description: Create a HEARTBEAT (cron/job) monitor: UptimeRobot generates a URL that the job must ping on schedule, and alerts when the pings stop.
tags: [monitoring, heartbeat, cron, job-monitoring, create, uptimerobot]
---

# Create a HEARTBEAT monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use for cron jobs, backups and background workers. It is the inverse of the other types: UptimeRobot probes nothing and waits for the job to request a generated URL; if no request arrives within `interval` (plus `gracePeriod`), the monitor goes down.

**Tool:** `create-monitor` with `type: "HEARTBEAT"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "Nightly DB backup",
  "type": "HEARTBEAT",
  "interval": 86400,
  "gracePeriod": 1800
}
```

## Gotchas

- Send no `url`. The create response's `url` is the full push URL (`https://heartbeat.uptimerobot.com/m<id>-<hash>`) — show it to the user so they can call it from the job (e.g. `curl -fsS --retry 3 "<push URL>"` on success only).
- In `get-monitor-details` and `list-monitors`, `url` is only the bare hash; the full push URL is in `heartbeatUrl`.
- Set `interval` to the job's real schedule and use `gracePeriod` to absorb run-time variance; both are stored as sent.

## After creating

Call `get-monitor-details` with the integer `id` from the create response to show the stored state (the push URL is in `heartbeatUrl`); if it returns `Monitor not found` right after the create, wait a few seconds and retry once — never re-create.

## Related

- `update-monitor` — change interval or grace period.
- `manage-monitors` — pausing during planned maintenance.
- `errors` — recovering from plan limits and invalid parameters.
