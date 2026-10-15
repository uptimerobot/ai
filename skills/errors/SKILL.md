---
name: errors
description: Handle UptimeRobot MCP errors — codes, meanings, retry policy, and user-facing recovery suggestions.
tags: [errors, troubleshooting, rate-limit, uptimerobot]
---

# Errors

The UptimeRobot MCP server may return structured JSON-RPC errors with numeric codes, but most tool errors arrive as **plain text with no code** (for example `Monitor not found or access denied`). Map either form to the recovery recipes below, and give the user a plain explanation rather than echoing raw codes.

## Error codes

| Code | Name | Retryable | Meaning |
| -- | -- | -- | -- |
| `-28001` | `monitor_limit_exceeded` | No | Account has hit its plan's monitor cap. Creation or resuming a paused monitor exceeded it. |
| `-28002` | `subscription_limit_exceeded` | No | Request violates plan limits — most commonly `interval` too aggressive, or a monitor type not available on the plan. |
| `-29001` | `invalid_parameters` | No | Payload failed validation. Includes blacklisted URLs, forbidden fields for a monitor type, wrong enum values, string too long, etc. The error message usually lists the offending fields. |
| `-30001` | `monitor_not_found` | No | Monitor ID doesn't exist or isn't owned by this account. |
| `-30003` | `resource_not_found` | No | A referenced resource (alert contact, maintenance window, tag) doesn't exist. |
| `-31001` | `user_not_found` | No | Authentication failed. The OAuth grant is missing, expired, or revoked. |
| `-31002` | `access_denied` | No | The authorized account doesn't have permission for the requested action (e.g. a write tool with read-only access). |
| `-32603` | `internal` | Maybe | Unexpected server error. One retry with backoff is fine; escalate on repeat. |
| HTTP `429` | rate limit | Yes | Back off with exponential delay + jitter, then retry. |

## Plain-text errors — map by message

When the error has no numeric code, match on the message text (case-insensitive) and treat it as the code in the table above:

| Message contains | Treat as | Example |
| -- | -- | -- |
| `Invalid parameters` | `-29001` | `Invalid parameters: [field]: reason` — names the offending field |
| `Monitor not found` (incl. `or access denied`) | `-30001` | `Monitor not found or access denied` |
| `<something> not found` (alert contact, incident, maintenance window, …) | `-30003` | `Alert contact not found`, `Incident not found` |
| plan, limit, upgrade, or a feature name (`incident-comments`, `maintenance-window`, …) | `-28001` if about the monitor count, else `-28002` | |
| `access denied`, `forbidden`, `read-only` (without "not found") | `-31002` | Call `get-user` first and check `account.accessLevel` — if the session can write, the cause is something else (often a wrong ID). |
| `unauthorized`, `unauthenticated`, `token` (expired / invalid / missing) | `-31001` | Invoke `uptimerobot:setup`. |

If nothing matches, show the message to the user as-is and don't retry.

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

Do not retry the same call. Find a valid ID with the matching discovery tool — `list-monitors` for monitors, `list-alert-contacts` + `list-integrations` for alert contacts, `list-incidents` for incidents — then make a new call with that ID. If the user typed the ID, it may belong to a different UptimeRobot account.

### `-31001` unauthenticated

Do not retry the call. Immediately invoke the `uptimerobot:setup` skill — it re-runs the OAuth flow (clearing the cached grant and reopening the browser) and validates the connection. Do not ask the user to manually check tokens; the setup skill handles that flow.

### `-31002` access denied

Do not retry the call. Call `get-user` and check `account.accessLevel` to confirm the session really is read-only. If it is, the authorized account lacks write permission for this action — invoke the `uptimerobot:setup` skill to re-authenticate with an account that has write access.

### HTTP 429 rate limit

Do retry, but with backoff:

```
sleep(min(60s, 2^attempt + random_jitter))
```

Cap at ~5 attempts; if still throttled, surface the issue to the user. Bulk loops (e.g. pulling stats for hundreds of monitors) are the usual culprit — batch or serialize them.

## Never do

- **Never retry** `-28001`, `-28002`, `-29001`, `-30001`, `-30003`, `-31002` — they are deterministic client errors.
- **`-31001`** is also non-retryable, but instead of surfacing it, invoke `uptimerobot:setup`.
- **Never swallow errors silently.** Users need to know why an automation didn't land.
- **Never echo credentials or tokens** in error summaries or logs.

## Related

- `manage-monitors` — for discovering correct IDs after `-30001`.
- `setup` — re-authenticate after `-31001` or an unauthorized / token-expired message.
- `create-*-monitor` — each lists type-specific forbidden fields that trigger `-29001`.
