---
name: create-udp-monitor
description: Create a UDP monitor that sends a packet to a host and port and alerts on no response, with optional payload, response keyword and packet-loss threshold.
tags: [monitoring, udp, create, uptimerobot]
---

# Create a UDP monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use for UDP services — NTP, game servers, QUIC, custom UDP endpoints. For TCP services use `create-port-monitor`; for DNS record checks use `create-dns-monitor`.

**Tool:** `create-monitor` with `type: "UDP"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "Game server lobby",
  "type": "UDP",
  "url": "lobby.example.com",
  "port": 27015
}
```

## Gotchas

- Whenever you send `config.udp` (e.g. to set a `payload`), it must include `packetLossThreshold`; without it the call is rejected (`[config.udp.packetLossThreshold]: Invalid input`).
- `url` is the bare host or IP and `port` a separate integer.
- Every new monitor reads back `authType: "HTTP_BASIC"` with an empty `httpUsername` in `get-monitor-details`. That is the stored default, not configured credentials.

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (`port`, `config.udp`, any `keywordValue`); if it returns `Monitor not found` right after the create, wait a few seconds and retry once — never re-create.

## Related

- `create-port-monitor` — for TCP.
- `create-ping-monitor` — reachability only.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits and invalid parameters.
