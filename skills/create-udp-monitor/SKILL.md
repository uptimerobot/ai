---
name: create-udp-monitor
description: Create a UDP monitor that sends a packet to a host and port and alerts on no response, with optional payload, response keyword and packet-loss threshold.
tags: [monitoring, udp, create, uptimerobot]
---

# Create a UDP monitor

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use for UDP services — NTP, game servers, QUIC, custom UDP endpoints. For TCP services use `create-port-monitor`; for DNS record checks use `create-dns-monitor`.

**Tool:** `create-monitor` with `type: "UDP"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "Game server lobby",
  "type": "UDP",
  "url": "lobby.example.com",
  "port": 27015,
  "config": { "udp": { "packetLossThreshold": 50 } }
}
```

## Gotchas

- **Always set `config.udp` (with `packetLossThreshold`) at create.** A UDP monitor created without it can't take any later `config` change (even `ipVersion`) until a full `config.udp` is sent.
- Whenever you send `config.udp` (e.g. to set a `payload`), on create or update, it must include `packetLossThreshold` — on update, read the stored one from `get-monitor-details`, or ask the user if none is stored. Without it the call is rejected: on create `[config.udp.packetLossThreshold]: Invalid input`, on update `Invalid UDP monitor configuration: config.udp.packetLossThreshold is required…`. See [how updates treat `config`](../../AGENTS.md#how-updates-treat-list-and-map-fields).
- `url` is the bare host or IP and `port` a separate integer.
- Every new monitor reads back `authType: "HTTP_BASIC"` with an empty `httpUsername` in `get-monitor-details`. That is the stored default, not configured credentials.

## Before creating

Call `list-monitors` with the same `url`, `limit: 100`, paginating while `hasMore` is true, and keep the full result. If a monitor of the same type and target already exists, show it to the user and ask before creating (the server refuses an exact-target duplicate). The list also lets you tell a new monitor from an old one if the create fails (see [`errors`](../errors/SKILL.md)).

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (`port`, `config.udp`, any `keywordValue`). For a `Monitor not found` read-back or a failed create, follow [`errors`](../errors/SKILL.md).

## Related

- `create-port-monitor` — for TCP.
- `create-ping-monitor` — reachability only.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits and invalid parameters.
