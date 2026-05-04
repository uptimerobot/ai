---
name: create-dns-monitor
description: Create a DNS monitor that resolves records for a domain and alerts when they change or the DNS server does not respond.
tags: [monitoring, dns, create, uptimerobot]
---

# Create a DNS monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use when the user wants to confirm a DNS server is answering queries for a domain and/or that specific record values (A, AAAA, MX, TXT, NS, CNAME, etc.) haven't drifted from the expected set.

**Tool:** `create-monitor`
**Required params:** `friendlyName`, `type: "DNS"`, `url` (domain, no scheme).

## Minimal call

```json
{
  "friendlyName": "example.com DNS",
  "type": "DNS",
  "url": "example.com"
}
```

## Common optional params

- `port` — DNS server port. Defaults to `53` if omitted.
- `config.dnsRecords` — object mapping record type to expected values. The monitor alerts when live values diverge.
- `interval`, `timeout`, `assignedAlertContacts`, `tagNames`, `maintenanceWindowsIds`.

## Example: assert A and MX records

```json
{
  "friendlyName": "example.com records",
  "type": "DNS",
  "url": "example.com",
  "config": {
    "dnsRecords": {
      "A": ["93.184.216.34"],
      "MX": ["0 mail.example.com."]
    }
  },
  "interval": 300,
  "assignedAlertContacts": [
    { "alertContactId": "10", "threshold": 0, "recurrence": 0 }
  ]
}
```

## Common mistakes

- Passing `url` as `https://example.com` — DNS monitors take a bare domain.
- Passing a non-standard `port` without understanding that it targets a DNS server listening on that port (not a monitored service port). Leave it out unless the user explicitly runs DNS on a custom port.
- Assuming DNS monitors check web reachability — they don't. Use `HTTP` in addition for that.
- Expected record values must match the authoritative server exactly, including trailing dots on MX/NS/CNAME where applicable.

## After creation

Call `get-monitor-details` to confirm stored records and port.

## Related

- `create-http-monitor` — to also check the service behind the DNS name.
- `update-monitor` — retune interval, alert contacts, and tags on an existing DNS monitor. (Note: `dnsRecords` are set at creation and changing them requires creating a new monitor.)
