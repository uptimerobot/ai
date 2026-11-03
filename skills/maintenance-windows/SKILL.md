---
name: maintenance-windows
description: Schedule one-off or recurring maintenance windows that suppress alerts for planned downtime, as an alternative to bulk-pause.
tags: [maintenance-window, scheduled, downtime, alerts, uptimerobot]
---

# Maintenance windows

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

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

- **Weekly `days` are ISO weekdays: `1` = Monday … `7` = Sunday.** Monthly `days` are dates `1`–`31`, and `-1` means the last day of the month — use it for "last day" rather than `31` (which skips shorter months) or `28`–`31` (several windows a month).
- `days` is required for `weekly` and `monthly`. Without it you get plain text with no code: `days is required and must be non-empty for "weekly" maintenance windows`.
- `update-maintenance-window` replaces `days` and `monitorIds` with what you send. Send `interval` together with `days` (otherwise: `interval is required when days is provided`). Switching to weekly or monthly needs `days` and clears `date` unless you resend it; switching to `once` or `daily` clears the old `days` (and `daily` clears `date`). An explicit `monitorIds` turns auto-add off. A window that reads `[0]` has auto-add on: monitors created from now on join it, but which existing monitors it covers can't be read over MCP (one created with `autoAddMonitors: true` over MCP covers none). Don't claim a monitor is covered. With the user's OK, send `autoAddMonitors: false` (without `monitorIds`): auto-add turns off, the current links are kept, and `get-maintenance-window` then lists them. `autoAddMonitors: true` on update only sets the flag — it links no existing monitors. See [how updates treat lists](../../AGENTS.md#how-updates-treat-list-and-map-fields).
- **New windows are always created active** (there is no `status` on create). If the user wants a draft, pause it right after creating.
- **The timezone of `time` is unclear.** The schema says UTC, but the server's scheduling code reads `date`/`time` in the account's timezone. Before creating, tell the user exactly what you'll send (e.g. "`time: 02:00:00`, read in your account's timezone") and get their OK; afterwards, ask them to check the start time in the dashboard. `date`/`time` are the first occurrence; `duration` is minutes.
- **`list-maintenance-windows` rejects `cursor: 0`** (other list tools accept it). Omit `cursor` on the first page.
- The window owns the monitor list: `update-monitor` has no maintenance-window field and `get-monitor-details` doesn't show windows. Change a window's monitors with `update-maintenance-window` `monitorIds`, sending the complete list (read it first with `get-maintenance-window`).
- **`autoAddMonitors: true` doesn't attach existing monitors over MCP** — the window reads back `monitorIds: [0]` (a marker, not a list — never merge IDs into it), and the server doesn't link the monitors you already have. Pass the IDs in `monitorIds` instead, and check the result with `get-maintenance-window`. Don't send `autoAddMonitors: true` together with `monitorIds` on create: the monitors are linked but auto-add stays on, so the window reads `[0]` and every future monitor joins it.
- `delete-maintenance-window` is permanent; pausing is usually what the user wants. Call `get-user` and confirm before deleting.

## Related

- [`bulk-pause`](../bulk-pause/SKILL.md) — the immediate alternative.
- [`status-pages`](../status-pages/SKILL.md) — post a `Maintenance` announcement alongside the window.
- [`errors`](../errors/SKILL.md) — plan-feature and validation messages.
