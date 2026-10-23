---
name: update-monitor
description: Modify an existing UptimeRobot monitor — rename, change URL/interval, swap alert contacts, retag, move between groups, and tweak type-specific settings — without losing the lists it replaces.
tags: [monitors, update, alert-contacts, tags, headers, auth, threshold, uptimerobot]
---

# Update an existing monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this to change an existing monitor's configuration. Updates are partial — send only the fields you are changing. `type` can't be changed; recreate the monitor for that. To pause or resume, use `update-monitor-status` instead (see [`manage-monitors`](../manage-monitors/SKILL.md)).

**Tools:** `list-monitors`, `get-monitor-details`, `update-monitor`, `list-alert-contacts`, `list-integrations`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

Flow: find the ID with `list-monitors` (never guess it), read the current state with `get-monitor-details`, send the change with `update-monitor`, then read it back with `get-monitor-details` before telling the user it worked. That read-back only verifies the fields it returns: `assignedAlertContacts` isn't one of them, so confirm contact changes against the full list the user gave you (or the dashboard). Maintenance-window membership is managed and verified with the maintenance-window tools, not `update-monitor`.

`update-monitor` — add a tag while keeping the existing ones (merge with the `tags` you just read):

```json
{ "monitorId": 800123456, "tagNames": ["production", "critical", "us-east-1"] }
```

`update-monitor` — set alert contacts (this is the whole list the monitor will notify, not an addition):

```json
{
  "monitorId": 800123456,
  "assignedAlertContacts": [
    { "alertContactId": "7697981", "threshold": 0, "recurrence": 0 },
    { "alertContactId": "8066538", "threshold": 5, "recurrence": 30 }
  ]
}
```

## Gotchas

- **`assignedAlertContacts` and `tagNames` are full replacements, not patches.** Sending only the new item removes all the others; `[]` clears them.
- **The current alert contacts can't be read back.** `get-monitor-details` has no `assignedAlertContacts` (nor `maintenanceWindowsIds`). So for "add a contact, keep the existing ones", ask the user for the complete list (or have them check the dashboard) — don't guess and don't send only the new one. For tags, merge with the `tags` field from `get-monitor-details`.
- Contact IDs come from `list-alert-contacts` (personal email/SMS/voice/push) and `list-integrations` (Slack, webhook, …). `list-integrations` also repeats the personal contacts — dedupe by `id`. See [`list-integrations`](../list-integrations/SKILL.md).
- **Some fields are silently ignored:** `authType`, `httpUsername`, `httpPassword`, `keywordType`, `postValueData` / `postValueType`, and `maintenanceWindowsIds`. `update-monitor` returns `Monitor <id> updated successfully` but nothing changes. Set them at create time or in the dashboard (maintenance windows: with the maintenance-window tools). Always verify with `get-monitor-details` before reporting success.
- `responseTimeThreshold` reads back as `0` in `get-monitor-details`; the stored thresholds are in `regionData`.
- Fields that don't fit the monitor's type are rejected with a plain-text message, no numeric code — e.g. `Invalid field for HTTP monitor: gracePeriod. gracePeriod applies only to HEARTBEAT monitors.` Match on `Invalid field`. DNS monitors reject `port` on update (it can only be set at create).
- `config.ipVersion` takes `ipv4Only` / `ipv6Only` (not `IPv4` / `IPv6`).
- `groupId` moves the monitor into a group (`0` = no group). `get-monitor-details` doesn't show the group; check membership with `list-monitors` + `groupId`. See [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md).
- `get-monitor-details` returns `customHttpHeaders` and `httpUsername` unredacted (often bearer tokens or API keys). Don't echo header values or usernames back to the user unless asked; mask them.

## Related

- [`manage-monitors`](../manage-monitors/SKILL.md) — find monitors, pause / resume.
- [`list-integrations`](../list-integrations/SKILL.md) — alert contact IDs.
- [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md) — groups vs. tags.
- [`errors`](../errors/SKILL.md) — mapping plain-text errors.
