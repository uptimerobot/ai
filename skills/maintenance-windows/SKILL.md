---
name: maintenance-windows
description: Schedule one-off or recurring maintenance windows that suppress alerts for planned downtime, as an alternative to bulk-pause.
tags: [maintenance-window, scheduled, downtime, alerts, uptimerobot]
---

# Maintenance windows

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Requires the `maintenance-window` plan feature.

## Decision: maintenance window vs. bulk-pause

Both stop alert noise during planned downtime, but they work differently:

| | Maintenance window | [`bulk-pause`](../bulk-pause/SKILL.md) |
| -- | -- | -- |
| What changes | Alerts only — monitor keeps checking and its state stays visible | Monitor itself stops checking (`status: PAUSED`) |
| Timing | Scheduled in advance, can recur | Immediate, manual resume |
| Resume cap risk | None — monitor was never paused | Resuming can hit `-28001 monitor_limit_exceeded` |
| Best for | Known, recurring, or future-dated downtime (deploy windows, patching schedule) | Ad-hoc, right-now, or a monitor that needs to fully stop |

Default to a maintenance window whenever the downtime is planned ahead of time or repeats. Use bulk-pause for "pause it right now" requests.

## Creating a window

```json
{
  "name": "Weekly DB patching",
  "interval": "weekly",
  "date": "2026-07-06",
  "time": "02:00:00",
  "duration": 90,
  "days": [1],
  "monitorIds": [800111, 800222]
}
```

- `date`/`time` are the **first** occurrence; `time` is UTC — confirm the user's intended timezone and convert before calling.
- `days` is **required** for `weekly` (1–7, ISO weekday) and `monthly` (1–31, or `-1` for "last day of the month") recurrence. Omitting it on a recurring window is a validation error, not a silent default.
- `duration` is minutes the window stays active from the daily start time — not an end date.
- `autoAddMonitors: true` includes every monitor, including ones created later. Confirm with the user before using it — it's easy to end up suppressing alerts for something unrelated.

## The monitor-linkage asymmetry

Unlike tags, **the window owns the relationship, not the monitor.** `create-monitor` accepts `maintenanceWindowsIds` at creation time, but `update-monitor` has no equivalent field — you cannot attach an existing monitor to a window from the monitor side after creation.

To add or remove monitors from an existing window, update the window instead:

```json
{ "maintenanceWindowId": 700123, "monitorIds": [800111, 800222, 800333] }
```

This is a **full replacement** of the window's monitor list (same pattern as `tagNames`/`assignedAlertContacts` elsewhere) — read the current list via `get-maintenance-window` first if you're adding one monitor rather than replacing the set.

## Pausing / resuming a window without deleting it

```json
{ "maintenanceWindowId": 700123, "status": "paused" }
```

Use this when a scheduled window needs to be called off for one occurrence without losing the recurrence config. Flip back with `status: "active"`.

## Common mistakes

- Forgetting `days` on a `weekly`/`monthly` window.
- Treating `time` as the user's local timezone — it's UTC.
- Trying to attach a monitor to a window via `update-monitor` — that field doesn't exist there; update the window's `monitorIds` instead.
- Sending a partial `monitorIds` array on `update-maintenance-window` expecting a merge — it replaces the full set.
- Recommending a maintenance window to a plan that doesn't have the `maintenance-window` feature — check for `-28002 subscription_limit_exceeded` and suggest bulk-pause or a plan upgrade instead.
- Using a maintenance window for "stop this monitor entirely" — it suppresses alerts, not checks. Use `update-monitor-status` if the user wants the monitor to actually stop.

## Related

- [`bulk-pause`](../bulk-pause/SKILL.md) — the immediate/manual alternative.
- [`status-pages`](../status-pages/SKILL.md) — pair a `Maintenance`-type announcement with the window.
- [`errors`](../errors/SKILL.md) — `-28002` for plan gating, `-29001` for malformed recurrence params.
