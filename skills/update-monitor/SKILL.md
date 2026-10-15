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

Max `86400` seconds (1 day) for every type except HEARTBEAT, which goes up to `2678400` (31 days). The minimum depends on the plan (the schema floor is 15 s); an interval below the plan minimum returns `-28002 subscription_limit_exceeded`.

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

Every item needs `alertContactId`, `threshold`, and `recurrence`. `alertContactId` accepts a string or a number. Get IDs from `list-integrations` (Slack, webhook, PagerDuty, …) or `list-alert-contacts` (email, SMS, voice, push). `threshold` = minutes the monitor must be down before notifying (0–1440); `recurrence` = re-notify every N minutes while still down (0–10080, 0 = no repeat).

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

### 9. Retag or move to a group

To move a monitor into a monitor group, pass `groupId`; `0` removes it from its group:

```json
{ "monitorId": 800123456, "groupId": 42 }
```

Get group IDs from `list-monitor-groups` — see [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md). To tag a monitor for lightweight filtering, replace the whole tag set in one call:

```json
{ "monitorId": 800123456, "tagNames": ["production", "critical", "us-east-1"] }
```

To add one tag without losing the others, merge first (like alert contacts). Sending `[]` clears all tags.

### 10. Update HTTP settings (HTTP / KEYWORD / API)

```json
{
  "monitorId": 800123456,
  "followRedirections": true,
  "checkSSLErrors": true
}
```

`followRedirections` and `checkSSLErrors` are rejected on PING / PORT / HEARTBEAT / DNS / UDP with `-29001`.

### 11. Update HTTP method + headers + expected codes (HTTP / KEYWORD / API)

```json
{
  "monitorId": 800987654,
  "httpMethodType": "POST",
  "customHttpHeaders": {
    "Content-Type": "application/json",
    "X-Client": "uptimerobot"
  },
  "successHttpResponseCodes": ["200", "201", "204"]
}
```

These fields (`httpMethodType`, `customHttpHeaders`, `successHttpResponseCodes`) apply to all **HTTP-based** types (HTTP, KEYWORD, API) — the example above just happens to use an API monitor. (`config.apiAssertions` in section 12 is the piece that's genuinely API-only.)

`update-monitor` does **not** accept `authType`, `httpUsername`, `httpPassword`, `postValueType`, `postValueData`, or `postContentType`. These can only be set on `create-monitor`; to change them, use the UptimeRobot dashboard or recreate the monitor.

### 12. Update API assertions

```json
{
  "monitorId": 800987654,
  "config": {
    "apiAssertions": {
      "logic": "AND",
      "checks": [
        { "property": "$.status", "comparison": "equals", "target": "ok" },
        { "property": "$.queueDepth", "comparison": "less_than", "target": 100 }
      ]
    }
  }
}
```

`logic` is `AND` or `OR`. 1–5 checks. `property` is a JSONPath against the response body (same format as [`create-api-monitor`](../create-api-monitor/SKILL.md)). Fully replaces the existing assertion set.

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

1–65535. Also works for UDP monitors. DNS monitors accept `port` too (the DNS-server port, default 53) — omit it unless the server runs on a non-standard port.

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
{ "monitorId": 800123456, "config": { "ipVersion": "ipv4Only" } }
```

Valid values: `ipv4Only`, `ipv6Only` (exact spelling — `IPv4` / `IPv6` are rejected), or `null` to remove the preference. Only HTTP, KEYWORD and API monitors accept it. If your URL is a literal IP, the server cross-checks it against this field and rejects mismatches.

## Pause vs. update

Pausing is a separate tool — `update-monitor-status` with `{ "status": "PAUSED" }` or `{ "status": "STARTED" }`. See the [`manage-monitors`](../manage-monitors/SKILL.md) skill, or [`bulk-pause`](../bulk-pause/SKILL.md) for multi-monitor flows.

## Common mistakes

- Sending `type` — ignored/rejected. Create a new monitor for type changes.
- Sending a field that doesn't belong to the monitor's type (e.g. `gracePeriod` on HTTP, `port` on HEARTBEAT, `keywordValue` on DNS). Returns `-29001 invalid_parameters`.
- Treating `assignedAlertContacts` / `tagNames` as patches. They overwrite — always read-modify-write.
- Sending `authType`, `httpUsername`, `httpPassword`, or `postValue*` fields — `update-monitor` doesn't accept them. Change them in the dashboard or recreate the monitor.
- Asking for a monitor-group rename. `update-monitor` only moves a monitor between groups (`groupId`); renames use `update-monitor-group` — see [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md).
- Updating when the authorized account lacks write access — returns `-31002 access_denied`. Re-authenticate with a write-capable account (see [`setup`](../setup/SKILL.md)).
- Skipping the post-write `get-monitor-details`. A follow-up `list-monitors` can still show the old values due to replication lag.

## Related

- [`manage-monitors`](../manage-monitors/SKILL.md) — list, get details, pause / resume.
- [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md) — dedicated group IDs, and the tags-vs-groups decision.
- [`list-integrations`](../list-integrations/SKILL.md) — discover `alertContactId` values before attaching (personal email/SMS/voice/push contacts come from `list-alert-contacts`).
- [`bulk-pause`](../bulk-pause/SKILL.md) — pause/resume many monitors during deploys.
- [`errors`](../errors/SKILL.md) — recovery for `-28002`, `-29001`, `-30001`, `-31002`.
