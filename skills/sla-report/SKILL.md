---
name: sla-report
description: Generate a per-monitor SLA report for a time range — uptime percentage, total downtime, and incident count per monitor — formatted as Markdown for sharing in Confluence, Slack, or post-mortem docs.
tags: [sla, uptime, reporting, metrics, incidents, uptimerobot]
---

# SLA report

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Produces a stakeholder-ready Markdown report of uptime % and incident stats for each monitor over a given time range. Designed for copy-paste into Confluence, Slack, Notion, or a post-mortem doc.

Use this when the user asks "what was our uptime last month?", "generate an SLA report", "how many nines did we hit?", or "monthly monitoring review".

## Step 1 — Clarify scope and range

Before calling any tools, confirm two things if not already clear:

1. **Which monitors?** All monitors, a filter by `name`, `url`, or `tags` (e.g. name contains `"prod"`), or an explicit list?
2. **What time range?** Default to `"30d"`. Accept `"7d"`, `"90d"`, or an ISO 8601 interval like `"2026-04-01T00:00:00Z/2026-04-30T23:59:59Z"`.

If the user says "last month", convert to the ISO interval for the previous calendar month.

## Step 2 — List monitors in scope

```json
{ "name": "prod", "limit": 50 }
```

`list-monitors` has no `search` parameter. Filter with `name` or `url` (case-insensitive partial match) or `tags` (any of these tag names); omit all of them to get every monitor. Paginate until `hasMore: false` by repeating the same call (same filters and `limit`) with `cursor` set to `nextCursor` — don't copy the call embedded in `instructions`, it drops your filters. Collect `id`, `name`, and `status` for every monitor in scope.

Exclude `PAUSED` monitors from the report unless the user explicitly wants them — they have no meaningful uptime data for the range. Note how many were excluded.

Also exclude monitors still in `STARTED` (created or resumed but not yet checked) — they have no observations, so don't report them as clean or at 100%. List them as "no data yet".

Track any monitors currently in `DOWN` or `LOOKS_DOWN` state — they need a callout in the narrative.

## Step 3 — Per-monitor incidents

For each monitor, fetch incidents for the range as an ISO interval, starting a day early (see below) — e.g. for April 2026:

```json
{ "monitorId": 800123456, "timeRange": "2026-03-31T00:00:00Z/2026-04-30T23:59:59Z", "limit": 50 }
```

Paginate until `hasMore: false` by repeating your own args with `cursor` set to `nextCursor` — never copy the call in `instructions` (its `timeRange` is an object the tool rejects). Count the incidents yourself; `totalCount` is `null` on every page after the first.

Count only incidents with `type: "Downtime"` — the list also returns `Slow Response` and `Visual Change` incidents.

The range query returns incidents that **started** in the range, so it misses any that started earlier and overlapped it:

- **Still ongoing:** also call `list-incidents` with the same `monitorId` and `status: "open"`, paginating the same way.
- **Already resolved:** that's why the query starts a day early; clip to the report range afterwards. The query can't exceed 90 days, so for a range longer than 89 days start it as early as the cap allows. Incidents that started before the query are missed — say so in the report.

Merge all results by incident `id`, clip each to the report range, and **drop any incident whose clipped overlap is 0 seconds** (the extra queries also return incidents from the day before the range, and open incidents that started after it). Count and classify only what remains.

`duration` is human-readable text (`"15m 55s"`, `"1h 2m 3s"`), **not** seconds. To get downtime seconds per incident, either parse its `d` / `h` / `m` / `s` parts, or take `startedAt` from the list item and `endedAt` from `get-incident-details`. Then:

- Clip each incident to the report range — an incident that started before the range counts only from the range start.
- Treat an ongoing incident (no `endedAt`, or returned by `list-incidents` with `status: "open"`) as lasting until the range end (or now, if the range ends now).
- Sum the clipped seconds to get the monitor's total downtime.

## Step 4 — Per-monitor response times (optional)

Only fetch response times if the user explicitly asks for latency data. For a standard stakeholder report, skip this step — response times add technical noise that non-engineering readers don't need.

If requested, call `get-response-times`. `summary` always covers the whole range; omit `bucketSize` and the server picks one:

```json
{ "monitorId": 800123456, "timeRange": "30d" }
```

Use `summary.avg` and `summary.p95` (milliseconds) from the response. `p95` is over bucket averages, so label it "p95 of averages" if precision matters.

## Step 5 — Compute and render

For each monitor, calculate uptime %:

```
uptime_pct = (range_seconds - downtime_seconds) / range_seconds * 100
```

Where `range_seconds` is derived from the time range (e.g. 30 days = 2,592,000 seconds).

The overall SLA in the headline is computed from the same monitors — never taken from `get-monitor-stats`, which covers the whole account, weighs paused monitors and paused time as up, and ignores your scope:

```
overall_pct = sum(range_seconds - downtime_seconds) / (monitor_count * range_seconds) * 100
```

Split monitors into two groups:
- **Issues**: monitors with at least 1 incident in the range, sorted by uptime % ascending (worst first).
- **Clean**: monitors with zero incidents.

## Output format

Render as Markdown. This ensures the output renders correctly when pasted into Slack, Confluence, Notion, or GitHub.

```markdown
## SLA Report — Apr 1–Apr 30, 2026 (30 days)

42 monitors active. Overall SLA: **99.977%**.
3 monitors had incidents this month; 39 were fully healthy.
2 monitors excluded (paused).

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
_Report generated 2026-04-30. Data from UptimeRobot._
```

**Rules for the Issues table:**
- Include only monitors with ≥ 1 incident. Do not list 100% monitors in the table.
- If uptime % is below 99.9%, add a note in the Incidents column: `5 (missed three nines)`.
- If uptime % is below 99.0%, note `5 (missed two nines)`.
- If downtime was zero but there were incidents (very short outages), show `< 1min`.

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
2 monitors excluded (paused).

### ✓ All monitors healthy

_Monitors: prod-cdn, prod-api, prod-auth… (and 39 more)_

---
_Report generated 2026-04-30. Data from UptimeRobot._
```

## Handling large monitor counts

If the account has more than ~20 monitors, ask the user to narrow scope with a `name`, `url`, or `tags` filter before looping per-monitor calls. Looping `list-incidents` for 100 monitors will be slow and may hit rate limits.

If a call returns `Rate limit reached`, wait the seconds it states and retry — see `errors`. Free accounts get 10 tool calls per minute.

## Common mistakes

- Listing every 100% monitor as a table row — adds noise, buries the incidents that matter.
- Rounding `99.942%` to `99.9%` when the user cares about SLA thresholds — they're different outcomes for a monthly SLA. Keep at least three decimals.
- Forgetting to paginate `list-incidents` per monitor — partial pages silently under-report downtime and inflate uptime %.
- Including `PAUSED` monitors with `100.00%` uptime — they're unmonitored, not healthy. Exclude and note the count.
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
