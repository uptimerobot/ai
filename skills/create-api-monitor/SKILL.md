---
name: create-api-monitor
description: Create an API monitor that calls an HTTP endpoint and runs 1–5 assertions on the response, combined with AND/OR logic; alerts when they fail.
tags: [monitoring, api, assertions, json, create, uptimerobot]
---

# Create an API monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use when specific fields of a (usually JSON) response must hold — not just the status code. For a status check use `HTTP`; for one string in the body use `KEYWORD`.

**Tool:** `create-monitor` with `type: "API"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "Billing API healthy",
  "type": "API",
  "url": "https://api.example.com/health",
  "config": {
    "apiAssertions": {
      "logic": "AND",
      "checks": [{ "property": "$.status", "comparison": "equals", "target": "ok" }]
    }
  }
}
```

## Gotchas

- Assertions are stored verbatim and evaluated on every check: pointing a JSONPath check at a non-JSON page (e.g. an HTML homepage) creates the monitor but it goes DOWN. Confirm the endpoint's response shape first.
- `config.ipVersion: "ipv4Only"` is accepted and stored alongside `config.apiAssertions`, even though the schema describes it as HTTP/KEYWORD-only. `"IPv4"` / `"IPv6"` are rejected.
- `get-monitor-details` returns `customHttpHeaders` unredacted. Don't echo header values (tokens, API keys) back to the user.

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (`config.apiAssertions`); if it returns `Monitor not found` right after the create, the monitor still exists (you have its `id`) — wait a few seconds and retry once; never re-create. If `create-monitor` itself failed, follow `errors` → "Before retrying a failed write".

## Related

- `create-keyword-monitor` — simpler single-string body check.
- `update-monitor` — replace assertions on an existing monitor.
- `errors` — recovering from malformed assertions and plan limits.
