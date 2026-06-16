# AGENTS.md — UptimeRobot

Orientation for coding agents (Claude Code, Cursor, Codex, Aider, etc.) that need to create, inspect, or control UptimeRobot monitors on a user's behalf.

## What UptimeRobot is

UptimeRobot monitors websites, APIs, servers, DNS, and services. It probes each target on an interval (minimum 30s on paid plans), records up/down state plus response times, opens incidents on downtime, and fires alerts (email, SMS, webhooks, Slack, etc.) through **alert contacts**.

Key entities:

- **Monitor** — one probe against one target. Has a `type` (HTTP, KEYWORD, PING, PORT, HEARTBEAT, DNS, API, UDP), a URL/host, an interval, and a status (`UP`, `DOWN`, `PAUSED`, `NOT_STARTED`, etc.).
- **Incident** — a downtime event. Opens when a monitor goes down, closes when it recovers. Has logs, checker IPs, traceroute.
- **Alert contact** — a destination (email, Slack, webhook, SMS, Telegram, etc.) attached to monitors with a threshold and recurrence.
- **Tag** — free-form label assigned to monitors.
- **Maintenance window** — scheduled period where alerts for attached monitors are suppressed.

Plans: **Free, Solo, Team, Enterprise**. Availability of specific monitor types and minimum intervals depends on the active plan. The MCP server enforces all limits.

## How to talk to UptimeRobot

Use the remote MCP server:

