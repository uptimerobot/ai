---
name: conventions
description: Conventions and gotchas for every UptimeRobot MCP tool call — monitor types, URL formats, HEARTBEAT URL handling, discovery-before-writes, pagination, time ranges, and output style (errors and retries live in the errors skill). Use whenever you call any UptimeRobot MCP tool.
---

# UptimeRobot conventions

Apply these rules whenever you use any tool from the `uptimerobot` MCP server (`https://mcp.uptimerobot.com/mcp`).

## Monitor types

- Always send `type` as a string enum — one of `HTTP`, `KEYWORD`, `PING`, `PORT`, `HEARTBEAT`, `DNS`, `API`, `UDP`. Do not pass numeric type codes; the MCP layer rejects them.
- `HEARTBEAT` monitors must **not** include a `url` on creation. The server generates `https://heartbeat.uptimerobot.com/m<id>-<hash>` and returns it. Show that URL to the user after creation so they can wire up the heartbeat sender.
- `PING`, `PORT`, `UDP`, `DNS`: `url` is a hostname or IP, never a full URL with scheme.
- `HTTP`, `KEYWORD`, `API`: `url` must be a full URL with scheme (`https://...`).

## Discovery before writes

- Before calling `update-monitor` or `update-monitor-status` on an existing monitor, call `list-monitors` (filter with `name`, `url`, `tags`, `groupId`, or `filter` — there is no `search` parameter) to confirm the ID and current state. `name` and `url` are partial matches: for a single-monitor request, write only when exactly one monitor matches what the user described; if several do, ask which one. For batches, follow [`bulk-pause`](../bulk-pause/SKILL.md) and confirm the list with the user. Before `create-monitor`, check `list-monitors` (with `limit: 100`, paginating while `hasMore` is true) for an existing monitor with the same `url` (or `name` for HEARTBEAT) — if one with the same type and target exists, show it to the user and ask before creating (the server refuses an exact-target duplicate). The list also lets you tell a new monitor from an old one if the create fails. After a successful create, use the `id` it returns.
- Before referencing an alert contact in `assignedAlertContacts`, call **both** `list-alert-contacts` (personal email, SMS, voice, push) and `list-integrations` (Slack, webhooks, PagerDuty, Teams, …), dedupe by `id`, and use an `id` from the responses. `list-integrations` also returns the account's personal contacts; tell them apart by `type`.
- Before any `delete-*` call, call `get-user` to confirm the session account and write permission. Deletes are permanent — confirm the target with the user.

## Errors, retries and verifying writes

Follow the [`errors`](../errors/SKILL.md) skill — the single source for what each error message means, when to retry (including rate limits), how to verify a write, and how to check whether a failed write landed. Never blind-retry a write: the server refuses an exact duplicate monitor, but a retried create with different target settings (URL, method, headers, body, regions, IP version, port, keyword) makes a second one.

## Intervals and plan limits

- Interval is in seconds: 15–86400 in the schema (`HEARTBEAT` up to 2678400 = 31 days). The plan sets the real minimum. Plan-limit errors are covered in `errors` — don't retry them.
- Don't assume plan names. Call `get-user` and read `activeSubscription.plan` (e.g. `"Scale"`) — plan names change over time and aren't a fixed list.

## Time ranges

- `timeRange` accepts `"24h"`, `"7d"`, `"30d"` (range 1h–90d), or an ISO 8601 interval `"<start>/<end>"` (start before end, 1h–90d). Default is `"7d"`.
- The 90-day cap is on the range **length** per call. The range can start any time in the past; for a longer period, split it into ≤90-day chunks.

## Pagination

- Paginated tools return `nextCursor` and `hasMore`. While `hasMore` is `true`, repeat your **own** arguments (filters, `limit`, `timeRange`) and set `cursor` to `nextCursor`.
- Don't copy the `instructions` field. On multi-page results it embeds a next-call JSON that is unsafe: for `list-monitors` it drops your filters (widening to every monitor), for `list-integrations` it drops `limit`, and for `list-incidents` it emits an object `timeRange` the tool rejects.
- Don't rely on `totalCount` from `list-*` tools: it is null on any page fetched with a `cursor`, and always null for several list tools (e.g. `list-alert-contacts`, `list-tags`, `list-monitor-groups`, `list-psps`). Count the items yourself.
- Cursor types differ by tool:
  - **Integer** — `list-monitors`, `list-integrations`, `list-alert-contacts`, `list-tags`, `list-monitor-groups`, `list-psps`, `list-psp-announcements`, `list-maintenance-windows`, `list-incident-comments`.
  - **Numeric string** (an incident ID) — `list-incidents`.
  - **Opaque string** — `get-incident-activity-log`, `get-incident-alerts`.
- `list-incidents` restarts from the first page if the cursor incident disappears (e.g. it resolved between pages, or a relative `timeRange` moved). Dedupe by `id` and keep paging until `hasMore` is false, and prefer an absolute ISO `timeRange` when paging.

## Output style

- Never echo API keys or tokens. The server returns header values unmasked (`customHttpHeaders`, incident `requestLogs[]` headers) — always mask them yourself (e.g. `Authorization: Bearer ****`), even when the user asks for full logs or details. Also mask secret-looking values in request and response bodies, URLs and query strings (tokens, keys, passwords) — except a HEARTBEAT push URL, which the user needs in full to wire up their job; the rest of a log can be shown on request.
- `get-monitor-details` returns `customHttpHeaders` and `httpUsername` unredacted (may include `Authorization` tokens or API keys), and `list-alert-contacts` / `list-integrations` return email addresses and phone numbers in clear. Never echo usernames or contact values back to the user unless asked, and never echo header values at all.
- When summarising many monitors, group by state (`DOWN` first, then `PAUSED`, then `UP`) and show counts before detail.
- When quoting uptime percentages, always cite the time range.
