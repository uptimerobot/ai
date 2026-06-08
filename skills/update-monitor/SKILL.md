---
name: update-monitor
description: Modify an existing UptimeRobot monitor — rename, change URL/interval, swap alert contacts, retag, tweak HTTP/keyword/API/heartbeat settings, and toggle SSL or domain reminders.
tags: [monitors, update, alert-contacts, tags, headers, auth, threshold, uptimerobot]
---

# Update an existing monitor

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Uses the `update-monitor` tool. All updates are **partial** — only send the fields you want to change. Monitor `type` is immutable; delete and recreate if you need a different type.

## Before you call

1. Resolve the `monitorId` with `list-monitors` (search by name) — never guess an ID.
2. `get-monitor-details` to read the current config. You'll need it for the array fields below.
3. Call `update-monitor` with just the changed fields.
4. `get-monitor-details` again to verify. Replication lag can make a follow-up `list-monitors` look stale.

### Array fields overwrite (not merge)

`assignedAlertContacts` and `tagNames` are **full replacements**. To add or remove a single item, read-modify-write using the list from `get-monitor-details`.

## Use cases

### 1. Rename a monitor

```json
{ "monitorId": 800123456, "friendlyName": "Production API (us-east-1)" }
```

### 2. Change the target URL

```json
{ "monitorId": 800123456, "url": "https://api.example.com/v2/health" }
```

Only valid for URL-based types (HTTP, KEYWORD, PING, PORT, DNS, API, UDP). HEARTBEAT monitors have no `url` — the push URL is fixed at creation.

### 3. Adjust the check interval

```json
{ "monitorId": 800123456, "interval": 60 }
```

Range: `30`–`86400` seconds. 30 s is paid plans only — Free returns `-28002 subscription_limit_exceeded`.

### 4. Tune request timeout and slow-response threshold

```json
{
  "monitorId": 800123456,
  "timeout": 15,
  "responseTimeThreshold": 2000
}
```

- `timeout` — 1–60 s. Not valid on HEARTBEAT.
- `responseTimeThreshold` — ms, `0` disables. Applies to every active region.

### 5. Heartbeat grace period

```json
{ "monitorId": 800123456, "gracePeriod": 300 }
```

Seconds the server waits past the expected ping before marking the monitor DOWN. HEARTBEAT only — sending `gracePeriod` on any other type is rejected with `-29001`.

### 6. Add one alert contact (read → merge → write)

```json
// Step 1: get-monitor-details returns
{ "assignedAlertContacts": [
    { "alertContactId": "10", "threshold": 0, "recurrence": 0 }
] }

// Step 2: update-monitor with the merged array
{ "monitorId": 800123456, "assignedAlertContacts": [
    { "alertContactId": "10", "threshold": 0, "recurrence": 0 },
    { "alertContactId": "42", "threshold": 5, "recurrence": 30 }
] }
```

`alertContactId` is a **string**, not a number. Use `list-integrations` to find the right ID. `threshold` = consecutive failures before firing; `recurrence` = re-alert interval in minutes (0 = no repeat).

### 7. Remove an alert contact

Same pattern — fetch the current array, drop the entry, send back the remaining array. Sending `[]` detaches every alert contact.

### 8. Silence reminders (SSL / domain expiration)

```json
{
  "monitorId": 800123456,
  "sslExpirationReminder": false,
  "domainExpirationReminder": false
}
```

Useful for staging / internal domains where cert/domain expiry is expected or handled elsewhere.

### 9. Retag / reorganize ("monitor group" equivalent)

UptimeRobot's MCP server does **not** expose monitor-group endpoints — grouping is done with **tags**. Replace the whole tag set in one call:

```json
{ "monitorId": 800123456, "tagNames": ["production", "critical", "us-east-1"] }
```

To add one tag without losing the others, merge first (like alert contacts). Max 20 tags, each 1–50 chars. Sending `[]` clears all tags.

### 10. Update HTTP settings (HTTP / KEYWORD / API)

```json
{
  "monitorId": 800123456,
  "followRedirections": true,
  "checkSSLErrors": true
}
```

