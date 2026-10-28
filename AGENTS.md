# AGENTS.md — UptimeRobot

Orientation for coding agents (Claude Code, Cursor, Codex, Aider, etc.) that need to create, inspect, or control UptimeRobot monitors on a user's behalf.

## What UptimeRobot is

UptimeRobot monitors websites, APIs, servers, DNS, and services. It probes each target on an interval (15s–24h, heartbeats up to 31 days; the plan sets the actual minimum), records up/down state plus response times, opens incidents on downtime, and fires alerts (email, SMS, webhooks, Slack, etc.) through **alert contacts**.

Key entities:

- **Monitor** — one probe against one target. Has a `type` (HTTP, KEYWORD, PING, PORT, HEARTBEAT, DNS, API, UDP), a URL/host, an interval, and a status (e.g. `UP`, `DOWN`, `PAUSED`).
- **Incident** — a downtime event (or a slow-response / visual-change event — filter on `type: "Downtime"` for outages). Opens when a monitor goes down, closes when it recovers. `get-incident-details` returns `requestLogs` (per-check request/response data) and the readable `reason`; `get-incident-activity-log` status entries carry the checker's `remoteNode` (IP, city, country).
- **Alert contact** — a notification destination attached to monitors with a threshold and recurrence. Two kinds: **personal alert contacts** (email, Pro SMS, voice, mobile push — `list-alert-contacts`) and **integrations** (Slack, webhook, PagerDuty, etc. — `list-integrations`). Both supply IDs for `assignedAlertContacts`. `list-integrations` also returns the account's personal contacts, so dedupe by `id` and tell personal contacts apart by `type` (email, SMS, voice, push).
- **Tag** — free-form label assigned to monitors.
- **Maintenance window** — scheduled period where alerts for attached monitors are suppressed.

Plans: don't hard-code plan names (live accounts report e.g. `Scale`) — read `activeSubscription.plan` from `get-user`. Availability of specific monitor types and minimum intervals depends on the active plan. The MCP server enforces all limits.

## How to talk to UptimeRobot

Use the remote MCP server:

