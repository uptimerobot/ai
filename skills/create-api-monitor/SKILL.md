---
name: create-api-monitor
description: Create an API monitor that calls an HTTP endpoint and runs 1–5 assertions on the response, combined with AND/OR logic; alerts when they fail.
tags: [monitoring, api, assertions, json, create, uptimerobot]
---

# Create an API monitor

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

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
- `config.ipVersion: "ipv4Only"` is accepted and stored alongside `config.apiAssertions`. `"IPv4"` / `"IPv6"` are rejected.
- `get-monitor-details` returns `customHttpHeaders` unredacted. Don't echo header values (tokens, API keys) back to the user.

## Before creating

Call `list-monitors` with the same `url`, `limit: 100`, paginating while `hasMore` is true, and keep the full result. If a monitor of the same type and target already exists, show it to the user and ask before creating (the server refuses an exact-target duplicate). The list also lets you tell a new monitor from an old one if the create fails (see [`errors`](../errors/SKILL.md)).

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (`config.apiAssertions`). For a `Monitor not found` read-back or a failed create, follow [`errors`](../errors/SKILL.md).

## Related

- `create-keyword-monitor` — simpler single-string body check.
- `update-monitor` — replace assertions on an existing monitor.
- `errors` — recovering from malformed assertions and plan limits.
