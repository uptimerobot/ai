---
name: create-ping-monitor
description: Create a PING monitor that sends ICMP echo requests to a hostname or IP and alerts when the host stops responding.
tags: [monitoring, ping, icmp, create, uptimerobot]
---

# Create a PING monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

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
- `config.ipVersion: "ipv4Only"` is accepted and stored on PING monitors, even though the schema describes it as HTTP/KEYWORD-only. `"IPv4"` / `"IPv6"` are rejected.
- Every new monitor reads back `authType: "HTTP_BASIC"` with an empty `httpUsername` in `get-monitor-details`. That is the stored default, not configured credentials.

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (tags, timeout, `config.ipVersion`); if it returns `Monitor not found` right after the create, wait a few seconds and retry once — never re-create.

## Related

- `create-port-monitor` — when ICMP is blocked but a TCP port is open.
- `create-http-monitor` — when there is an HTTP(S) URL.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits and invalid parameters.
