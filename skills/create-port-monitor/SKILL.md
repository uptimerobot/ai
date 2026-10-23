---
name: create-port-monitor
description: Create a PORT monitor that opens a TCP connection to a host and port and alerts when the port stops accepting connections.
tags: [monitoring, port, tcp, create, uptimerobot]
---

# Create a PORT monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

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
- `config.ipVersion: "ipv4Only"` is accepted and stored on PORT monitors (on create and on `update-monitor`), even though the schema describes it as HTTP/KEYWORD-only. `"IPv4"` / `"IPv6"` are rejected.
- Every new monitor reads back `authType: "HTTP_BASIC"` with an empty `httpUsername` in `get-monitor-details`. That is the stored default, not configured credentials.

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (`port`, tags, timeout); if it returns `Monitor not found` right after the create, the monitor still exists (you have its `id`) — wait a few seconds and retry once; never re-create. If `create-monitor` itself failed, follow `errors` → "Before retrying a failed write".

## Related

- `create-udp-monitor` — for UDP services.
- `create-ping-monitor` — reachability without a specific port.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits and invalid parameters.
