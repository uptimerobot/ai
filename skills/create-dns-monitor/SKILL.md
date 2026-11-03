---
name: create-dns-monitor
description: Create a DNS monitor that queries a domain and alerts when the DNS server does not answer or, optionally, when records differ from expected values.
tags: [monitoring, dns, create, uptimerobot]
---

# Create a DNS monitor

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use to confirm a DNS server answers for a domain and, with `config.dnsRecords`, that record values haven't drifted. It does not check web reachability — add an `HTTP` monitor for that.

**Tool:** `create-monitor` with `type: "DNS"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "example.com DNS",
  "type": "DNS",
  "url": "example.com"
}
```

## Gotchas

- `url` is a bare domain, no scheme.
- When `port` is omitted, `get-monitor-details` reads back `port: null` (not `53`). `update-monitor` rejects `port` on DNS monitors, so set a non-standard port at creation.
- `config.dnsRecords` values must match the domain's current records — look them up first (e.g. `dig +short A example.com`) or use values the user gives. A stale value makes the monitor go DOWN right away.
- On `update-monitor`, `config.dnsRecords` replaces the expected records; `null` removes them.

## Before creating

Call `list-monitors` with the same `url`, `limit: 100`, paginating while `hasMore` is true, and keep the full result. If a monitor of the same type and target already exists, show it to the user and ask before creating (the server refuses an exact-target duplicate). The list also lets you tell a new monitor from an old one if the create fails (see [`errors`](../errors/SKILL.md)).

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (records and `port`). For a `Monitor not found` read-back or a failed create, follow [`errors`](../errors/SKILL.md).

## Related

- `create-http-monitor` — also check the service behind the name.
- `update-monitor` — change records, interval, contacts, tags.
- `errors` — recovering from plan limits and invalid parameters.
