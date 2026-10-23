---
name: create-http-monitor
description: Create an HTTP monitor in UptimeRobot that checks a URL for a successful HTTP response on an interval.
tags: [monitoring, http, create, uptimerobot]
---

# Create an HTTP monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

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

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (tags, timeout, HTTP settings); if it returns `Monitor not found` right after the create, the monitor still exists (you have its `id`) — wait a few seconds and retry once; never re-create. If `create-monitor` itself failed, follow `errors` → "Before retrying a failed write".

## Related

- `create-keyword-monitor` — assert text is (or isn't) in the body.
- `create-api-monitor` — assertions on the response body.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits, invalid parameters, rate limits.
- `conventions` — ID discovery and verification rules.
