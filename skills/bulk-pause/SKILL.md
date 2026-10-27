---
name: bulk-pause
description: Pause (or resume) many UptimeRobot monitors at once — by tag, name, URL, or state — around a deployment or maintenance window.
tags: [bulk, pause, resume, deployment, maintenance, uptimerobot]
---

# Bulk pause / resume

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

There is no single "pause all" tool. The workflow is: enumerate the target monitors with `list-monitors`, then call `update-monitor-status` for each.

Use this when the user says "pause everything", "silence alerts during deploy", "mute the api monitors", or "bring them all back online".

> **Prefer [`maintenance-windows`](../maintenance-windows/SKILL.md) for scheduled downtime.** Maintenance windows suppress *alerts* without changing monitor state, so nothing needs resuming afterwards. Only bulk-pause when the user explicitly wants the monitors stopped, or when a maintenance window isn't suitable (ad-hoc, very short, or already in the middle of a deploy).

## Step 1 — List the target monitors

Filter as tightly as possible to avoid pausing unrelated monitors.

### By tag

```json
{ "tags": ["deploy-api"], "limit": 100 }
```

`tags` matches monitors carrying **any** of the listed tags. Check each returned monitor's `tags` before touching anything.

### By name or URL

```json
{ "url": "api.example.com", "limit": 100 }
```

Use `name` instead of `url` to match on the monitor name. There is no `search` parameter — an unknown filter key must never be trusted to narrow the list, so always check the returned count before pausing.

### By state (only currently-running monitors)

```json
{ "filter": ["UP", "DOWN", "LOOKS_DOWN", "STARTED"], "limit": 100 }
```

`filter` values combine as OR, so this returns every monitor that isn't paused. Don't use `["STARTED"]` alone — it matches only monitors whose status is literally `STARTED` (just created or resumed, not yet checked), not every running monitor. Alternatively, omit `filter` and skip monitors whose `status` is `PAUSED` client-side. Filters combine with the other params, e.g. `{ "tags": ["deploy-api"], "filter": ["UP", "DOWN", "LOOKS_DOWN", "STARTED"] }`.

Paginate until `hasMore: false`: repeat your **own** arguments (filters, `tags`, `limit`) and set `cursor` to the previous `nextCursor`. Don't copy the next-call JSON in the `instructions` field — it drops your filters, silently widening the list to every monitor on the account. **Do not start pausing until the full list is collected** — partial pauses mid-paginate are easy to miss on resume.

## Step 2 — Confirm with the user

Before any write, echo the list back:

```
Pausing 14 monitors tagged `deploy-api`:
- Prod API (HTTP, UP)
- Prod API /healthz (KEYWORD, UP)
- ...
```

Wait for confirmation if the count is non-trivial (>5). Pausing a monitor that is down **resolves its open incident** at that moment: the incident becomes `Resolved`, its downtime stops counting, and it no longer appears in `list-incidents` with `status: "open"`. If the monitor is still down after resuming, a new incident opens. Tell the user before pausing a monitor mid-outage.

## Step 3 — Record the IDs

Before pausing anything, store the list of `monitorId`s somewhere retrievable (chat context, a note file, a gist) — you'll need it to resume. Don't rely on re-filtering later: the user may have added or renamed monitors in the interim, and a tag-based filter can quietly pick up unrelated monitors on resume.

## Step 4 — Pause each monitor

```json
{ "monitorId": 800123456, "status": "PAUSED" }
```

Loop over the collected IDs. If a call returns `Rate limit reached`, wait the seconds it states, retry **that same monitor**, and only then move to the next ID (see `errors` skill). Free accounts get 10 tool calls per minute, so pace long lists.

Then wait a few seconds (reads can lag) and confirm by ID. For a handful of monitors, call `get-monitor-details` on each stored ID and check `status`. For many, call `list-monitors` with only `filter: ["PAUSED"]` and `limit: 100` (paginate while `hasMore` is true; an account can have hundreds of paused monitors) and check every stored ID is in it. Report any that aren't paused.

## Step 5 — Resume

Same loop, flip the status:

```json
{ "monitorId": 800123456, "status": "STARTED" }
```

Paused monitors still count toward the monitor limit, so resuming normally succeeds. It can return `Monitor limit exceeded` only if the account is over its limit — e.g. after a plan downgrade. Surface which ones failed and suggest deleting or upgrading — **do not retry**.

Confirm the same way, by the stored IDs — not by re-filtering on tags or name (a monitor renamed or retagged meanwhile would drop out and look resumed). None should still be `PAUSED`; freshly resumed monitors show `STARTED` until their first check.

## Full example flow

User: "Pause everything tagged `deploy-web` for the next 20 minutes."

1. `list-monitors` with `{ "tags": ["deploy-web"], "filter": ["UP", "DOWN", "LOOKS_DOWN", "STARTED"], "limit": 100 }`, paginate (same args + `cursor`) → 8 monitors.
2. Echo the 8 names and `type`s. User confirms.
3. Note the 8 IDs.
4. For each: `update-monitor-status` with `{"monitorId": ..., "status": "PAUSED"}`, then confirm. Tell the user: "Paused 8 monitors. Run `resume deploy-web` when you're done."
5. On resume: loop with `STARTED`. Report which recovered and which errored.

## Common mistakes

- Re-filtering on resume instead of using the stored ID list — will silently miss monitors whose tag or name changed.
- Skipping the confirmation step for large batches. Pausing production monitoring without echoing the list is high-risk.
- Pausing monitors already in `PAUSED` state — harmless but noisy. Filter them out up front.
- Using `filter: ["STARTED"]` to mean "running" — it returns only never-checked monitors, so the batch comes back empty or incomplete.
- Copying the `instructions` next-call JSON when paginating — it drops `tags` / `filter` / `name`, so later pages contain unrelated monitors.
- Retrying `Monitor limit exceeded` on resume. It's a cap, not a rate limit.
- Using `update-monitor` with `status: ...` instead of `update-monitor-status`. Status lives on the dedicated tool.

## Related

- `manage-monitors` — for the underlying `list-monitors` and `update-monitor-status` tools.
- [`maintenance-windows`](../maintenance-windows/SKILL.md) — the scheduled/recurring alternative.
- `errors` — for the monitor limit, missing write access, and rate limits.
- `incident-response` — when pausing is a response to ongoing incidents rather than a deploy.
