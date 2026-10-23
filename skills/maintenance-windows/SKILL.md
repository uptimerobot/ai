---
name: maintenance-windows
description: Schedule one-off or recurring maintenance windows that suppress alerts for planned downtime, as an alternative to bulk-pause.
tags: [maintenance-window, scheduled, downtime, alerts, uptimerobot]
---

# Maintenance windows

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this for planned or recurring downtime (deploys, patching). A window suppresses alerts while the monitors keep checking. For "stop this right now", use [`bulk-pause`](../bulk-pause/SKILL.md) instead. Needs the `maintenance-window` plan feature.

**Tools:** `create-maintenance-window`, `update-maintenance-window`, `get-maintenance-window`, `list-maintenance-windows`, `delete-maintenance-window`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

`create-maintenance-window` — every Monday, 90 minutes from 02:00:

```json
{
  "name": "Weekly DB patching",
  "interval": "weekly",
  "date": "2026-12-07",
  "time": "02:00:00",
  "duration": 90,
  "days": [1],
  "monitorIds": [800111, 800222]
}
```

`update-maintenance-window` — pause a window without losing its schedule (`"active"` resumes it):

```json
{ "maintenanceWindowId": 700123, "status": "paused" }
```

## Gotchas

- **Weekly `days` are ISO weekdays: `1` = Monday … `7` = Sunday.** Monthly `days` are dates `1`–`31`; `-1` (last day of the month) is accepted, but the server's scheduling code doesn't match it to any day — use explicit dates instead.
- `days` is required for `weekly` and `monthly`. Without it you get plain text with no code: `days is required and must be non-empty for "weekly" maintenance windows`.
- **New windows are always created active** (there is no `status` on create). If the user wants a draft, pause it right after creating.
- **The timezone of `time` is unclear.** The schema says UTC, but the server's scheduling code reads `date`/`time` in the account's timezone. Tell the user the time you sent and ask them to check the start time in the dashboard. `date`/`time` are the first occurrence; `duration` is minutes.
- **`list-maintenance-windows` rejects `cursor: 0`** (other list tools accept it). Omit `cursor` on the first page.
- The window owns the monitor list: `update-monitor` has no maintenance-window field and `get-monitor-details` doesn't show windows. Change a window's monitors with `update-maintenance-window` `monitorIds`, sending the complete list (read it first with `get-maintenance-window`).
- **`autoAddMonitors: true` doesn't attach existing monitors over MCP** — the window reads back `monitorIds: [0]` (a marker, not a list), and the server doesn't link the monitors you already have. Pass the IDs in `monitorIds` instead, and check the result with `get-maintenance-window`.
- `delete-maintenance-window` is permanent; pausing is usually what the user wants. Call `get-user` and confirm before deleting.

## Related

- [`bulk-pause`](../bulk-pause/SKILL.md) — the immediate alternative.
- [`status-pages`](../status-pages/SKILL.md) — post a `Maintenance` announcement alongside the window.
- [`errors`](../errors/SKILL.md) — plan-feature and validation messages.
