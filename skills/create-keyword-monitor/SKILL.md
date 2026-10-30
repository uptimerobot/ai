---
name: create-keyword-monitor
description: Create a KEYWORD monitor that fetches a URL and alerts when a given keyword appears in, or is missing from, the response.
tags: [monitoring, keyword, content-check, create, uptimerobot]
---

# Create a KEYWORD monitor

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use when a 200 is not enough and a specific string must be present (login page shows "Sign in") or absent (page shows "502 Bad Gateway"). For structured assertions on a JSON response, use `create-api-monitor`.

**Tool:** `create-monitor` with `type: "KEYWORD"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "Login page shows Sign in",
  "type": "KEYWORD",
  "url": "https://app.example.com/login",
  "keywordValue": "Sign in",
  "keywordType": "ALERT_NOT_EXISTS"
}
```

## Gotchas

- `keywordType`: `ALERT_NOT_EXISTS` goes down when the keyword is **missing**; `ALERT_EXISTS` goes down when it **appears**.
- `keywordCaseType` reads back `0` (case-sensitive) when omitted; send `1` for case-insensitive matching.
- Every new monitor reads back `authType: "HTTP_BASIC"` in `get-monitor-details`. That is the stored default, not configured credentials.
- `config.ipVersion` takes `"ipv4Only"` / `"ipv6Only"`; `"IPv4"` / `"IPv6"` are rejected.
- `responseTimeThreshold` must be 100–60000 on create; `0` is rejected. Omit it to leave slow-response alerts off.

## Before creating

Call `list-monitors` with the same `url`, `limit: 100`, paginating while `hasMore` is true, and keep the full result. If a monitor of the same type and target already exists, show it to the user and ask before creating (the server refuses an exact-target duplicate). The list also lets you tell a new monitor from an old one if the create fails (see [`errors`](../errors/SKILL.md)).

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (`keywordValue`, `keywordType`, `keywordCaseType`). For a `Monitor not found` read-back or a failed create, follow [`errors`](../errors/SKILL.md).

## Related

- `create-http-monitor` — when only the status code matters.
- `create-api-monitor` — assertions on the response body.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits and invalid parameters.
