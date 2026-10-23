---
name: conventions
description: Conventions and gotchas for every UptimeRobot MCP tool call — monitor types, URL formats, HEARTBEAT URL handling, discovery-before-writes, pagination, time ranges, errors, rate limits, and output style. Use whenever you call any uptimerobot:* tool.
---

# UptimeRobot conventions

Apply these rules whenever you use any tool from the `uptimerobot` MCP server (`https://mcp.uptimerobot.com/mcp`).

## Monitor types

- Always send `type` as a string enum — one of `HTTP`, `KEYWORD`, `PING`, `PORT`, `HEARTBEAT`, `DNS`, `API`, `UDP`. Do not pass numeric type codes; the MCP layer rejects them.
- `HEARTBEAT` monitors must **not** include a `url` on creation. The server generates `https://heartbeat.uptimerobot.com/m<id>-<hash>` and returns it. Show that URL to the user after creation so they can wire up the heartbeat sender.
- `PING`, `PORT`, `UDP`, `DNS`: `url` is a hostname or IP, never a full URL with scheme.
- `HTTP`, `KEYWORD`, `API`: `url` must be a full URL with scheme (`https://...`).

## Discovery before writes

- Before calling `update-monitor` or `update-monitor-status` on an existing monitor, call `list-monitors` (filter with `name`, `url`, `tags`, `groupId`, or `filter` — there is no `search` parameter) to confirm the ID and current state. `name` and `url` are partial matches: write only when exactly one monitor matches what the user described; if several do, ask which one. After `create-monitor`, use the `id` it returns — no list call needed.
- Before referencing an alert contact in `assignedAlertContacts`, call **both** `list-alert-contacts` (personal email, SMS, voice, push) and `list-integrations` (Slack, webhooks, PagerDuty, Teams, … — it also returns the personal contacts under the same ids), dedupe by `id`, and use an `id` from the responses.

## Verification after writes

- `create-monitor` returns the stored `id`, `name`, `type`, `url` (the push URL for HEARTBEAT), `interval` and `status`. Call `get-monitor-details` afterwards only to confirm other fields you set (tags, timeout, `config`, HTTP settings, …). `update-monitor` returns only a success message, so read the monitor back after it; after `update-monitor-status`, confirm the new `status`. `get-monitor-details` can't show alert contacts, maintenance windows or group — say so instead of claiming they were verified.
- If a create fails, or `Monitor not found` comes back right after one, the write may still have landed (replication lag). Wait a few seconds and check `list-monitors` by `url` (by `name` for HEARTBEAT) before doing anything else; never re-run `create-monitor` blindly — it makes a duplicate.
- `monitorId` is an integer. Pass the `id` exactly as returned by `create-monitor` / `list-monitors`; don't quote it, and don't use IDs from dashboard URLs, incidents of other accounts, or the user's memory without checking `list-monitors` first.

## Intervals and plan limits

- Interval is in seconds: 15–86400 in the schema (`HEARTBEAT` up to 2678400 = 31 days). The plan sets the real minimum. If a write fails with a plan or limit message (e.g. `You can not use this monitor interval`, `limit exceeded`), do not retry — tell the user the plan can't support that interval, monitor type or monitor count, and suggest a longer interval, deleting unused monitors, or upgrading.
- Don't assume plan names. Call `get-user` and read `activeSubscription.plan` (e.g. `"Scale"`) — plan names change over time and aren't a fixed list.

## Time ranges

- `timeRange` accepts `"24h"`, `"7d"`, `"30d"` (range 1h–90d), or an ISO 8601 interval `"<start>/<end>"` (start before end, 1h–90d). Default is `"7d"`.
- The 90-day cap is on the range **length** per call. For a longer period, split it into ≤90-day chunks, or tell the user the MCP caps each call at 90 days.

## Pagination

- Paginated tools return `nextCursor` and `hasMore`. While `hasMore` is `true`, repeat your **own** arguments (filters, `limit`, `timeRange`) and set `cursor` to `nextCursor`.
- Don't copy the `instructions` field. On multi-page results it embeds a next-call JSON that is unsafe: for `list-monitors` it drops your filters (widening to every monitor), for `list-integrations` it drops `limit`, and for `list-incidents` it emits an object `timeRange` the tool rejects.
- Don't rely on `totalCount` from `list-*` tools: it is null on any page fetched with a `cursor`, and always null for several list tools (e.g. `list-alert-contacts`, `list-tags`, `list-monitor-groups`, `list-psps`). Count the items yourself.
- Cursor types differ by tool:
  - **Integer** — `list-monitors`, `list-integrations`, `list-alert-contacts`, `list-tags`, `list-monitor-groups`, `list-psps`, `list-psp-announcements`, `list-maintenance-windows`, `list-incident-comments`.
  - **Numeric string** (an incident ID) — `list-incidents`.
  - **Opaque string** — `get-incident-activity-log`, `get-incident-alerts`.

## Errors

- Tool errors arrive as plain text with no numeric code, worded differently per tool (`Monitor not found` vs `Monitor not found or access denied`, `Incident not found` vs `Incident <id> not found`, `Invalid parameters: [field]: ...`, `Invalid field for DNS monitor: port. ...`). Match by substring, not exact text — see the table in `errors`.
- Check these in order; the first match wins:
  1. **Rate limit** — `Rate limit reached` / `Rate limit exceeded` (a tool result, not HTTP 429). Wait the seconds it states, then retry. Free accounts get 10 calls per minute, shared with the account's REST API traffic, so pace loops and skip calls you don't need.
  2. **Auth** — `unauthorized`, `User not found`, `Invalid API key`, or an invalid / expired token: the OAuth grant is missing, expired or revoked. Don't surface it raw; invoke the `uptimerobot:setup` skill and don't retry the original call until setup succeeds.
  3. **Not found** — `not found` (including `Monitor not found or access denied`): look the ID up again. From `create-monitor` it may have been created anyway — check before creating again (`errors` → "Before retrying a failed write").
  4. **Bad input** — `Invalid parameters`, `Invalid field`, `is required`, `must be`: fix the field.
  5. **No write access** — `requires roles` or `Write operations not permitted`. A bare `Access denied` usually means the ID belongs to another account; check `get-user` to tell which.
  6. **Plan limit** — `plan`, `subscription`, `limit exceeded`, `monitor interval`: don't retry; tell the user.
  7. **Transient** — `Internal server error`, `missing required resultType`: retry a read **once**, after about a minute. For a write, never blind-retry: for an update, read the monitor back by its `id` and compare the changed fields; for a create or any other resource, follow `errors` → "Before retrying a failed write".
  8. Anything else is a client error — surface it to the user.

## Output style

- Do not echo API keys, incident request logs, or redacted contact values unless the user explicitly asks.
- `get-monitor-details` returns `customHttpHeaders` and `httpUsername` unredacted (may include `Authorization` tokens or API keys), and `list-alert-contacts` / `list-integrations` return email addresses and phone numbers in clear. Never echo header values, usernames or contact values back to the user unless asked; mask secrets (e.g. `Bearer ****`).
- When summarising many monitors, group by state (`DOWN` first, then `PAUSED`, then `UP`) and show counts before detail.
- When quoting uptime percentages, always cite the time range.
