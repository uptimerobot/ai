---
name: create-udp-monitor
description: Create a UDP monitor that sends a UDP packet to a host:port and optionally checks the response keyword or packet-loss threshold.
tags: [monitoring, udp, create, uptimerobot]
---

# Create a UDP monitor

Use for UDP-based services — DNS (as a generic UDP check, not the DNS record monitor), NTP, QUIC, game servers, custom UDP endpoints. For TCP, use `PORT` instead.

**Tool:** `create-monitor`
**Required params:** `friendlyName`, `type: "UDP"`, `url` (host or IP, no scheme), `port` (1–65535).

## Minimal call

```json
{
  "friendlyName": "Game server lobby",
  "type": "UDP",
  "url": "lobby.example.com",
  "port": 27015
}
```

## Common optional params

- `config.udp.payload` — UDP payload to send. Some services only respond to specific probe bytes.
- `config.udp.packetLossThreshold` — number. Packet-loss percentage above which the monitor is considered down.
- `keywordValue` — expected substring in the response payload. Leave off if the service echoes anything or you only care about reachability.
- `config.ipVersion` — `IPv4` / `IPv6`.
- `timeout`, `interval`, `responseTimeThreshold`, `assignedAlertContacts`, `tagNames`, `maintenanceWindowsIds`.

## Example with payload and keyword

```json
{
  "friendlyName": "Custom UDP health",
  "type": "UDP",
  "url": "udp.example.com",
  "port": 9999,
  "config": {
    "udp": {
      "payload": "PING",
      "packetLossThreshold": 20
    }
  },
  "keywordValue": "PONG",
  "timeout": 5,
  "interval": 120
}
```

## Common mistakes

- Using UDP for a TCP service (HTTP, databases, SSH). Use `PORT`.
- Setting `keywordValue` when the service does not echo data. You'll get false downtime.
- Forgetting `port` — UDP requires an explicit port.
- Assuming NAT'd or stateful-firewalled services will respond. UDP has no connection; many networks silently drop packets.

## After creation

Call `get-monitor-details` to confirm stored `port`, `config.udp`, and any `keywordValue`.

## Related

- `create-port-monitor` — for TCP.
- `create-ping-monitor` — when you only need reachability.
