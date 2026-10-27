---
name: errors
description: Interpret UptimeRobot MCP errors — map the plain-text messages to their meaning, decide whether to retry, and tell the user how to recover.
tags: [errors, troubleshooting, rate-limit, uptimerobot]
---

# Errors

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this when an UptimeRobot tool call fails and you need to know what it means and what to do next.

**Tools:** any; recovery uses `get-user`, `list-monitors`, `list-alert-contacts`, `list-integrations`, `list-incidents`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

**Tool errors usually arrive as plain text with no numeric code** (an `isError` result; the server keeps its internal codes for logging), and the wording varies per tool. Match by case-insensitive substring, not exact text, and **use the first row that matches** — the order matters (`User not found` is an auth error, not a lookup miss). Then explain the problem to the user in plain words; don't just echo the raw message.

## Message → meaning

| # | Message contains | Meaning | What to do |
| -- | -- | -- | -- |
| 1 | `Rate limit` (`Rate limit reached … Please wait <N> seconds`, `Rate limit exceeded`) | Too many calls. Free accounts get 10 calls per minute; paid plans get more. The limit is shared with the account's REST API traffic (one counter), so scripts, integrations or monitors calling the API with the account's key can use it up. | Wait the stated seconds (or a minute), then retry. Slow down any loop (see below). |
| 2 | `unauthorized`, `unauthenticated`, `requires authentication`, `User not found`, `Invalid API key`, or a token that is invalid / expired / missing | Auth grant missing, expired or revoked | OAuth session: invoke `uptimerobot:setup`; don't ask the user to handle tokens. A session set up with an API-key header (headless / CI): `uptimerobot:setup` can't fix it — tell the user the configured key is invalid or revoked and to update the `Authorization` header in their MCP config. |
| 3 | `not found` — `Monitor not found`, `Monitor not found or access denied`, `Alert contact not found`, `Incident <id> not found`, `Integration not found`, `Status page not found`, … | The ID doesn't exist or isn't in this account | Look the ID up with the matching `list-*` tool. Don't substitute a look-alike without asking. If it came from `create-monitor`, the monitor may have been created anyway — see "Before retrying a failed write" instead. |
| 4 | `Invalid parameters`, `Invalid field` (e.g. `Invalid fields for HTTP monitor: …`), `is required` (e.g. `days is required and must be non-empty …`), `must be` (e.g. `weekly maintenance-window days must be between 1 and 7`), `Missing required`, `Invalid values`, `Validation failed`, `blacklisted` | Bad input, e.g. a field the monitor type doesn't take, or `days` missing on a weekly window | Fix the named field and resend. Don't retry unchanged. |
| 5 | `requires roles`, `Write operations not permitted` | This session can't write (read-only key or grant), or the tool is admin-only for team members (`delete-monitor`, `delete-tag`, `update-storm-protection-settings`) | Call `get-user` to see the session account and access. Re-authorize with an account that can write via `uptimerobot:setup`, or ask the account owner. |
| 6 | `Access denied` (on its own) | Usually the ID belongs to another account; sometimes no write access | Call `get-user`. If the session can write, re-check the ID with `list-*`; otherwise treat as row 5. |
| 7 | `plan`, `subscription`, `limit exceeded`, `monitor interval` — e.g. `You can not use this monitor interval. Use higher interval.`, `not allowed to use some settings with your current plan`, `requires a plan with the "<feature>" feature enabled`, `not included in your subscription`, `Monitor creation limit exceeded` | Plan limit: interval, monitor count, monitor type, region, or a plan feature | Don't retry. Explain the limit; suggest a longer interval, another type, deleting monitors, or upgrading. Paused monitors still count toward the monitor limit. |
| 8 | `Internal server error`, `Internal error`, `Failed to …`, `missing required resultType`, or another transport error | Server or protocol failure. On some clients `missing required resultType` is a rate-limit result the client couldn't read. | Wait about a minute, then retry a read **once**. For a write, check first (below) — never blind-retry. |
| 9 | anything else | Unknown | Show the message as-is; don't retry. |

## Before retrying a failed write

A failed write may still have landed. Check before you resend:

- **Update or status change** — you already have the monitor `id`. Read it with `get-monitor-details` and compare the fields you changed. Resend only if a field it returns shows the old value. It can't show alert contacts, maintenance windows or group membership — if the update changed only those, don't resend automatically: check group membership with `list-monitors` + `groupId`, and ask the user before retrying anything else.
- **Create** — you have no `id`. Wait a few seconds (reads can lag), then call `list-monitors` with `url` — or `name` for a HEARTBEAT monitor, which has no URL to search. `name` and `url` are partial matches. If exactly one monitor matches the intended `name`, `type` and `url` **and it wasn't there before you tried** (check before creating, or compare `createDateTime` from `get-monitor-details`), the create landed: use that `id`. If none or several match, tell the user and ask before creating again — a second create can leave a duplicate.
- **Anything else** (status pages, maintenance windows, announcements, alert contacts, …) — read it back with the matching `get-*` tool if you have its ID, or find it with the matching `list-*` tool after a create, before resending.

## Gotchas

- **A success message doesn't prove a change.** `update-monitor` returns `updated successfully` even for fields it ignores (`authType`, `keywordType`). Verify writes with the matching `get-*` tool.
- **Some wrong inputs aren't errors at all.** An unknown parameter such as `search` on `list-monitors` is ignored silently and you get unfiltered results. If a result looks too broad, check your parameter names.
- `get-incident-details` doesn't validate the ID format and just says `Incident not found`; the activity-log and alerts tools reject non-numeric IDs with `incidentId must be a numeric string`.
- `list-maintenance-windows` rejects `cursor: 0` (`Too small: expected number to be >0`) — omit `cursor` on the first page.
- Never retry not-found, invalid-parameter, plan-limit or access errors unchanged — they fail the same way every time.
- Never put credentials, tokens or header values in error summaries.

## Rate limit

Rate limiting comes back as a normal tool result containing `Rate limit reached`, not as HTTP 429. Wait the number of seconds it gives, then retry; give up after ~3 waits and tell the user.

Free accounts get 10 calls per minute, shared with any REST API use of the same account, so bulk loops (stats or details for many monitors, creating several monitors) hit it quickly. Pace those loops, and skip calls you don't need — for example, `create-monitor` already returns the stored `id`, `name`, `type`, `url`, `interval` and `status`.

## Related

- [`setup`](../setup/SKILL.md) — re-authenticate after an auth error.
- [`manage-monitors`](../manage-monitors/SKILL.md) — find the right monitor ID.
- [`update-monitor`](../update-monitor/SKILL.md) — type-specific field errors.