- URL: `https://mcp.uptimerobot.com/mcp`
- Transport: HTTP (streamable), connected directly — nothing runs locally.
- Auth: **OAuth**. On first connection the client opens a browser to log into UptimeRobot and authorize — no API key to paste. (For headless/CI where a browser can't run, see the manual setup in the [README](README.md#headless--ci-no-browser).)

All tools act on the **session account** chosen at OAuth authorization (personal or a team account; re-authorize to switch), except the personal alert-contact tools, which act on the signed-in person. Read-only sessions get only the read tools. An API-key session always acts on the key owner's own account. Call `get-user` to see which account a session acts on and whether it may write.

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
| `update-psp` | Partially update name, custom domain, sort order, visibility (`noIndex`, `password`), publish status (`status: ENABLED`/`PAUSED`), or monitors (`monitorIds`, `tagIds` and `monitorGroupIds` each replace the whole list — see [How updates treat list and map fields](#how-updates-treat-list-and-map-fields); `get-psp` doesn't return `monitorGroupIds`). |
| `get-psp` | Fetch a single status page by `pspId`. |
| `list-psps` | Cursor-paginated list of status pages. |
| `delete-psp` | Permanently delete a status page (its announcements can't be reached afterwards). |

### PSP announcements (plan-gated: `psp-subscribers`)

| Name | When to use |
| -- | -- |
| `create-psp-announcement` | Post an announcement (`Info`, `Maintenance`, or `Issue`) to a status page. Publish now: `status: Published` and **omit** `startDate` (the server stamps the time). Schedule: future `startDate` and `status: Pending`. |
| `update-psp-announcement` | Partially update title, content, dates, type, or status (`Offline`/`Pending`/`Published`/`Archived`). Publish now: `status: Published` + `startDate` set to the current time (an omitted `startDate` keeps the stored schedule). Reschedule: future `startDate` **and** `status: Pending`. |
| `pin-psp-announcement` | Pin an announcement to the top of a status page. One pin per page — pinning replaces the current one. |
| `unpin-psp-announcement` | Unpin an announcement. |
| `get-psp-announcement` | Fetch a single announcement by `pspId` + `announcementId`. |
| `list-psp-announcements` | Cursor-paginated list of announcements for a status page, optionally filtered by `status`. |
| `delete-psp-announcement` | Permanently delete an announcement. |

### Maintenance windows (plan-gated: `maintenance-window`)

| Name | When to use |
| -- | -- |
| `create-maintenance-window` | Schedule a window (`once`, `daily`, `weekly`, or `monthly`) that suppresses alerts for assigned monitors. Use `days` for weekly (1 = Monday … 7 = Sunday) and monthly recurrence. See [`skills/maintenance-windows/SKILL.md`](skills/maintenance-windows/SKILL.md). |
| `update-maintenance-window` | Partially update schedule, duration, monitors (`monitorIds` replaces the whole list; send `interval` along with `days`), or pause (`status: paused`) / resume (`status: active`) the window. |
| `get-maintenance-window` | Fetch a single window by `maintenanceWindowId`. |
| `list-maintenance-windows` | Cursor-paginated list of windows. |
| `delete-maintenance-window` | Permanently delete a window. |

### Incidents

| Name | When to use |
| -- | -- |
| `list-incidents` | All incidents for the account (or a specific `monitorId`) within a time range. `status: "open"` returns only ongoing incidents, regardless of `timeRange`. Includes slow-response and visual-change incidents — filter on `type: "Downtime"` for outages. `limit` 1–100 (default 10). Cursor-paginated. |
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
| `list-integrations` | Integrations (Slack, webhook, PagerDuty, etc.) on the account — the response also includes the account's personal contacts, so dedupe by `id` and tell personal contacts apart by `type` (email, SMS, voice, push). Their IDs go in `assignedAlertContacts`. `limit` 1–100 (default 10). See [`skills/list-integrations/SKILL.md`](skills/list-integrations/SKILL.md). |
| `delete-integration` | Permanently delete an integration; monitors assigned to it stop notifying through it. Which monitors use it can't be checked over MCP — ask the user to check in the dashboard first, and check its `type` is an integration, not a personal contact (email, SMS, voice, push) — personal contacts also appear in `list-integrations`; delete those with `delete-alert-contact`. |
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
| `HEARTBEAT` | `friendlyName` | `gracePeriod` (seconds, 0–86400). **No `url`** — the server returns a push URL of the form `https://heartbeat.uptimerobot.com/m<id>-<hash>` that the target must call over HTTP(S) (e.g. `curl`). |
| `DNS` | `friendlyName`, `url` (domain) | `port` (server-side default; a monitor created without `port` reads back `port: null`, and `port` can't be changed via `update-monitor` for DNS), `config.dnsRecords` (record type → expected values) |
| `API` | `friendlyName`, `url` (full URL), `config.apiAssertions` (`{logic: AND\|OR, checks: [{property, comparison, target}]}`, 1–5 checks) | `httpMethodType`, `postValueData`, `postValueType` |
| `UDP` | `friendlyName`, `url` (host), `port` | `config.udp` (set it at create with `packetLossThreshold` — see `create-udp-monitor`; optional `payload`), `keywordValue` |

Common optional params on every type: `interval` (15–86400s; `HEARTBEAT` up to 2678400s — the plan sets the real minimum), `assignedAlertContacts` (each item needs `alertContactId`, `threshold` minutes 0–1440, `recurrence` minutes 0–10080), `tagNames`, `groupId` (`0` = no group), `timeout` (1–60s, not HEARTBEAT), `responseTimeThreshold`, `regionData` (`REGION`: `na`/`eu`/`as`/`oc`; optional per-region `THRESHOLD`), `customFields` (max 20 keys), `sslExpirationReminder`, `domainExpirationReminder`, `maintenanceWindowsIds`. HTTP, KEYWORD and API also take `checkSSLErrors`, `followRedirections`, `httpMethodType`, `authType`, `customHttpHeaders`, `successHttpResponseCodes` and `config.applicationErrorRetries` (0–3).

`config.ipVersion` (`ipv4Only` \| `ipv6Only` — not `IPv4`/`IPv6`) is accepted on create and `update-monitor` for HTTP, KEYWORD, PING, PORT, API and UDP — not DNS or HEARTBEAT. `responseTimeThreshold` is 100–60000 ms on create; omit it rather than sending `0`. It reads back as `0` in `get-monitor-details` — the stored thresholds are in `regionData`. 

### How updates treat list and map fields

Updates are partial — fields you omit are kept — but a list or map you send **replaces** the stored value; it is not merged. To add or remove one entry, read the current value, change it, and send it in full:

- **`update-monitor`:**
  - `tagNames` (read `tags`), `customHttpHeaders`, `customFields`: replaced. Read them from `get-monitor-details` (never show header values to the user while doing so).
  - `assignedAlertContacts`: replaced, and it can't be read back — ask the user for the complete list. Without the `advanced-notifications` plan feature, `threshold`/`recurrence` are silently set to 0.
  - `successHttpResponseCodes`: replaced; `[]` resets it to the default `2xx`/`3xx`, and unknown codes are dropped silently.
  - `regionData.REGION`: replaced, and the thresholds of regions you leave out are deleted — omit `REGION` to keep them. `regionData.THRESHOLD` is set per region (others are kept), and is silently ignored without the `monitor-slow-response` feature.
  - `config`: merged **only at the top level** — each key you send (`apiAssertions`, `dnsRecords`, `udp`, `ipVersion`, …) replaces that key's whole value, `null` removes it, keys you omit are kept. So to add one API assertion or one DNS record, send the whole `apiAssertions` / `dnsRecords` object; for UDP, any `config.udp` must include `packetLossThreshold` (read it from `get-monitor-details`, or ask the user if none is stored). Keys a type requires can't be removed: `udp` on UDP and `apiAssertions` on API monitors (nor `config: null` on those types).
- **`update-maintenance-window`:** `monitorIds` and `days` are replaced (read with `get-maintenance-window`). Switching `interval` to weekly or monthly needs `days` and clears `date` unless you resend it; switching to `once` or `daily` clears the old `days` (and `daily` clears `date`). An explicit `monitorIds` turns auto-add off. A window that reads `[0]` has auto-add on: monitors created from now on join it, but which existing monitors it covers can't be read over MCP (one created with `autoAddMonitors: true` over MCP covers none). Don't claim a monitor is covered. With the user's OK, send `autoAddMonitors: false` (without `monitorIds`): auto-add turns off, the current links are kept, and `get-maintenance-window` then lists them. `autoAddMonitors: true` on update only sets the flag — it links no existing monitors.
- **`update-psp`:** `monitorIds`, `tagIds` and `monitorGroupIds` are replaced. `get-psp` returns `monitorIds` and `tagIds` but not `monitorGroupIds` — for groups, ask the user for the complete list and verify with `monitorsCount`. `autoAddMonitors: false` does nothing; to turn auto-add off, send an explicit `monitorIds` list and check that `get-psp` no longer shows `[0]`.
- **`[0]`** in a read-back `monitorIds` means auto-add is on (on a status page: all monitors, except a few dashboard-only types such as dependency monitors; on a maintenance window: see above). IDs must be positive, so `[0, id]` is rejected — send a complete explicit list instead.
- **`pin-psp-announcement`:** a page has one pin; pinning replaces the current one (check `get-psp` `pinnedAnnouncementId` first). Unpin only the ID that is pinned.
- **`update-storm-protection-settings`:** `config` is merged.

Monitor responses use `name`; `friendlyName` is input-only.

## Time-range parameters

Tools that take `timeRange` (`list-incidents`, `get-monitor-stats`, `get-response-times`) accept either:

- Relative: `"24h"`, `"7d"`, `"30d"` (1h–90d).
- Absolute ISO 8601 interval: `"2024-01-01T00:00:00Z/2024-01-31T23:59:59Z"` (start must be before end, range must be 1h–90d).

Default is `7d`.

## Pagination

All `list-*` tools plus `get-incident-activity-log` and `get-incident-alerts` paginate. Paged responses carry `nextCursor` and `hasMore`: while `hasMore` is true, repeat your own arguments and pass `nextCursor` back as `cursor` exactly as returned (its type varies by tool — integer, numeric string, or opaque string). Don't copy the `instructions` field: on multi-page results it embeds a next-call JSON that is unsafe — for `list-monitors` it drops your filters (widening to every monitor), for `list-integrations` it drops `limit`, and for `list-incidents` it emits an object `timeRange` the tool rejects. Don't rely on `totalCount` from `list-*` tools either: it is null on any page fetched with a `cursor`, and always null for several list tools (e.g. `list-alert-contacts`, `list-tags`, `list-monitor-groups`, `list-psps`).

## Authorization model

- The OAuth grant inherits the authorized account's permissions. A read-only key or grant gets only the `readOnlyHint: true` tools (`list-*`, `get-*`); write calls fail with `requires roles` or `Write operations not permitted`.
- In a team account, members with write access can't use the admin-only tools `delete-monitor`, `delete-tag` and `update-storm-protection-settings`. A read-only team member's grant is always read-only, so they can't use any write tool, including the personal alert-contact ones.
- For the headless/CI Bearer-header alternative, a **Main API key** grants read + write, while a **Read-only API key** is limited to reads.

## Error handling

Tool errors usually reach the client as plain text with no numeric code, and the wording varies by tool. What each message means, when to retry (including rate limits — a tool result saying `Rate limit reached`, not HTTP 429), how to verify a write, and how to check whether a failed write landed are all in [`skills/errors/SKILL.md`](skills/errors/SKILL.md), the single source for these rules.

## Conventions for agents

1. **Never guess IDs.** Call `list-monitors` (or `list-alert-contacts` / `list-integrations` for alert contacts) to discover IDs before calling write tools.
2. **Call `get-user` before any `delete-*`.** It names the session account and whether the session may write. Deletes are permanent — confirm the account and target with the user first.
3. **Handle errors and verify writes as [`skills/errors/SKILL.md`](skills/errors/SKILL.md) says.** Never blind-retry a write — a retried create with different target settings makes a second monitor — and never retry plan-limit, not-found or bad-input errors unchanged.
4. **Don't invent monitor types.** Use the 8 string enums above.
5. **Don't send numeric `type` codes.** The MCP layer rejects them even though the underlying DB uses numeric codes.
6. **Prefer `list-monitors` filters (`name`, `url`, `tags`, `groupId`, `filter`) over long traversals.** Accounts can have thousands of monitors.
7. **Cite real uptime, not estimates.** If you need numbers, call `get-monitor-stats` (account-wide only) / `get-response-times` — don't infer. For per-monitor or SLA figures, follow [`skills/sla-report/SKILL.md`](skills/sla-report/SKILL.md).
8. **Don't leak secrets.** `get-monitor-details` returns `customHttpHeaders` and `httpUsername` unredacted (headers may include `Authorization` tokens or API keys), and `list-alert-contacts` / `list-integrations` return email addresses and phone numbers in clear. Never echo usernames or contact values back to the user unless asked. The server returns header values unmasked (`customHttpHeaders` and incident `requestLogs` headers) — always mask them yourself (e.g. `Authorization: Bearer ****`), even when the user asks for full logs. Also mask secret-looking values in request and response bodies, URLs and query strings — except a HEARTBEAT push URL, which the user needs in full.
