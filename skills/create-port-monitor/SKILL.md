---
name: create-port-monitor
description: "Create a PORT monitor that opens a TCP connection to a host and port and alerts when the port stops accepting connections (the default, `portAlertCondition: \"CLOSED\"`) or, with `\"OPEN\"`, when it starts accepting them."
tags: [monitoring, port, tcp, create, uptimerobot]
---

# Create a PORT monitor

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use to check that a TCP port is open on a host — databases, SSH, SMTP, custom services. For UDP services use `create-udp-monitor`; for HTTP status or content use `HTTP` / `KEYWORD`.

**Tool:** `create-monitor` with `type: "PORT"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "Postgres primary",
  "type": "PORT",
  "url": "db.example.com",
  "port": 5432
}
```

## Gotchas

- `url` is the bare host and `port` a separate integer — split `https://host:443` into `"url": "host"` and `"port": 443`.
- `config.ipVersion: "ipv4Only"` is accepted and stored on PORT monitors (on create and on `update-monitor`). `"IPv4"` / `"IPv6"` are rejected.
- Every new monitor reads back `authType: "HTTP_BASIC"` in `get-monitor-details`. That is the stored default, not configured credentials.

## Before creating

Call `list-monitors` with the same `url`, `limit: 100`, paginating while `hasMore` is true, and keep the full result. If a monitor of the same type and target already exists, show it to the user and ask before creating (the server refuses an exact-target duplicate). The list also lets you tell a new monitor from an old one if the create fails (see [`errors`](../errors/SKILL.md)).

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (`port`, tags, timeout). For a `Monitor not found` read-back or a failed create, follow [`errors`](../errors/SKILL.md).

## Related

- `create-udp-monitor` — for UDP services.
- `create-ping-monitor` — reachability without a specific port.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits and invalid parameters.
