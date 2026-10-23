---
name: manage-monitors
description: Find monitors with list-monitors filters, read one monitor's details, and pause or resume monitors in UptimeRobot.
tags: [monitoring, list, pause, resume, uptimerobot]
---

# Manage monitors

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this to find monitors, inspect one, or pause / resume one. For changing a monitor's settings see [`update-monitor`](../update-monitor/SKILL.md); for creating one see the `create-*-monitor` skills.

**Tools:** `list-monitors`, `get-monitor-details`, `update-monitor-status`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

`list-monitors` — every monitor that isn't paused, matching a name:

```json
{ "name": "api", "filter": ["UP", "DOWN", "LOOKS_DOWN", "STARTED"], "limit": 100 }
```

## Gotchas

- **`filter: ["STARTED"]` does not mean "running".** It matches only monitors that haven't been checked yet since create/resume. For every non-paused monitor use `["UP", "DOWN", "LOOKS_DOWN", "STARTED"]` (values combine as OR), or omit `filter` and skip `status: "PAUSED"` yourself.
- There is no `search` parameter. An unknown parameter like `search` is **silently ignored** and you get the unfiltered account — use `name` or `url`.
- **Pagination: never copy the call in `instructions`.** It keeps only `cursor` and `limit` and drops `name` / `url` / `tags` / `filter`, which silently widens the query to every monitor. While `hasMore` is true, repeat your own arguments with `cursor` set to `nextCursor`.
- `totalCount` is only on the first page (it's `null` whenever `cursor` is passed).
- Responses use `name`; `friendlyName` is only an input field on create/update.
- `get-monitor-details` doesn't return the monitor's alert contacts, maintenance windows or group. For group membership use `list-monitors` with `groupId`.
- `get-monitor-details` returns `customHttpHeaders` unredacted (bearer tokens, API keys). Don't echo header values to the user.
- For a HEARTBEAT monitor `url` is only the bare hash; the full push URL is in `heartbeatUrl` from `get-monitor-details` (not in `list-monitors`).
- Paused monitors still count toward the plan's monitor limit; resuming (`status: "STARTED"`) fails with a limit error only if the account is over its limit (e.g. after a downgrade). Pausing a monitor that is down resolves its open incident. After pausing or resuming, confirm with `get-monitor-details`.

## Related

- [`update-monitor`](../update-monitor/SKILL.md) — edit a monitor's configuration.
- [`bulk-pause`](../bulk-pause/SKILL.md) — pause / resume many monitors.
- [`incidents`](../incidents/SKILL.md) and [`stats`](../stats/SKILL.md) — history and uptime.
- [`errors`](../errors/SKILL.md) — what the error messages mean.