- URL: `https://mcp.uptimerobot.com/mcp`
- Transport: HTTP (streamable), launched via `mcp-remote` (`npx -y mcp-remote@latest https://mcp.uptimerobot.com/mcp`).
- Auth: **OAuth**. On first connection `mcp-remote` opens a browser to log into UptimeRobot and authorize — no API key to paste. (For headless/CI where a browser can't run, connect over plain HTTP with an `Authorization: Bearer <API_KEY>` header instead.)

All ten tools operate on the authorized account. There is no account impersonation.

First-time setup (Claude Code, Cursor, or any MCP client): see [`skills/setup/SKILL.md`](skills/setup/SKILL.md).

## Tools (all 10)

### Write tools

| Name | When to use |
| -- | -- |
| `create-monitor` | Create a new monitor of any supported type. See [`skills/create-*-monitor`](skills/) for per-type recipes. |
| `update-monitor` | Partially update an existing monitor's name, URL, interval, alert contacts, tags, HTTP settings, etc. Monitor type cannot be changed. See [`skills/update-monitor/SKILL.md`](skills/update-monitor/SKILL.md). |
| `update-monitor-status` | Pause (`PAUSED`) or resume (`STARTED`) a monitor. |

### Read tools

| Name | When to use |
| -- | -- |
| `list-monitors` | Browse monitors with optional search string and state filters (`UP`, `DOWN`, `PAUSED`, `NOT_STARTED`, `EXPIRING_DOMAIN`, `EXPIRING_SSL_CERTIFICATE`, `WITH_API_KEY`, `WITHOUT_API_KEY`). Cursor-paginated. |
| `get-monitor-details` | Full config + current state for one monitor ID. |
| `get-monitor-stats` | Aggregated up/down/paused counts + overall uptime % for a time range. |
| `get-response-times` | Time-series response-time data for one monitor within a time range. Supports `bucketSize` for aggregation. |
| `list-incidents` | All incidents for the account (or a specific `monitorId`) within a time range. Cursor-paginated. |
| `get-incident-details` | Per-incident checker locations, IPs, logs, traceroute. Pass `incidentId` (string). |
| `list-integrations` | Alert-contact integrations configured on the account. Pass the `alertContactId` to `create-monitor` / `update-monitor`. See [`skills/list-integrations/SKILL.md`](skills/list-integrations/SKILL.md). |

## Monitor types and their required params

`create-monitor` accepts `type` as a **string enum** (not a numeric code).

| `type` | Required | Notable optional |
| -- | -- | -- |
| `HTTP` | `friendlyName`, `url` (full URL) | `httpMethodType`, `authType`, `customHttpHeaders`, `successHttpResponseCodes`, `interval`, `timeout` |
| `KEYWORD` | `friendlyName`, `url` (full URL), `keywordValue`, `keywordType` (`ALERT_EXISTS` \| `ALERT_NOT_EXISTS`) | `keywordCaseType` (0=case-sensitive, 1=insensitive) |
| `PING` | `friendlyName`, `url` (hostname or IP, **no scheme**) | `config.ipVersion` |
| `PORT` | `friendlyName`, `url` (host), `port` (1–65535) | `config.ipVersion` |
| `HEARTBEAT` | `friendlyName` | `gracePeriod` (seconds, 0–86400). **No `url`** — the server returns a push URL of the form `https://heartbeat.uptimerobot.com/m<id>-<hash>` that the target must PING. |
| `DNS` | `friendlyName`, `url` (domain) | `port` (defaults 53), `config.dnsRecords` (record type → expected values) |
| `API` | `friendlyName`, `url` (full URL), `config.apiAssertions` (`{logic: AND\|OR, checks: [{property, comparison, target}]}`, 1–5 checks) | `httpMethodType`, `postValueData`, `postValueType` |
| `UDP` | `friendlyName`, `url` (host), `port` | `config.udp.payload`, `config.udp.packetLossThreshold`, `keywordValue` |

Common optional params on every type: `interval` (30–86400s), `assignedAlertContacts`, `tagNames`, `responseTimeThreshold`, `sslExpirationReminder`, `domainExpirationReminder`, `maintenanceWindowsIds`.

## Time-range parameters

Tools that take `timeRange` (`list-incidents`, `get-monitor-stats`, `get-response-times`) accept either:

- Relative: `"24h"`, `"7d"`, `"30d"` (1h–90d).
- Absolute ISO 8601 interval: `"2024-01-01T00:00:00Z/2024-01-31T23:59:59Z"` (start must be before end, range must be 1h–90d).

Default is `7d`.

## Pagination

Write/list tools that return pages (`list-monitors`, `list-incidents`, `list-integrations`) return an `instructions` field containing the exact next-page tool call JSON. Follow it verbatim — cursor shape is opaque.

## Authorization model

- The OAuth grant inherits the authorized account's permissions: an account with write access can call every tool; an account limited to reads gets only the `readOnlyHint: true` tools (`list-*`, `get-*`) and any write call returns `-31002` (`access_denied`).
- For the headless/CI Bearer-header alternative, a **Main API key** grants read + write, while a **Read-only API key** is limited to reads.

## Error handling

Errors come back as JSON-RPC errors with numeric `code`. Map them like this:

| Code | Name | Retryable? | What to do |
| -- | -- | -- | -- |
| `-28001` | `monitor_limit_exceeded` | No | Tell user to upgrade plan or delete monitors. |
| `-28002` | `subscription_limit_exceeded` | No | Interval too aggressive for plan or monitor type blocked by plan. Tell the user. |
| `-29001` | `invalid_parameters` | No | Fix the payload (includes blacklisted URLs and forbidden fields for a type). |
| `-30001` | `monitor_not_found` | No | Monitor doesn't exist or belongs to another account. |
| `-30003` | `resource_not_found` | No | A referenced alert contact / maintenance window doesn't exist. |
| `-31001` | `user_not_found` | No | OAuth grant missing / expired / revoked. Invoke the `setup` skill to re-authenticate. |
| `-31002` | `access_denied` | No | Authorized account lacks write permission for the call. |
| HTTP 429 | rate limit | Yes | Backoff with jitter and retry. |

See [`skills/errors/SKILL.md`](skills/errors/SKILL.md) for recovery recipes.

## Conventions for agents

1. **Never guess IDs.** Call `list-monitors` (or `list-integrations`) to discover IDs before calling write tools.
2. **Always verify after writes.** After `create-monitor` / `update-monitor`, call `get-monitor-details` to show the user the stored state — replication lag can mean an immediate `list-monitors` misses the new monitor.
3. **Surface plan-related errors clearly.** Don't retry `-28001` / `-28002`. Summarise the cap and suggest upgrade or deletion.
4. **Don't invent monitor types.** Only the 8 string enums above are accepted.
5. **Don't send numeric `type` codes.** The MCP layer rejects them even though the underlying DB uses numeric codes.
6. **Prefer `list-monitors` + `search` over long traversals.** Accounts can have thousands of monitors.
7. **Cite real uptime, not estimates.** If you need numbers, call `get-monitor-stats` / `get-response-times` — don't infer.
