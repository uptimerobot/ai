---
name: conventions
description: Conventions and gotchas for every UptimeRobot MCP tool call — monitor types, URL formats, HEARTBEAT URL handling, discovery-before-writes, pagination, time ranges, error codes, and output style. Use whenever you call any uptimerobot:* tool.
---

# UptimeRobot conventions

Apply these rules whenever you use any tool from the `uptimerobot` MCP server (`https://mcp.uptimerobot.com/mcp`).

## Monitor types

- Always send `type` as a string enum — one of `HTTP`, `KEYWORD`, `PING`, `PORT`, `HEARTBEAT`, `DNS`, `API`, `UDP`. Do not pass numeric type codes; the MCP layer rejects them.
- `HEARTBEAT` monitors must **not** include a `url` on creation. The server generates `https://heartbeat.uptimerobot.com/m<id>-<hash>` and returns it. Show that URL to the user after creation so they can wire up the heartbeat sender.
- `PING`, `PORT`, `UDP`, `DNS`: `url` is a hostname or IP, never a full URL with scheme.
- `HTTP`, `KEYWORD`, `API`: `url` must be a full URL with scheme (`https://...`).

## Discovery before writes

- Before calling `update-monitor` or `update-monitor-status` on an existing monitor, call `list-monitors` (filter with `name`, `url`, `tags`, `groupId`, or `filter` — there is no `search` parameter) to confirm the ID and current state. After `create-monitor`, use the `id` it returns — no list call needed.
- Before referencing an alert contact in `assignedAlertContacts`, call **both** `list-alert-contacts` (personal email, SMS, voice, push) and `list-integrations` (Slack, webhooks, PagerDuty, Teams, … — it also returns the personal contacts under the same ids), dedupe by `id`, and use an `id` from the responses.

## Verification after writes

- After `create-monitor` or `update-monitor`, call `get-monitor-details` to confirm the stored state before telling the user the change is live. Read-after-write replication can lag a few seconds: if `get-monitor-details` returns `Monitor not found` immediately after a successful create, wait ~3–5s and retry once — never re-run `create-monitor`, which makes a duplicate.
- `monitorId` is an integer. Pass the `id` exactly as returned by `create-monitor` / `list-monitors`; don't quote it, and don't use IDs from dashboard URLs, incidents of other accounts, or the user's memory without checking `list-monitors` first.

## Intervals and plan limits

- Interval is in seconds. The schema accepts 15–86400 (HEARTBEAT up to 2678400 = 31 days); the real minimum depends on the plan. If the server returns `-28002 subscription_limit_exceeded`, do not retry — the plan cannot support that interval or monitor type. Tell the user.
- Do not retry `-28001 monitor_limit_exceeded`. Recommend deleting unused monitors or upgrading the plan.
- Don't assume plan names. Call `get-user` and read `activeSubscription.plan` (e.g. `"Scale"`) — plan names change over time and aren't a fixed list.

## Time ranges

- `timeRange` accepts `"24h"`, `"7d"`, `"30d"` (range 1h–90d), or an ISO 8601 interval `"<start>/<end>"` (start before end, 1h–90d). Default is `"7d"`.
- The 90-day cap is on the range **length** per call. For a longer period, split it into ≤90-day chunks, or tell the user the MCP caps each call at 90 days.

## Pagination

- Paginated tools return `nextCursor` and `hasMore`. While `hasMore` is `true`, repeat your **own** arguments (filters, `limit`, `timeRange`) and set `cursor` to `nextCursor`.
- Don't copy the `instructions` field. On multi-page results it embeds a next-call JSON that is unsafe: for `list-monitors` it drops your filters (widening to every monitor), for `list-integrations` it drops `limit`, and for `list-incidents` it emits an object `timeRange` the tool rejects.
- Don't rely on `totalCount`: it is null on any page fetched with a `cursor`, and always null for several list tools (e.g. `list-alert-contacts`, `list-tags`, `list-monitor-groups`, `list-psps`).
- Cursor types differ by tool:
  - **Integer** — `list-monitors`, `list-integrations`, `list-alert-contacts`, `list-tags`, `list-monitor-groups`, `list-psps`, `list-psp-announcements`, `list-maintenance-windows`, `list-incident-comments`.
  - **Numeric string** (an incident ID) — `list-incidents`.
  - **Opaque string** — `get-incident-activity-log`, `get-incident-alerts`.

## Errors

- `-28001` monitor limit, `-28002` subscription limit, `-29001` invalid params (incl. blacklisted URLs), `-30001` / `-30003` not found, `-31002` access denied (authorized account lacks write permission).
- `-31001 user_not_found` means the OAuth grant is missing/expired/revoked — do not surface it raw; invoke the `uptimerobot:setup` skill to re-authenticate.
- Most errors arrive as plain text with no numeric code, and the wording varies by tool: `Monitor not found` (e.g. `get-monitor-details`) vs `Monitor not found or access denied` (`get-response-times`), `Incident not found` vs `Incident <id> not found`, `Alert contact not found`, `Invalid parameters: [field]: reason`, `Invalid field for DNS monitor: port. ...`. Map them by **substring** (e.g. `not found`, `Invalid parameters`, `Invalid field`), never by exact text — see the table in `errors`. Unauthorized / token-expired messages mean `-31001`.
- HTTP 429 is retryable with exponential backoff + jitter. A transient server or transport error (e.g. a 5xx, or a malformed-result `missing required resultType` glitch) may be retried **once** for a read; for a write, first check whether the change already landed (e.g. `list-monitors` by name) and never blind-retry. Everything else is a client error — surface it to the user.

## Output style

- Do not echo API keys, incident request logs, or redacted contact values unless the user explicitly asks.
- `get-monitor-details` returns `customHttpHeaders` unredacted (may include `Authorization` tokens or API keys), and `list-alert-contacts` / `list-integrations` return email addresses and phone numbers in clear. Never echo header values or contact values back to the user unless asked; mask secrets (e.g. `Bearer ****`).
- When summarising many monitors, group by state (`DOWN` first, then `PAUSED`, then `UP`) and show counts before detail.
- When quoting uptime percentages, always cite the time range.