`followRedirections` and `checkSSLErrors` are rejected on PING / PORT / HEARTBEAT / DNS / UDP with `-29001`.

### 11. Update API monitor auth + headers + expected codes

```json
{
  "monitorId": 800987654,
  "httpMethodType": "POST",
  "authType": "BEARER",
  "httpPassword": "${API_TOKEN}",
  "customHttpHeaders": {
    "Content-Type": "application/json",
    "X-Client": "uptimerobot"
  },
  "successHttpResponseCodes": ["200", "201", "204"],
  "postValueType": "RAW_JSON",
  "postValueData": "{\"ping\":true}"
}
```

These fields (`httpMethodType`, `authType`, `httpUsername`, `httpPassword`, `customHttpHeaders`, `successHttpResponseCodes`, `postValueData`, `postValueType`) only apply to **API** monitors. For `BEARER`, put the token in `httpPassword`. For `HTTP_BASIC` / `DIGEST`, use `httpUsername` + `httpPassword`.

### 12. Update API assertions

```json
{
  "monitorId": 800987654,
  "config": {
    "apiAssertions": {
      "logic": "AND",
      "checks": [
        { "property": "status_code", "comparison": "equals", "target": "200" },
        { "property": "response_body", "comparison": "contains", "target": "\"ok\":true" }
      ]
    }
  }
}
```

`logic` is `AND` or `OR`. 1–5 checks. Fully replaces the existing assertion set.

### 13. Update KEYWORD match

```json
{
  "monitorId": 800123456,
  "keywordValue": "All systems operational",
  "keywordCaseType": 1
}
```

`keywordCaseType`: `0` case-sensitive, `1` case-insensitive. The `keywordType` (`ALERT_EXISTS` / `ALERT_NOT_EXISTS`) is set at creation and isn't exposed on update.

### 14. Change a PORT monitor's port

```json
{ "monitorId": 800123456, "port": 5432 }
```

1–65535. Also works for UDP monitors.

### 15. Change UDP payload and packet-loss threshold

```json
{
  "monitorId": 800123456,
  "config": {
    "udp": {
      "payload": "ping",
      "packetLossThreshold": 20
    }
  }
}
```

### 16. Pin IP version

```json
{ "monitorId": 800123456, "config": { "ipVersion": "IPV4" } }
```

Valid values: `IPV4`, `IPV6`. If your URL is a literal IP, the server cross-checks it against this field and rejects mismatches.

## Pause vs. update

Pausing is a separate tool — `update-monitor-status` with `{ "status": "PAUSED" }` or `{ "status": "STARTED" }`. See the [`manage-monitors`](../manage-monitors/SKILL.md) skill, or [`bulk-pause`](../bulk-pause/SKILL.md) for multi-monitor flows.

## Common mistakes

- Sending `type` — ignored/rejected. Create a new monitor for type changes.
- Sending a field that doesn't belong to the monitor's type (e.g. `gracePeriod` on HTTP, `port` on HEARTBEAT, `keywordValue` on DNS). Returns `-29001 invalid_parameters`.
- Treating `assignedAlertContacts` / `tagNames` as patches. They overwrite — always read-modify-write.
- Passing `alertContactId` as a number. It's a string in every response and must be a string on write.
- Asking for a monitor-group rename. MCP has no group endpoints — use tags.
- Updating when the authorized account lacks write access — returns `-31002 access_denied`. Re-authenticate with a write-capable account (see [`setup`](../setup/SKILL.md)).
- Skipping the post-write `get-monitor-details`. A follow-up `list-monitors` can still show the old values due to replication lag.

## Related

- [`manage-monitors`](../manage-monitors/SKILL.md) — list, get details, pause / resume.
- [`list-integrations`](../list-integrations/SKILL.md) — discover `alertContactId` values before attaching.
- [`bulk-pause`](../bulk-pause/SKILL.md) — pause/resume many monitors during deploys.
- [`errors`](../errors/SKILL.md) — recovery for `-28002`, `-29001`, `-30001`, `-31002`.
