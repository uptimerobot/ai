---
name: create-http-monitor
description: Create an HTTP monitor in UptimeRobot that checks a URL for a successful HTTP response on an interval.
tags: [monitoring, http, create, uptimerobot]
---

# Create an HTTP monitor

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use to check that a website or HTTP(S) endpoint responds with a success code. Pick `KEYWORD` to match body text, `API` for assertions on the response, and `PING` / `PORT` for host-level checks.

**Tool:** `create-monitor` with `type: "HTTP"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "Production API",
  "type": "HTTP",
  "url": "https://api.example.com/health"
}
```

## Gotchas

- A `url` without a scheme (`"example.com"`) is accepted and stored as-is. Always send the full URL with `https://`; use `PING` for a bare host.
- Every new monitor reads back `authType: "HTTP_BASIC"` with an empty `httpUsername` in `get-monitor-details`. That is the stored default, not configured credentials.
- `config.ipVersion` takes `"ipv4Only"` / `"ipv6Only"`; `"IPv4"` / `"IPv6"` are rejected.
- `responseTimeThreshold` must be 100–60000 on create; `0` is rejected. Omit it to leave slow-response alerts off.
- `get-monitor-details` returns `customHttpHeaders` unredacted. Don't echo header values (tokens, API keys) back to the user.
- Validation errors come back as plain text (`Invalid parameters: [field]: …`) with no numeric code — match on the message.

## Before creating

Call `list-monitors` with the same `url`, `limit: 100`, paginating while `hasMore` is true, and keep the full result. If a monitor of the same type and target already exists, show it to the user and ask before creating (the server refuses an exact-target duplicate). The list also lets you tell a new monitor from an old one if the create fails (see [`errors`](../errors/SKILL.md)).

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (tags, timeout, HTTP settings). For a `Monitor not found` read-back or a failed create, follow [`errors`](../errors/SKILL.md).

## Related

- `create-keyword-monitor` — assert text is (or isn't) in the body.
- `create-api-monitor` — assertions on the response body.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits, invalid parameters, rate limits.
- `conventions` — ID discovery (write verification: `errors`).
