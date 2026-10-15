---
name: errors
description: Interpret UptimeRobot MCP errors — map the plain-text messages to their meaning, decide whether to retry, and tell the user how to recover.
tags: [errors, troubleshooting, rate-limit, uptimerobot]
---

# Errors

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this when an UptimeRobot tool call fails and you need to know what it means and what to do next.

**Tools:** any; recovery uses `get-user`, `list-monitors`, `list-alert-contacts`, `list-integrations`, `list-incidents`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

**Tool errors arrive as plain text with no numeric code**, and the wording varies per tool. Match by case-insensitive substring, not exact text and not by code. Then explain the problem to the user in plain words; don't just echo the raw message.

## Message → meaning

| Message contains | Meaning (code) | What to do |
| -- | -- | -- |
| `Invalid parameters: [<field>]: <reason>` | Bad input (`-29001`) | Fix the named field and resend. Don't retry unchanged. |
| `Invalid field for <TYPE> monitor` / `Invalid fields for …` | Field doesn't apply to this monitor type (`-29001`) | Drop the field; the message says which types take it. |
| `is required and must be non-empty` | Missing required value (`-29001`), e.g. `days is required and must be non-empty for "weekly" maintenance windows` | Add the value. |
| `Monitor not found` (also `Monitor not found or access denied`) | Monitor doesn't exist or isn't in this account (`-30001`) | Find the right ID with `list-monitors`. Don't substitute a look-alike without asking. |
| `<thing> not found` — `Alert contact not found`, `Incident not found`, `Incident <id> not found`, `PSP not found`, `Status page not found`, `Maintenance window not found` | Referenced resource doesn't exist (`-30003`) | Look the ID up with the matching `list-*` tool. A user-supplied ID may belong to another account. |
| plan, limit, upgrade, or a plan feature name (`monitor-groups`, `maintenance-window`, `incident-comments`, …) | Plan limit: monitor count (`-28001`) or interval / type / feature (`-28002`) | Don't retry. Explain the limit; suggest a longer interval, another type, deleting monitors, or upgrading. Paused monitors still count toward the monitor limit. |
| `access denied`, `forbidden`, `read-only` (without "not found") | No write access (`-31002`) | Call `get-user` and check `account.accessLevel`. If it can write, the cause is something else (often a wrong ID). If it can't, re-authorize with an account that can write via `uptimerobot:setup`. |
| `unauthorized`, `unauthenticated`, `token` (expired / invalid / missing) | Auth grant missing or expired (`-31001`) | Invoke `uptimerobot:setup`; don't ask the user to handle tokens. |
| HTTP `429` / rate limit | Throttled | The only retryable case — back off (below). |
| anything else | Unknown | Show the message as-is; at most one retry for an obvious server error. |

## Gotchas

- **A success message doesn't prove a change.** `update-monitor` returns `updated successfully` even for fields it ignores (e.g. `authType`). Verify writes with the matching `get-*` tool.
- **Some wrong inputs aren't errors at all.** An unknown parameter such as `search` on `list-monitors` is ignored silently and you get unfiltered results. If a result looks too broad, check your parameter names.
- `get-incident-details` doesn't validate the ID format and just says `Incident not found`; the activity-log and alerts tools reject non-numeric IDs with `incidentId must be a numeric string`.
- `list-maintenance-windows` rejects `cursor: 0` (`Too small: expected number to be >0`) — omit `cursor` on the first page.
- Never retry not-found, invalid-parameter, plan-limit or access errors unchanged — they fail the same way every time.
- Never put credentials, tokens or header values in error summaries.

## Rate limit (429)

```text
wait = min(60s, 2^attempt + random jitter); give up after ~5 attempts and tell the user
```

Bulk loops (stats or details for hundreds of monitors) are the usual cause — slow them down or batch them.

## Related

- [`setup`](../setup/SKILL.md) — re-authenticate after an auth error.
- [`manage-monitors`](../manage-monitors/SKILL.md) — find the right monitor ID.
- [`update-monitor`](../update-monitor/SKILL.md) — type-specific field errors.
