---
name: sla-report
description: Generate a per-monitor SLA report for a time range — uptime percentage, total downtime, and incident count per monitor — formatted as Markdown for sharing in Confluence, Slack, or post-mortem docs.
tags: [sla, uptime, reporting, metrics, incidents, uptimerobot]
---

# SLA report

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Produces a stakeholder-ready Markdown report of uptime % and incident stats for each monitor over a given time range. Designed for copy-paste into Confluence, Slack, Notion, or a post-mortem doc.

Use this when the user asks "what was our uptime last month?", "generate an SLA report", "how many nines did we hit?", or "monthly monitoring review".

## Step 1 — Clarify scope and range

Before calling any tools, confirm two things if not already clear:

1. **Which monitors?** All monitors, a filter by `name`, `url`, or `tags` (e.g. name contains `"prod"`), or an explicit list?
2. **What time range?** Default to `"30d"`. Accept `"7d"`, `"90d"`, or an ISO 8601 interval like `"2026-04-01T00:00:00Z/2026-05-01T00:00:00Z"`.

If the user says "last month", convert to the ISO interval for the previous calendar month in UTC, and say "UTC" in the report header.

If the range ends in the future (e.g. "this month"), end it at now and say so in the report.

## Step 2 — List monitors in scope

This report costs several calls per monitor and calls are rate-limited, so if the first page shows more than ~20 monitors in scope, ask the user to narrow it (`name`, `url` or `tags`) before going further. `name` and `url` are partial matches (`prod` also matches `nonprod-…`), so show the user the matched names and confirm before Step 3.

```json
{ "name": "prod", "limit": 50 }
```

`list-monitors` has no `search` parameter. Filter with `name` or `url` (case-insensitive partial match) or `tags` (any of these tag names); omit all of them to get every monitor. Paginate until `hasMore: false` by repeating the same call (same filters and `limit`) with `cursor` set to `nextCursor` — don't copy the call embedded in `instructions`, it drops your filters. Collect `id`, `name`, and `status` for every monitor in scope.

