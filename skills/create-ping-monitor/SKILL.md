---
name: create-ping-monitor
description: Create a PING monitor that sends ICMP echo requests to a hostname or IP and alerts when the host stops responding.
tags: [monitoring, ping, icmp, create, uptimerobot]
---

# Create a PING monitor

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use for basic network reachability of a host or IP. PING checks nothing about HTTP status or content — use `HTTP` / `KEYWORD` / `API` for that, or `PORT` when ICMP is filtered but a TCP port is open.

**Tool:** `create-monitor` with `type: "PING"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "Office gateway",
  "type": "PING",
  "url": "gw.example.com"
}
```

## Gotchas

- `url` is a bare hostname or IP (e.g. `"203.0.113.42"`) — no scheme, no path.
- `config.ipVersion: "ipv4Only"` is accepted and stored on PING monitors. `"IPv4"` / `"IPv6"` are rejected.
- Every new monitor reads back `authType: "HTTP_BASIC"` in `get-monitor-details`. That is the stored default, not configured credentials.

## Before creating

Call `list-monitors` with the same `url`, `limit: 100`, paginating while `hasMore` is true, and keep the full result. If a monitor of the same type and target already exists, show it to the user and ask before creating (the server refuses an exact-target duplicate). The list also lets you tell a new monitor from an old one if the create fails (see [`errors`](../errors/SKILL.md)).

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (tags, timeout, `config.ipVersion`). For a `Monitor not found` read-back or a failed create, follow [`errors`](../errors/SKILL.md).

## Related

- `create-port-monitor` — when ICMP is blocked but a TCP port is open.
- `create-http-monitor` — when there is an HTTP(S) URL.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits and invalid parameters.
