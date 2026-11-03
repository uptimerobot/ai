---
name: monitor-health-summary
description: Generate a one-shot health snapshot — monitor counts by state, which are currently down or paused, recent incident count, and total downtime — useful as a daily brief or ad-hoc check.
tags: [monitoring, health, summary, uptime, downtime, uptimerobot]
---

# Monitor health summary

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use this for "how's everything looking?", a health check, or a morning brief.

**Tools:** `get-monitor-stats`, `list-monitors`, `list-incidents`, optionally `get-response-times`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

Typical flow — pass the same `timeRange` to `get-monitor-stats` and `list-incidents` (the last 24 hours unless the user asks otherwise, written as an absolute ISO interval so paging `list-incidents` is stable; the tools default to 7 days): `get-monitor-stats` for the counts, uptime and total downtime → `list-monitors` with `filter: ["DOWN", "LOOKS_DOWN"]` (and `["PAUSED"]`) for names, and `["STARTED"]` to count monitors not checked yet → `list-incidents` for names and details, counting only `type: "Downtime"`. For the headline numbers use `get-monitor-stats` `totalIncidents` and `totalIncidentsDuration` together, labelled "incident time" (it excludes slow responses and report-excluded incidents, and includes visual-change ones) — the list counts only incidents that started in the range, so its count can differ. Spot-check `get-response-times` only for the few monitors that are down, not for every monitor.

`list-monitors` — what's down right now:

```json
{ "filter": ["DOWN", "LOOKS_DOWN"], "limit": 100 }
```

## Gotchas

- **`overallUptime` is a 0–1 fraction** — multiply by 100 (an account with no monitors returns `100` — report 100%). It's a plain average over all monitors with paused time counted as up, so call it account uptime, not an SLA. **`totalIncidentsDuration` is seconds.** Per-incident `duration` is text like `"15m 55s"`, so use the stats total, labelled "incident time".
- **Pagination: never copy the call in `instructions`** — on `list-monitors` it drops your `filter` (you'd get all monitors); on `list-incidents` its `timeRange` is an object the tool rejects. Repeat your own arguments with `cursor` set to `nextCursor` while `hasMore` is true. `totalCount` is only on the first page.
- `monitorsUp` / `monitorsDown` / `monitorsPaused` are exact status counts. `LOOKS_DOWN` and not-yet-checked (`STARTED`) monitors are in none of them, so add those counts from `list-monitors`; the parts should add up to `totalMonitors`. `filter: ["STARTED"]` means "not checked yet", not "running".
- **`LOOKS_DOWN` is not a confirmed outage** — the monitor is failing but not yet confirmed down. List those names separately as "possibly down"; say "down" only for `DOWN`.
- `currentStateDuration` on each monitor tells you how long it has been down (e.g. "down for ~58 min").
- Show paused monitors — they aren't being checked, so they aren't "healthy". Ignore `monitorsDegraded`; it is always `0`.
- State the time range next to every number.

Example output:

```text
Health summary — 2026-10-15 (last 24h)
Status: 2 DOWN · 1 LOOKS_DOWN · 3 PAUSED · 41 UP (47 total)
Uptime: 99.76% · Incidents: 4 (incident time 2h 40m)
Down: prod-api (~58 min), staging-db (~1h 15m)
Possibly down (unconfirmed): billing-webhook
Paused: deploy-preview, load-test-env, sandbox-api
```

## Related

- [`incident-response`](../incident-response/SKILL.md) — triage what's down.
- [`stats`](../stats/SKILL.md) and [`incidents`](../incidents/SKILL.md) — more detail.
- [`bulk-pause`](../bulk-pause/SKILL.md) — resume paused monitors.
