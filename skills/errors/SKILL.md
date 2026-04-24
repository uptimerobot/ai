---
name: errors
description: Handle UptimeRobot MCP errors — codes, meanings, retry policy, and user-facing recovery suggestions.
tags: [errors, troubleshooting, rate-limit, uptimerobot]
---

# Errors

The UptimeRobot MCP server returns structured JSON-RPC errors with numeric codes. Map them to user-facing messages rather than echoing raw codes.

## Error codes

| Code | Name | Retryable | Meaning |
| -- | -- | -- | -- |
| `-28001` | `monitor_limit_exceeded` | No | Account has hit its plan's monitor cap. Creation or resuming a paused monitor exceeded it. |
| `-28002` | `subscription_limit_exceeded` | No | Request violates plan limits — most commonly `interval` too aggressive, or a monitor type not available on the plan. |
| `-29001` | `invalid_parameters` | No | Payload failed validation. Includes blacklisted URLs, forbidden fields for a monitor type, wrong enum values, string too long, etc. The error message usually lists the offending fields. |
| `-30001` | `monitor_not_found` | No | Monitor ID doesn't exist or isn't owned by this account. |
| `-30003` | `resource_not_found` | No | A referenced resource (alert contact, maintenance window, tag) doesn't exist. |
| `-31001` | `user_not_found` | No | Authentication failed. Missing / wrong / revoked Bearer token. |
| `-31002` | `access_denied` | No | Common cause: a read-only API key was used for a write tool. Also triggered when the account doesn't have permission for the requested action. |
| `-32603` | `internal` | Maybe | Unexpected server error. One retry with backoff is fine; escalate on repeat. |
| HTTP `429` | rate limit | Yes | Back off with exponential delay + jitter, then retry. |

## Recovery recipes

### `-28001` monitor limit

Do not retry. Tell the user:

> You've reached your plan's monitor limit. Delete unused monitors (`list-monitors` + `update-monitor-status: PAUSED` doesn't help — paused monitors still count) or upgrade your plan.

### `-28002` subscription limit

Do not retry. Ask whether the user wants to:

1. Loosen the interval (bump `interval` — plan minima vary).
2. Use a different monitor type available on their plan.
3. Upgrade.

Typical trigger: `interval: 30` on Free, or creating types gated by the plan.

### `-29001` invalid parameters

Do not retry. Re-read the error message — it usually names the offending fields. Common causes:

- Using numeric `type` codes instead of string enums.
- Forbidden fields for the monitor type (e.g. `gracePeriod` on HTTP, `url` on HEARTBEAT, `port` on KEYWORD).
- `url` without a scheme on HTTP / KEYWORD / API.
- `url` with a scheme on PING / PORT / UDP / DNS.
- Blacklisted URLs (private IPs, localhost, known-abusive domains).
- `keywordValue` exceeding 500 chars, `friendlyName` exceeding 200, etc.

Fix the payload and resend.

### `-30001` / `-30003` not found

Do not retry. Call `list-monitors` (or `list-integrations`) to discover valid IDs and retry with a correct one. If the user typed the ID, it may belong to a different UptimeRobot account.

### `-31001` / `-31002` auth

Do not retry the call. For `-31001`, ask the user to check `UPTIMEROBOT_API_KEY` and regenerate if needed. For `-31002`, the key is almost certainly read-only — ask for a Main API key from **Integrations & API** in the UptimeRobot dashboard.

### HTTP 429 rate limit

Do retry, but with backoff:

```
sleep(min(60s, 2^attempt + random_jitter))
```

Cap at ~5 attempts; if still throttled, surface the issue to the user. Bulk loops (e.g. pulling stats for hundreds of monitors) are the usual culprit — batch or serialize them.

## Never do

- **Never retry** `-28001`, `-28002`, `-29001`, `-30001`, `-30003`, `-31001`, `-31002` — they are deterministic client errors.
- **Never swallow errors silently.** Users need to know why an automation didn't land.
- **Never echo the API key** in error summaries or logs.

## Related

- `manage-monitors` — for discovering correct IDs after `-30001`.
- `create-*-monitor` — each lists type-specific forbidden fields that trigger `-29001`.
