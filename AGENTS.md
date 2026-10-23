# AGENTS.md — UptimeRobot

Orientation for coding agents (Claude Code, Cursor, Codex, Aider, etc.) that need to create, inspect, or control UptimeRobot monitors on a user's behalf.

## What UptimeRobot is

UptimeRobot monitors websites, APIs, servers, DNS, and services. It probes each target on an interval (15s–24h; the plan sets the actual minimum), records up/down state plus response times, opens incidents on downtime, and fires alerts (email, SMS, webhooks, Slack, etc.) through **alert contacts**.

Key entities:

- **Monitor** — one probe against one target. Has a `type` (HTTP, KEYWORD, PING, PORT, HEARTBEAT, DNS, API, UDP), a URL/host, an interval, and a status (e.g. `UP`, `DOWN`, `PAUSED`).
- **Incident** — a downtime event. Opens when a monitor goes down, closes when it recovers. `get-incident-details` returns `requestLogs` (per-check request/response data) and the readable `reason`; `get-incident-activity-log` status entries carry the checker's `remoteNode` (IP, city, country).
- **Alert contact** — a notification destination attached to monitors with a threshold and recurrence. Two kinds: **personal alert contacts** (email, Pro SMS, voice, mobile push — `list-alert-contacts`) and **integrations** (Slack, webhook, PagerDuty, etc. — `list-integrations`). Both supply IDs for `assignedAlertContacts`. `list-integrations` also returns the personal contacts (same ids as `list-alert-contacts`), so dedupe by `id`.
- **Tag** — free-form label assigned to monitors.
- **Maintenance window** — scheduled period where alerts for attached monitors are suppressed.

Plans: don't hard-code plan names (live accounts report e.g. `Scale`) — read `activeSubscription.plan` from `get-user`. Availability of specific monitor types and minimum intervals depends on the active plan. The MCP server enforces all limits.

## How to talk to UptimeRobot

Use the remote MCP server:

- URL: `https://mcp.uptimerobot.com/mcp`
- Transport: HTTP (streamable), connected directly — nothing runs locally.
- Auth: **OAuth**. On first connection the client opens a browser to log into UptimeRobot and authorize — no API key to paste. (For headless/CI where a browser can't run, see the manual setup in the [README](README.md#headless--ci-no-browser).)

All 50 tools act on the **session account** chosen at OAuth authorization (personal or a team account; re-authorize to switch). An API-key session always acts on the key owner's own account. Call `get-user` to see which account a session acts on and whether it may write.

First-time setup (Claude Code, Cursor, or any MCP client): see [`skills/setup/SKILL.md`](skills/setup/SKILL.md).

## No account? Create a monitor with just an email

If the user has no UptimeRobot account or API key, use the [`quick-monitor-setup`](skills/quick-monitor-setup/SKILL.md) skill instead of the MCP tools: it creates a free HTTPS monitor from just the owner's email (an unauthenticated proof-of-work flow; the owner confirms by clicking a link in an activation email). When the user is connected via MCP, use `create-monitor`.

## Tools (all 50)

Grouped by resource. Tools marked **plan-gated** require a specific plan feature (`monitor-groups`, `maintenance-window`, `incident-comments`, `psp-subscribers`, or `notification-grouping`) and fail if the account's plan doesn't include it. Some params are gated by entitlement instead: `customFields` needs `custom-fields`, and `regionData.THRESHOLD` needs `monitor-slow-response`.

All `delete-*` tools are **permanent** — see convention 2 below.

### Monitors

| Name | When to use |
| -- | -- |
| `create-monitor` | Create a new monitor of any supported type. See [`skills/create-*-monitor`](skills/) for per-type recipes. |
| `update-monitor` | Partially update an existing monitor's name, URL, interval, alert contacts, tags, HTTP settings, etc. Monitor type cannot be changed. See [`skills/update-monitor/SKILL.md`](skills/update-monitor/SKILL.md). |
| `update-monitor-status` | Pause (`PAUSED`) or resume (`STARTED`) a monitor. |
| `list-monitors` | Browse monitors. Filters: `name` / `url` (case-insensitive partial match), `tags`, `groupId`, `customField` (`key:value`), and `filter` state enum (`PAUSED`, `STARTED`, `UP`, `LOOKS_DOWN`, `DOWN`, `EXPIRING_DOMAIN`, `EXPIRING_SSL_CERTIFICATE`, `WITH_API_KEY`, `WITHOUT_API_KEY`; values combine as OR). `STARTED` matches only monitors not yet checked since create/resume — for every non-paused monitor use `["UP", "DOWN", "LOOKS_DOWN", "STARTED"]`. `limit` 1–100 (default 10). Cursor-paginated. |
| `get-monitor-details` | Full config + current state for one monitor ID. Has no group field — use `list-monitors` with `groupId` to list a group's members. |
| `delete-monitor` | Permanently delete a monitor and its history. |
| `get-monitor-stats` | Account-wide up/down/paused counts, overall uptime (a 0–1 fraction: the unweighted average across monitors, with paused time counted as up) and total incident time in seconds, for a time range. It can't be scoped to some monitors. |
| `get-response-times` | Time-series response-time data for one monitor within a time range. Supports `bucketSize` for aggregation. |

### Monitor groups

| Name | When to use |
| -- | -- |
| `create-monitor-group` | **Plan-gated** (`monitor-groups`). Create a group. Use `monitorIds` to assign monitors, or `groupIds` to move monitors out of existing groups into the new one. Membership can also be set with `groupId` on `create-monitor` / `update-monitor` (`0` = no group) and read with `list-monitors` `groupId` — see [`skills/manage-monitor-groups/SKILL.md`](skills/manage-monitor-groups/SKILL.md). |
| `update-monitor-group` | **Plan-gated** (`monitor-groups`). Rename an existing group. |
| `delete-monitor-group` | **Plan-gated** (`monitor-groups`). Permanently delete a group. Its monitors move to `monitorsNewGroupId` (optional) or the default group (`0`); no monitor is deleted. |
| `get-monitor-group` | Fetch a single group by `monitorGroupId`. |
| `list-monitor-groups` | Cursor-paginated list of groups. |

### Status pages (PSPs)

| Name | When to use |
| -- | -- |
| `create-psp` | Create a public status page from `monitorIds`, `monitorGroupIds`, or `tagIds`. `status: PAUSED` is ignored — a new page is always `ENABLED` (public). To avoid exposure, create it with no monitors (or a `password`), `update-psp` `status: PAUSED`, then add monitors. Logo/icon uploads aren't supported over MCP — use the dashboard. See [`skills/status-pages/SKILL.md`](skills/status-pages/SKILL.md). |
| `update-psp` | Partially update name, custom domain, sort order, visibility (`noIndex`, `password`), or publish status (`status: ENABLED`/`PAUSED`). |
| `get-psp` | Fetch a single status page by `pspId`. |
| `list-psps` | Cursor-paginated list of status pages. |
| `delete-psp` | Permanently delete a status page and its announcements. |

### PSP announcements (plan-gated: `psp-subscribers`)

| Name | When to use |
| -- | -- |
| `create-psp-announcement` | Post an announcement (`Info`, `Maintenance`, or `Issue`) to a status page. Publish now: `status: Published` and **omit** `startDate` (the server stamps the time). Schedule: future `startDate`, `status` unset (defaults to `Pending`). |
| `update-psp-announcement` | Partially update title, content, dates, type, or status (`Offline`/`Pending`/`Published`/`Archived`). Publish now: `status: Published` + `startDate` set to the current time (an omitted `startDate` keeps the stored schedule). Reschedule: future `startDate` **and** `status: Pending`. |
| `pin-psp-announcement` | Pin an announcement to the top of a status page. |
| `unpin-psp-announcement` | Unpin an announcement. |
| `get-psp-announcement` | Fetch a single announcement by `pspId` + `announcementId`. |
| `list-psp-announcements` | Cursor-paginated list of announcements for a status page, optionally filtered by `status`. |
| `delete-psp-announcement` | Permanently delete an announcement. |

### Maintenance windows (plan-gated: `maintenance-window`)

| Name | When to use |
| -- | -- |
| `create-maintenance-window` | Schedule a window (`once`, `daily`, `weekly`, or `monthly`) that suppresses alerts for assigned monitors. Use `days` for weekly (1 = Monday … 7 = Sunday) and monthly recurrence. See [`skills/maintenance-windows/SKILL.md`](skills/maintenance-windows/SKILL.md). |
| `update-maintenance-window` | Partially update schedule, duration, monitors, or pause (`status: paused`) / resume (`status: active`) the window. |
| `get-maintenance-window` | Fetch a single window by `maintenanceWindowId`. |
| `list-maintenance-windows` | Cursor-paginated list of windows. |
| `delete-maintenance-window` | Permanently delete a window. |

### Incidents

| Name | When to use |
| -- | -- |
| `list-incidents` | All incidents for the account (or a specific `monitorId`) within a time range. `status: "open"` returns only ongoing incidents, regardless of `timeRange`. `limit` 1–100 (default 10). Cursor-paginated. |
| `get-incident-details` | Per-incident `requestLogs` (up to 10, newest first: region, request/response data). `checkerLocations` is always empty and `errorDetails` is a placeholder — use `cause`/`reason`, `requestLogs[].region`, or the activity log's `remoteNode` for checker location/IP. `duration` is null while the incident is ongoing. Pass `incidentId` (string). |
| `get-incident-activity-log` | What happened during an incident: summary (entry counts, contacts involved, latest entry) plus the newest page of entries. `limit` 1–200 (default 50). Cursor-paginated. |
| `get-incident-alerts` | Alerts sent during an incident: summary (counts by delivery status, contacts involved) plus the newest page of sent alerts. `limit` 1–200 (default 50). Cursor-paginated. |

### Incident comments (plan-gated: `incident-comments`)

| Name | When to use |
| -- | -- |
| `create-incident-comment` | Add a plain-text comment to an incident. `incidentId` is a BigInt passed as a numeric string. See [`skills/incident-response/SKILL.md`](skills/incident-response/SKILL.md). |
| `update-incident-comment` | Edit an existing comment's content. |
| `list-incident-comments` | Cursor-paginated list of comments on an incident. |
| `delete-incident-comment` | Permanently delete a comment. |

### Alert contacts (personal)

| Name | When to use |
| -- | -- |
| `create-alert-contact` | Create a personal **email** contact (`value` = address). SMS, voice, and push contacts must be added in the dashboard / mobile app. |
| `update-alert-contact` | Partially update `friendlyName`, `isActive`, `enableNotificationsFor` (`UpAndDown`/`Down`/`Up`/`None`), or `sslExpirationReminder`. |
| `get-alert-contact` | Fetch a single personal contact by `alertContactId`. |
| `list-alert-contacts` | Cursor-paginated list of the signed-in person's contacts (email, Pro SMS, voice, push). `limit` 1–200 (default 50). |
| `delete-alert-contact` | Permanently delete a personal contact; monitors stop notifying through it. |

### Integrations & tags

| Name | When to use |
| -- | -- |
| `list-integrations` | Integrations (Slack, webhook, PagerDuty, etc.) on the account — the response also includes the personal contacts from `list-alert-contacts` (same ids), so dedupe by `id`. Their IDs go in `assignedAlertContacts`. `limit` 1–100 (default 10). See [`skills/list-integrations/SKILL.md`](skills/list-integrations/SKILL.md). |
| `delete-integration` | Permanently delete an integration; monitors assigned to it stop notifying through it. Check what else uses it first, and check the id is not in `list-alert-contacts` — personal contacts also appear in `list-integrations`; delete those with `delete-alert-contact`. |
| `list-tags` | Cursor-paginated list of tags on the account (up to 50 per page). See [`skills/manage-monitor-groups/SKILL.md`](skills/manage-monitor-groups/SKILL.md) for the tags-vs-groups decision. |
| `delete-tag` | Permanently delete a tag; it is removed from every monitor that carried it. |

### Account & storm protection

| Name | When to use |
| -- | -- |
| `get-user` | Names the session account and team, the signed-in person, monitor count/limit, SMS credits, subscription, and whether the session may write. Call before any `delete-*`. |
| `get-storm-protection-settings` | Read account-wide storm protection (alert grouping): enabled, threshold type/value, window, pooling. |
| `update-storm-protection-settings` | **Plan-gated** (`notification-grouping`). Partially update `isEnabled`, `thresholdType` (`count` ≥ 2 \| `percentage` ≤ 100), `thresholdValue`, `windowMinutes` (1–15), `config.groupPooling`. |

## Monitor types and their required params

`create-monitor` accepts `type` as a **string enum** (not a numeric code).

| `type` | Required | Notable optional |
| -- | -- | -- |
| `HTTP` | `friendlyName`, `url` (full URL) | `httpMethodType`, `authType`, `customHttpHeaders`, `successHttpResponseCodes`, `interval`, `timeout` |
| `KEYWORD` | `friendlyName`, `url` (full URL), `keywordValue`, `keywordType` (`ALERT_EXISTS` \| `ALERT_NOT_EXISTS`) | `keywordCaseType` (0=case-sensitive, 1=insensitive) |
| `PING` | `friendlyName`, `url` (hostname or IP, **no scheme**) | — |
| `PORT` | `friendlyName`, `url` (host), `port` (1–65535) | `portAlertCondition` (`CLOSED` \| `OPEN`) |
| `HEARTBEAT` | `friendlyName` | `gracePeriod` (seconds, 0–86400). **No `url`** — the server returns a push URL of the form `https://heartbeat.uptimerobot.com/m<id>-<hash>` that the target must PING. |
| `DNS` | `friendlyName`, `url` (domain) | `port` (server-side default; a monitor created without `port` reads back `port: null`, and `port` can't be changed via `update-monitor` for DNS), `config.dnsRecords` (record type → expected values) |
| `API` | `friendlyName`, `url` (full URL), `config.apiAssertions` (`{logic: AND\|OR, checks: [{property, comparison, target}]}`, 1–5 checks) | `httpMethodType`, `postValueData`, `postValueType` |
| `UDP` | `friendlyName`, `url` (host), `port` | `config.udp` (`packetLossThreshold` **required** when `config.udp` is sent, optional `payload`), `keywordValue` |

Common optional params on every type: `interval` (15–86400s; `HEARTBEAT` up to 2678400s — the plan sets the real minimum), `assignedAlertContacts` (each item needs `alertContactId`, `threshold` minutes 0–1440, `recurrence` minutes 0–10080), `tagNames`, `groupId` (`0` = no group), `timeout` (1–60s, not HEARTBEAT), `responseTimeThreshold`, `regionData` (`REGION`: `na`/`eu`/`as`/`oc`; optional per-region `THRESHOLD`), `customFields` (max 20 keys), `sslExpirationReminder`, `domainExpirationReminder`, `maintenanceWindowsIds`. HTTP, KEYWORD and API also take `checkSSLErrors`, `followRedirections`, `httpMethodType`, `authType`, `customHttpHeaders`, `successHttpResponseCodes` and `config.applicationErrorRetries` (0–3).

`config.ipVersion` (`ipv4Only` \| `ipv6Only` — not `IPv4`/`IPv6`) is accepted on create and `update-monitor` for HTTP, KEYWORD, PING, PORT, API and UDP — not DNS or HEARTBEAT. `responseTimeThreshold` is 100–60000 ms on create; omit it rather than sending `0`. It reads back as `0` in `get-monitor-details` — the stored thresholds are in `regionData`. On `update-monitor`, `customFields` **replaces** the whole map — read it from `get-monitor-details` and send it in full to change one key.

Monitor responses use `name`; `friendlyName` is input-only.

## Time-range parameters

Tools that take `timeRange` (`list-incidents`, `get-monitor-stats`, `get-response-times`) accept either:

- Relative: `"24h"`, `"7d"`, `"30d"` (1h–90d).
- Absolute ISO 8601 interval: `"2024-01-01T00:00:00Z/2024-01-31T23:59:59Z"` (start must be before end, range must be 1h–90d).

Default is `7d`.

## Pagination

All `list-*` tools plus `get-incident-activity-log` and `get-incident-alerts` paginate. Paged responses carry `nextCursor` and `hasMore`: while `hasMore` is true, repeat your own arguments and pass `nextCursor` back as `cursor` exactly as returned (its type varies by tool — integer, numeric string, or opaque string). Don't copy the `instructions` field: on multi-page results it embeds a next-call JSON that is unsafe — for `list-monitors` it drops your filters (widening to every monitor), for `list-integrations` it drops `limit`, and for `list-incidents` it emits an object `timeRange` the tool rejects. Don't rely on `totalCount` from `list-*` tools either: it is null on any page fetched with a `cursor`, and always null for several list tools (e.g. `list-alert-contacts`, `list-tags`, `list-monitor-groups`, `list-psps`).

## Authorization model

- The OAuth grant inherits the authorized account's permissions. A read-only key or grant gets only the `readOnlyHint: true` tools (`list-*`, `get-*`); a write call fails with `requires roles` or `Write operations not permitted`.
- In a team account, members with write access can't use the admin-only tools `delete-monitor`, `delete-tag` and `update-storm-protection-settings`. A read-only team member still gets the personal alert-contact tools (`create-` / `update-` / `delete-alert-contact`).
- For the headless/CI Bearer-header alternative, a **Main API key** grants read + write, while a **Read-only API key** is limited to reads.

## Error handling

Tool errors reach the client as plain text with no numeric code, and the wording varies by tool: `Monitor not found` (`get-monitor-details`) vs `Monitor not found or access denied` (`get-response-times`), `Incident not found` (`get-incident-details`) vs `Incident <id> not found` (activity log / alerts), `Invalid parameters: [field]: ...`, `Invalid field for DNS monitor: port. ...`. Match by **substring**, not exact text, and take the **first row that matches**:

| Message contains | Meaning | Retry? | What to do |
| -- | -- | -- | -- |
| `Rate limit` | Too many calls (free accounts: 10 per minute, shared with the account's REST API traffic) | Yes | Wait the seconds the message gives, then retry. It is a tool result, not HTTP 429. |
| `unauthorized`, `User not found`, `Invalid API key`, invalid / expired token | OAuth grant missing, expired or revoked | No | Invoke the `setup` skill to re-authenticate. |
| `not found` | The ID doesn't exist or belongs to another account | No | Look the ID up with the matching `list-*` tool. From `create-monitor`, the monitor may exist anyway — check `list-monitors` before creating again. |
| `Invalid parameters`, `Invalid field`, `is required`, `must be` | Bad input | No | Fix the payload (includes blacklisted URLs and fields a type doesn't take). |
| `requires roles`, `Write operations not permitted` | The session can't write, or the tool is admin-only | No | Check `get-user`; re-authorize with an account that can write. |
| `Access denied` | Usually an ID from another account | No | Check `get-user`; if the session can write, re-check the ID. |
| `plan`, `subscription`, `limit exceeded`, `monitor interval` | Interval, monitor count, monitor type, region or plan feature not allowed | No | Tell the user; suggest a longer interval, deleting monitors, or upgrading. |
| `Internal server error`, `missing required resultType` | Server or protocol failure | Once, for reads | For writes, check whether the change landed before resending. |

See [`skills/errors/SKILL.md`](skills/errors/SKILL.md) for recovery recipes.

## Conventions for agents

1. **Never guess IDs.** Call `list-monitors` (or `list-alert-contacts` / `list-integrations` for alert contacts) to discover IDs before calling write tools.
2. **Call `get-user` before any `delete-*`.** It names the session account and whether the session may write. Deletes are permanent — confirm the account and target with the user first.
3. **Verify after writes.** `create-monitor` already returns the stored `id`, `name`, `type`, `url`, `interval` and `status`; call `get-monitor-details` (integer `monitorId`) only to confirm other fields you set. Always read back after `update-monitor`, which returns only a success message. If a create fails or seems to, wait a few seconds and check `list-monitors` by `url` (by `name` for HEARTBEAT) before anything else — never re-create blindly.
4. **Surface plan-related errors clearly.** Don't retry plan or limit errors. Summarise the cap and suggest upgrade or deletion.
5. **Don't invent monitor types.** Use the 8 string enums above.
6. **Don't send numeric `type` codes.** The MCP layer rejects them even though the underlying DB uses numeric codes.
7. **Prefer `list-monitors` filters (`name`, `url`, `tags`, `groupId`, `filter`) over long traversals.** Accounts can have thousands of monitors.
8. **Cite real uptime, not estimates.** If you need numbers, call `get-monitor-stats` / `get-response-times` — don't infer.
9. **Match errors by substring.** Error texts are plain messages whose wording varies by tool — match on `Rate limit` / `not found` / `Invalid parameters` / `Invalid field`, in the order of the table above, never on an exact string.
10. **Don't leak secrets.** `get-monitor-details` returns `customHttpHeaders` and `httpUsername` unredacted (headers may include `Authorization` tokens or API keys), and `list-alert-contacts` / `list-integrations` return email addresses and phone numbers in clear. Never echo header values, usernames or contact values back to the user unless asked; mask secrets.