If the range ends now, exclude `PAUSED` monitors unless the user wants them (they aren't being checked) and note how many. For a past range, a monitor paused since then still has data — include it and mention it's paused now.

Don't exclude a monitor just because it shows `STARTED` (not checked since it was created or resumed): a recently resumed monitor still has data for the range. A monitor created at or after the range end has none — see below.

A monitor created during the range has no data before it existed. Get `createDateTime` from `get-monitor-details`. If it is after the range start, measure that monitor from its creation time; if it is at or after the range end, the monitor has no data for the range — list it as "no data" and leave it out of every percentage. These extra calls count toward the rate limit, so pace them.

Pause history isn't available over MCP, so time a monitor spent paused during the range can't be excluded and counts as up. Likewise, incidents the user marked "excluded from reports" in the dashboard can't be identified over MCP and are counted, so the figures can be lower than the dashboard's. Say both in the report.

Track any monitors currently in `DOWN` or `LOOKS_DOWN` state — they need a callout in the narrative.

## Step 3 — Per-monitor incidents

For each monitor, fetch the incidents that started in the report range, as an ISO interval — e.g. for April 2026:

```json
{ "monitorId": 800123456, "timeRange": "2026-04-01T00:00:00Z/2026-05-01T00:00:00Z", "limit": 50 }
```

One query can't cover more than 90 days, so split a longer range into consecutive chunks of 90 days or less. Paginate each until `hasMore: false` by repeating your own args with `cursor` set to `nextCursor` — never copy the call in `instructions` (its `timeRange` is an object the tool rejects). Count the incidents yourself; `totalCount` is `null` on every page after the first.

Count only incidents with `type: "Downtime"` — the list also returns `Slow Response` and `Visual Change` incidents.

The range query misses incidents that started **before** the range and overlap it. Two more queries per monitor catch them:

- **Still ongoing:** call `list-incidents` with the same `monitorId` and `status: "open"`, paginating the same way.
- **Resolved:** call `list-incidents` for the 90 days before the range start (e.g. `2026-01-01T00:00:00Z/2026-04-01T00:00:00Z`) with `limit: 100`. Results come newest first; paginate through the whole lookback (until `hasMore` is false) — regional sub-incidents mean a later one can end before the range while its parent overlaps it — and include every `Downtime` incident whose `startedAt` plus `duration` is after the range start. An outage that started more than 90 days before the range and ended inside it can't be fetched; it's rare, so just note it among the report's caveats.

Merge all results by incident `id`, clip each to the report range, and **drop any incident that lies entirely outside the report range** — it ended at or before the range start, or started at or after the range end (the extra queries return such incidents). Keep in-range incidents even if their duration is 0. Count and classify only what remains.

`duration` is human-readable text (`"15m 55s"`, `"1h 2m 3s"`), **not** seconds. To get downtime seconds per incident, either parse its `d` / `h` / `m` / `s` parts, or take `startedAt` from the list item and `endedAt` from `get-incident-details`. Then:

- Clip each incident to the report range — an incident that started before the range counts only from the range start.
- Decide ongoing vs resolved from each incident's `status` field (`"Ongoing"` / `"Resolved"`, on list items and details), not from `endedAt`: list items never carry it, and details also return `endedAt: null` for a resolved incident with zero duration (count that as 0 seconds). Count an ongoing incident as lasting until the range end (or now, if the range ends now).
- `list-incidents` also returns regional sub-incidents, which overlap their parent in time and can't be told apart over MCP. So for each monitor, **merge overlapping clipped intervals first**, then sum the merged intervals for downtime and count them as the monitor's outages. Never add overlapping intervals. Outage counts can therefore differ from the dashboard; say so if the user compares.

## Step 4 — Per-monitor response times (optional)

Only fetch response times if the user explicitly asks for latency data. For a standard stakeholder report, skip this step — response times add technical noise that non-engineering readers don't need.

If requested, call `get-response-times` with the report's own range (not a relative one like `"30d"`). `summary` always covers the whole range; omit `bucketSize` and the server picks one:

```json
{ "monitorId": 800123456, "timeRange": "2026-04-01T00:00:00Z/2026-05-01T00:00:00Z" }
```

Use `summary.avg` and `summary.p95` (milliseconds) from the response. Both are computed over bucket averages, not individual checks — label them "avg of buckets" / "p95 of buckets" if precision matters.

## Step 5 — Compute and render

For each monitor, calculate uptime %:

```
uptime_pct = (range_seconds - downtime_seconds) / range_seconds * 100
```

Where `range_seconds` is the monitor's observed range: the report range (e.g. 30 days = 2,592,000 seconds), starting at its creation time if it was created during the range.

The overall SLA in the headline is computed from the same monitors — never taken from `get-monitor-stats`, which covers the whole account, weighs paused monitors and paused time as up, and ignores your scope:

```
overall_pct = sum(range_seconds - downtime_seconds) / sum(range_seconds) * 100
```

If no monitors are left after the exclusions, don't compute a percentage — report that no in-scope monitor has data for the range.

Split monitors into two groups:
- **Issues**: monitors with at least 1 incident in the range, sorted by uptime % ascending (worst first).
- **Clean**: monitors with zero incidents.

## Output format

Render as Markdown. This ensures the output renders correctly when pasted into Slack, Confluence, Notion, or GitHub.

```markdown
## SLA Report — Apr 1–Apr 30, 2026 (30 days)

42 monitors active. Overall SLA: **99.977%**.
3 monitors had incidents this month; 39 were fully healthy.
2 monitors are paused now (included — they have data for April).

> **⚠ 1 monitor is currently DOWN: prod-cdn — action may be needed.**

### ⚠ Issues (3 monitors)

| Monitor | Uptime | Downtime | Incidents |
|---|---|---|---|
| prod-cdn | 99.118% | 6h 21min | 5 (missed three nines) |
| prod-api | 99.940% | 26min | 2 |
| staging-auth | 99.961% | 17min | 1 |

### ✓ Clean — 39 monitors at 100%

_No incidents. Monitors: prod-worker, prod-db, prod-cache… (and 36 more)_

---
_Report generated 2026-05-01. Data from UptimeRobot. Time a monitor spent paused during the range counts as up; incidents excluded from reports in the dashboard are counted._
```

**Rules for the Issues table:**
- Include only monitors with ≥ 1 incident. Do not list 100% monitors in the table.
- If uptime % is below 99.9%, add a note in the Incidents column: `5 (missed three nines)`.
- If uptime % is below 99.0%, note `5 (missed two nines)` instead.
- If downtime is under 1 minute (including 0) but there were incidents, show `< 1min`.

**Rules for the Clean section:**
- Collapse all zero-incident monitors into a single line with a count + a short sample of names (first 3–4).
- Do **not** produce a table row for every 100% monitor — this adds no information and buries the issues.

**"Still DOWN" callout:**
- If any monitor is currently `DOWN`, add the blockquote warning line ("currently DOWN") before the Issues table. Mention `LOOKS_DOWN` monitors separately as "possibly down (unconfirmed)" — not as confirmed outages. This is the most urgent information for a stakeholder reader.
- Omit the blockquote entirely if all monitors are currently up.

**If all monitors are clean:**

```markdown
## SLA Report — Apr 1–Apr 30, 2026 (30 days)

42 monitors active. Overall SLA: **100.000%**.
No incidents recorded this month.
2 monitors are paused now (included — they have data for April).

### ✓ All monitors healthy

_Monitors: prod-cdn, prod-api, prod-auth… (and 39 more)_

---
_Report generated 2026-05-01. Data from UptimeRobot. Time a monitor spent paused during the range counts as up; incidents excluded from reports in the dashboard are counted._
```

## Handling large monitor counts

If more than ~20 monitors are in scope, ask the user to narrow it with a `name`, `url`, or `tags` filter before looping per-monitor calls. Looping `list-incidents` for 100 monitors will be slow and may hit rate limits.

If a call is rate-limited, handle it as [`errors`](../errors/SKILL.md) says — the per-monitor loops here use many calls, so pace them.

## Common mistakes

- Listing every 100% monitor as a table row — adds noise, buries the incidents that matter.
- Rounding `99.942%` to `99.9%` when the user cares about SLA thresholds — they're different outcomes for a monthly SLA. Keep at least three decimals.
- Forgetting to paginate `list-incidents` per monitor — partial pages silently under-report downtime and inflate uptime %.
- For a range that ends now, including currently `PAUSED` monitors with `100.00%` uptime — they're unmonitored, not healthy. Exclude and note the count.
- Using `get-monitor-stats` for the headline or per-monitor uptime — it is account-wide, can't be scoped, and counts paused time as up.
- Counting `Slow Response` or `Visual Change` incidents as downtime.
- Treating `incidentId` as a number. It's always a numeric string.
- Summing `duration` as if it were seconds. It's text like `"15m 55s"` — parse it or use `startedAt` / `endedAt`.
- Omitting the "still DOWN" callout — a monitor that is currently down is the most important thing in the report.

## Related

- `stats` — simpler alternative for a quick account-wide uptime figure without per-monitor breakdown.
- `incidents` — to drill into specific outages referenced in the report.
- `manage-monitors` — to filter monitors by tag or state before building the report scope.
- `monitor-health-summary` — for a current-state snapshot instead of a historical report.
- `conventions` — time range formats, ISO 8601 intervals, and pagination.
