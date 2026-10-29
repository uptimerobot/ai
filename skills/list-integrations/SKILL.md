---
name: list-integrations
description: Find the alert-contact IDs (integrations such as Slack or webhooks, plus personal email/SMS/voice/push contacts) to attach to UptimeRobot monitors.
tags: [integrations, alert-contacts, notifications, list, uptimerobot]
---

# List integrations

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use this when the user wants alerts to go somewhere ("alert me on Slack", "email the team") — you need the contact's `id` before `create-monitor` or `update-monitor` will accept it in `assignedAlertContacts`.

**Tools:** `list-integrations`, `list-alert-contacts`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

`list-integrations` — one large page:

```json
{ "limit": 100 }
```

## Gotchas

- **`list-integrations` also returns every personal contact** (email, Pro SMS, voice, iOS/Android push — the same `id`s `list-alert-contacts` returns when the session is the person's own account), plus some extra Email/ProSms/Voice entries such as notify-only contacts. Its tool description says otherwise. To list everything attachable, call both tools and dedupe by `id`. Identify personal contacts by `type`: in a team session `list-integrations` also returns the account owner's personal contacts, which `list-alert-contacts` (the signed-in person's) doesn't.
- **Never pass a personal contact's `id` to `delete-integration`.** Check its `type` first; personal contacts are removed with `delete-alert-contact`. Both deletes are permanent — call `get-user` and confirm with the user first.
- **Pagination: never copy the call in `instructions`** — it drops `limit`. Repeat your own arguments with `cursor` set to `nextCursor` while `hasMore` is true. `totalCount` is only on the first page (always `null` on `list-alert-contacts`), so count items yourself.
- `friendlyName` can be `null` — fall back to `type` + `id` when naming a contact.
- Only `status: "Active"` contacts deliver alerts, and one with `enableNotificationsFor: "None"` never does. Tell the user before attaching such a contact.
- `value` is `"[REDACTED]"` for webhook, chat and push types, but email addresses and phone numbers come back in clear. Don't echo them unless asked.

## Related

- [`update-monitor`](../update-monitor/SKILL.md) — attach contacts to an existing monitor (the list is replaced, not merged).
- `create-*-monitor` skills — attach contacts at create time.
- [`errors`](../errors/SKILL.md) — `Alert contact not found` and other messages.
