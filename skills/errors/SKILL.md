---
name: errors
description: The single source for UptimeRobot MCP errors, retries and write verification — what each plain-text error message means, when to retry (including rate limits), how to verify a write, and how to check whether a failed write landed.
tags: [errors, troubleshooting, rate-limit, uptimerobot]
---

# Errors

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use this whenever an UptimeRobot tool call fails, and after every write. Other skills and docs link here instead of repeating these rules.

**Tools:** any; recovery uses `get-user`, `list-monitors`, `get-monitor-details`, `get-maintenance-window`, the other `get-*` / `list-*` tools, `list-alert-contacts` and `list-integrations`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

**Tool errors usually arrive as plain text with no numeric code** (an `isError` result; the server keeps its internal codes for logging), and the wording varies per tool. Match by case-insensitive substring, not exact text, and **use the first row that matches** — the order matters (`Rate limit exceeded` must match row 1, not the plan-limit row). Then explain the problem to the user in plain words; don't just echo the raw message.

## Message → meaning

| # | Message contains | Meaning | What to do |
| -- | -- | -- | -- |
| 1 | `Rate limit` (`Rate limit reached … Please wait <N> seconds`, `Rate limit exceeded`) | Too many calls. Free accounts get 10 calls per minute; paid plans get more. The limit is shared with the account's REST API traffic (one counter), so scripts, integrations or monitors calling the API with the account's key can use it up. | Wait the stated seconds (or a minute), then retry — a rate-limited call is refused before the tool runs, so this call wrote nothing (if it was a retry of an earlier failed write you haven't checked since it failed, check that one first — see "Before retrying a failed write"). Slow down any loop (see "Rate limit"). |
| 2 | `unauthorized`, `unauthenticated`, `requires authentication`, `Invalid API key`, `invalid_token`, `owner_terminated`, `account_changed`, `membership_removed`, or a token that is invalid / expired / missing | Auth grant missing, expired or revoked | OAuth session: invoke `uptimerobot:setup` (for `owner_terminated` / `account_changed` / `membership_removed`, the team account or membership changed — re-authorize and pick the account again) and don't retry the original call until it succeeds; don't ask the user to handle tokens. A session set up with an API-key header (headless / CI): `uptimerobot:setup` can't fix it — tell the user the key is invalid or revoked and to replace it in the environment variable their MCP config reads. |
| 3 | `not found` — `Monitor not found`, `Monitor not found or access denied`, `Alert contact not found`, `Incident <id> not found`, `Integration not found`, `Status page not found`, …, `not assignable` (`One or more submitted alert contacts are not assignable from your account.`) | The ID doesn't exist or isn't in this account | Look the ID up with the matching `list-*` tool (for alert contacts, check both `list-alert-contacts` and `list-integrations`; `not assignable` is rejected before anything is saved, so nothing was created or changed). Don't substitute a look-alike without asking. If it came from `create-monitor`, the monitor may have been created anyway — see "Before retrying a failed write" instead. |
| 3a | `Duplicate monitor` | Another monitor already has the same type and target settings (for HEARTBEAT, the same name) | Don't retry. On `update-monitor`: another monitor already has this target — tell the user which one (find it with `list-monitors`). On create: this call created nothing (the server checks for duplicates before saving), and resending the same settings is refused again. Wait a few seconds (reads can lag), then find the existing monitor with `list-monitors` and tell the user a matching monitor already exists, with its `id` (if several of that type share the URL — or the name for HEARTBEAT — list them instead; if none shows up, tell the user the server reports a duplicate and ask). Don't guess where it came from. Use its `id` only if the user agrees (then compare its fields with what was asked using `get-monitor-details` and tell the user what differs — see "Verifying writes" for what it can't show). |
| 4 | `Invalid parameters`, `Invalid field` (e.g. `Invalid fields for HTTP monitor: …`), `is required` (e.g. `days is required and must be non-empty …`), `must be` (e.g. `weekly maintenance-window days must be between 1 and 7`), `Missing required` (but not `missing required resultType` — that's row 8), `Invalid values`, `Validation failed`, `blacklisted`, `Provide at least one field`, `Unknown monitor type`, `Unsupported monitor type` | Bad input, e.g. a field the monitor type doesn't take, or `days` missing on a weekly window | Fix the named field and resend. Don't retry unchanged. `URL is blacklisted` on `update-monitor-status` (resume) has no field to fix — don't retry; tell the user the target URL is blocked. |
| 5 | `requires roles`, `Write operations not permitted` | This session can't write (read-only key or grant), or the tool is admin-only for team members (`delete-monitor`, `delete-tag`, `update-storm-protection-settings`) | Call `get-user` to see the session account and access. OAuth session: re-authorize with an account that can write via `uptimerobot:setup`, or ask the account owner. API-key header session (headless / CI): setup can't help — the key is read-only (or the tool is admin-only); tell the user to put a Main API key in the environment variable their MCP config reads. |
| 6 | `Access denied` (including `Access denied to monitor`) | Usually the ID belongs to another account; sometimes no write access | Call `get-user`. If the session can write, re-check the ID with `list-*`; otherwise treat as row 5. |
| 7 | `plan`, `subscription`, `limit exceeded`, `monitor interval` — e.g. `You can not use this monitor interval. Use higher interval.`, `not allowed to use some settings with your current plan`, `requires a plan with the "<feature>" feature enabled`, `not included in your subscription`, `Monitor creation limit exceeded` | Plan limit: interval, monitor count, monitor type, region, or a plan feature | Don't retry. Explain the limit; suggest a longer interval, another type, deleting monitors, or upgrading. Paused monitors still count toward the monitor limit. |
| 8 | `Internal server error`, `Internal error`, `Failed to …`, `missing required resultType`, or another transport error | Server or protocol failure. On some clients `missing required resultType` is a rate-limit result the client couldn't read. | Wait about a minute, then retry a read **once**. For a write, check first (below) — never blind-retry. |
| 9 | anything else | Unknown | Show the message as-is; don't retry. |

## Verifying writes

- **`create-monitor`** returns the stored `id`, `name`, `type`, `url` (the push URL for HEARTBEAT), `interval` and `status`. Call `get-monitor-details` afterwards only to confirm other fields you set (tags, timeout, `config`, HTTP settings, …).
- **`update-monitor`** returns only a success message — even for fields it ignores — so read the monitor back with `get-monitor-details`. After **`update-monitor-status`**, confirm the new `status` (a resumed monitor shows `STARTED` until its first check).
- `get-monitor-details` can't show alert contacts, maintenance windows, group membership or `httpPassword` (the password or Bearer token). Say so instead of claiming they were verified; check groups with `list-monitors` + `groupId` and windows with `get-maintenance-window` (a window that reads `[0]` can't show which existing monitors it covers).
- **Other resources** (status pages, maintenance windows, announcements, alert contacts, …): read them back with the matching `get-*` tool.
- `Monitor not found` from `get-monitor-details` right after a **successful** create is replication lag: you have the `id`, so wait a few seconds and retry once. Never re-run `create-monitor` — the server refuses an identical monitor (`Duplicate monitor already exists.`), but if the target settings differ (URL, method, headers, body, regions, IP version, port, keyword) you get a second one.
- `monitorId` is an integer. Pass the `id` exactly as returned; don't use IDs from dashboard URLs or memory without checking them with `get-monitor-details`.

## Before retrying a failed write

A failed write may still have landed. Check before you resend:

- **Update or status change** — you already have the monitor `id`. Read it with `get-monitor-details` and compare the fields you changed. Resend only if a field it returns shows the old value — never for a field `update-monitor` ignores (below). `responseTimeThreshold` always reads back `0`; check `regionData.THRESHOLD` instead. It can't show alert contacts, maintenance windows or group membership — if the update changed only those, don't resend automatically: check group membership with `list-monitors` + `groupId`, and ask the user before retrying anything else. Maintenance windows aren't changed through `update-monitor` at all — use `update-maintenance-window` and check with `get-maintenance-window`.
- **Create** — you have no `id`. Wait a few seconds (reads can lag), then call `list-monitors` with `url` — or `name` for a HEARTBEAT monitor, which has no URL to search — and `limit: 100`, paginating while `hasMore` is true. `name` and `url` are partial matches. If exactly one monitor that **wasn't in the list you took before creating** matches the intended `name`, `type` and `url` (case-insensitive) (before `create-monitor`, list existing monitors with the same `url` — or `name` for HEARTBEAT — so you can tell old from new; for HEARTBEAT match on `name` and `type` only), the create probably landed — but someone or something else on the account (a team member, or a script or integration using its API key) could have created it in between. Tell the user, give its `id`, and use it only if they agree (then confirm the other fields you set with `get-monitor-details`); if they don't, tell them a create with the same settings may be refused as `Duplicate monitor`, and ask whether to change a target setting, delete that monitor first (with their confirmation), or try anyway. If none or several match — or you didn't take that list before creating — tell the user and ask before creating again. The server refuses an exact duplicate (`Duplicate monitor`), but a create with different target settings (URL, method, headers, body, regions, IP version, port, keyword) would leave a second monitor.
- **Anything else** (status pages, maintenance windows, announcements, alert contacts, …) — read it back with the matching `get-*` tool if you have its ID, or find it with the matching `list-*` tool after a create, before resending.

## Gotchas

- **A success message doesn't prove a change.** `update-monitor` returns `updated successfully` even for fields it ignores (`authType`, `keywordType`, `httpUsername`, `httpPassword`, `postValueData`, `postValueType`, `maintenanceWindowsIds`). Never resend because of those fields — they can't be changed with `update-monitor`.
- **Report every failure**, including single failed calls inside a loop — the user needs to know which items didn't land.
- **Some wrong inputs aren't errors at all.** An unknown parameter such as `search` on `list-monitors` is ignored silently and you get unfiltered results. If a result looks too broad, check your parameter names.
- `get-incident-details` doesn't validate the ID format and just says `Incident not found`; the activity-log and alerts tools reject non-numeric IDs with `incidentId must be a numeric string`.
- `list-maintenance-windows` rejects `cursor: 0` (`Too small: expected number to be >0`) — omit `cursor` on the first page.
- Never retry not-found, invalid-parameter, plan-limit or access errors unchanged — they fail the same way every time.
- Never put credentials, tokens or header values in error summaries.

## Rate limit

Rate limiting comes back as a normal tool result containing `Rate limit reached`, not as HTTP 429. The server refuses the call before the tool runs, so this call wrote nothing — no check is needed before resending it, unless it was a retry of an earlier failed write you haven't checked since it failed (then check that one as "Before retrying a failed write" says). Wait the number of seconds it gives, then retry; give up after ~3 consecutive waits on the same call and tell the user. A loop that keeps making progress should keep pacing, not stop.

Free accounts get 10 calls per minute, shared with any REST API use of the same account, so bulk loops (stats or details for many monitors, creating several monitors) hit it quickly. Pace those loops, and skip calls you don't need — for example, `create-monitor` already returns the stored `id`, `name`, `type`, `url`, `interval` and `status`.

## Related

- [`setup`](../setup/SKILL.md) — re-authenticate after an auth error.
- [`manage-monitors`](../manage-monitors/SKILL.md) — find the right monitor ID.
- [`update-monitor`](../update-monitor/SKILL.md) — type-specific field errors.
