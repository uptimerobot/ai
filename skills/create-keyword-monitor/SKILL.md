---
name: create-keyword-monitor
description: Create a KEYWORD monitor that fetches a URL and alerts when a given keyword appears in, or is missing from, the response.
tags: [monitoring, keyword, content-check, create, uptimerobot]
---

# Create a KEYWORD monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use when a 200 is not enough and a specific string must be present (login page shows "Sign in") or absent (page shows "502 Bad Gateway"). For structured assertions on a JSON response, use `create-api-monitor`.

**Tool:** `create-monitor` with `type: "KEYWORD"`. The tool's own schema and description are the reference for every parameter — this page only covers what they don't say.

## Minimal call

```json
{
  "friendlyName": "Login page shows Sign in",
  "type": "KEYWORD",
  "url": "https://app.example.com/login",
  "keywordValue": "Sign in",
  "keywordType": "ALERT_NOT_EXISTS"
}
```

## Gotchas

- `keywordType`: `ALERT_NOT_EXISTS` goes down when the keyword is **missing**; `ALERT_EXISTS` goes down when it **appears**.
- `keywordCaseType` reads back `0` (case-sensitive) when omitted; send `1` for case-insensitive matching.
- Every new monitor reads back `authType: "HTTP_BASIC"` with an empty `httpUsername` in `get-monitor-details`. That is the stored default, not configured credentials.
- `config.ipVersion` takes `"ipv4Only"` / `"ipv6Only"`; `"IPv4"` / `"IPv6"` are rejected.
- `responseTimeThreshold` must be 100–60000 on create; `0` is rejected. Omit it to leave slow-response alerts off.

## After creating

The create response already has the stored `id`, `name`, `type`, `url`, `interval` and `status`. Call `get-monitor-details` (integer `id`) only to confirm other fields you set (`keywordValue`, `keywordType`, `keywordCaseType`); if it returns `Monitor not found` right after the create, wait a few seconds and retry once — never re-create.

## Related

- `create-http-monitor` — when only the status code matters.
- `create-api-monitor` — assertions on the response body.
- `update-monitor` — change an existing monitor.
- `errors` — recovering from plan limits and invalid parameters.
