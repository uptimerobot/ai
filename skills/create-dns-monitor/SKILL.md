---
name: create-dns-monitor
description: Create a DNS monitor that queries a domain and alerts when the DNS server does not answer or, optionally, when records differ from expected values.
tags: [monitoring, dns, create, uptimerobot]
---

# Create a DNS monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

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

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (records and `port`); if it returns `Monitor not found` right after the create, wait a few seconds and retry once — never re-create.

## Related

- `create-http-monitor` — also check the service behind the name.
- `update-monitor` — change records, interval, contacts, tags.
- `errors` — recovering from plan limits and invalid parameters.
