---
name: update-monitor
description: Modify an existing UptimeRobot monitor — rename, change URL/interval, swap alert contacts, retag, move between groups, and tweak type-specific settings — without losing the lists it replaces.
tags: [monitors, update, alert-contacts, tags, headers, auth, threshold, uptimerobot]
---

# Update an existing monitor

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use this to change an existing monitor's configuration. Updates are partial — send only the fields you are changing — but a list or map you send replaces the stored value. The full field-by-field rules are in [AGENTS.md — How updates treat list and map fields](../../AGENTS.md#how-updates-treat-list-and-map-fields). `type` can't be changed. To change it, create the new monitor first, then delete the old one only after `get-user` and the user's explicit confirmation — its history, incidents and stats are lost (and a HEARTBEAT gets a new push URL). To pause or resume, use `update-monitor-status` instead (see [`manage-monitors`](../manage-monitors/SKILL.md)).

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
    { "alertContactId": "1234567", "threshold": 0, "recurrence": 0 },
    { "alertContactId": "2345678", "threshold": 5, "recurrence": 30 }
  ]
}
```

## Gotchas

- **List and map fields are full replacements, not patches:** `assignedAlertContacts`, `tagNames`, `customFields`, `successHttpResponseCodes` (`[]` resets it to `2xx`/`3xx`; unknown codes are dropped silently) and `regionData.REGION` (drops the thresholds of regions left out). Sending only the new item removes all the others. For tags, custom fields, success codes and regions, merge with the current values from `get-monitor-details` and send the result in full. Alert contacts can't be read back — ask the user for the full list (below).
- **`config` is merged only at the top level:** each key you send (`apiAssertions`, `dnsRecords`, `udp`, `ipVersion`) replaces that key's whole value. To add one API assertion or DNS record, send the whole object; any `config.udp` must include `packetLossThreshold`. `null` removes a key, but `udp` (UDP) and `apiAssertions` (API) can't be removed, and `config: null` is rejected on those types. Full rules: [how updates treat lists](../../AGENTS.md#how-updates-treat-list-and-map-fields).
- **Silent downgrades:** without the `advanced-notifications` feature, alert-contact `threshold`/`recurrence` are set to 0; without `monitor-slow-response`, `regionData.THRESHOLD` is ignored. Neither is an error.
- **Changing tags or the group can change public status pages.** Pages scoped by `tagIds` or groups pick up monitors by their current tags and group. Before retagging or moving a monitor, check `list-psps` / `get-psp` for pages using that tag (groups aren't shown by `get-psp` — ask the user), and tell the user.
- **The current alert contacts can't be read back.** `get-monitor-details` has no `assignedAlertContacts` (nor `maintenanceWindowsIds`). So for "add a contact, keep the existing ones", ask the user for the complete list (or have them check the dashboard) — don't guess and don't send only the new one. For tags, merge with the `tags` field from `get-monitor-details`.
- Contact IDs come from `list-alert-contacts` (personal email/SMS/voice/push) and `list-integrations` (Slack, webhook, …). `list-integrations` also returns the account's personal contacts — dedupe by `id`. See [`list-integrations`](../list-integrations/SKILL.md).
- **`customHttpHeaders` is merged by name** (case-insensitive): send only the headers to add or change, and `null` to remove one; headers you omit are kept. Values can't be read back. Authentication headers (Authorization, cookies, API and access keys, tokens, secrets, signatures, sessions) and HTTP auth credentials can't be set or changed over MCP — the user sets them in the dashboard.
- **Some fields can't be changed with `update-monitor`:** `authType`, HTTP auth credentials, `keywordType`, `postValueData` / `postValueType` and `maintenanceWindowsIds` aren't in its schema. Set them at create time or in the dashboard (HTTP auth credentials: dashboard only; maintenance windows: with the maintenance-window tools). Always verify with `get-monitor-details` before reporting success.
- `responseTimeThreshold` reads back as `0` in `get-monitor-details`; the stored thresholds are in `regionData`.
- Fields that don't fit the monitor's type are rejected with a plain-text message, no numeric code — e.g. `Invalid field for HTTP monitor: gracePeriod. gracePeriod applies only to HEARTBEAT monitors.` Match on `Invalid field`. DNS monitors reject `port` on update (it can only be set at create).
- `config.ipVersion` takes `ipv4Only` / `ipv6Only` (not `IPv4` / `IPv6`).
- `groupId` moves the monitor into a group (`0` = no group). `get-monitor-details` doesn't show the group; check membership with `list-monitors` + `groupId`. See [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md).
- `get-monitor-details` lists header names only (`customHttpHeaderNames`), never values, and no HTTP auth username or password.

## Related

- [`manage-monitors`](../manage-monitors/SKILL.md) — find monitors, pause / resume.
- [`list-integrations`](../list-integrations/SKILL.md) — alert contact IDs.
- [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md) — groups vs. tags.
- [`errors`](../errors/SKILL.md) — mapping plain-text errors.
