---
name: status-pages
description: Create and publish a public status page from monitors, groups, or tags, and manage announcements (incident, maintenance, info notices) on it.
tags: [status-page, psp, announcements, public, uptimerobot]
---

# Status pages (PSPs)

> **Preflight — read first.** Look for UptimeRobot MCP tools: any tool whose name contains `uptimerobot` (case-insensitive) and ends in a tool name such as `list-monitors` — e.g. `mcp__uptimerobot__list-monitors`, `mcp__plugin_uptimerobot_uptimerobot__list-monitors`, or a claude.ai `UptimeRobot` connector. If your client lists tools by name and loads them on demand, load them with its tool search first. Only if none exist, invoke the `uptimerobot:setup` skill. Don't tell the user the MCP is misconfigured.

Use this when the user says "set up a status page", "publish uptime for customers", "post a maintenance notice on the status page", or "let people know we're investigating".

Two linked resources: the **page** itself (`create/update/get/list/delete-psp`) and **announcements** posted to it (`create/update/get/list/pin/unpin/delete-psp-announcement`, requires the `psp-subscribers` plan feature).

`delete-psp` and `delete-psp-announcement` are permanent and cannot be undone (after a page is deleted, its announcements can't be reached). Confirm the account with `get-user` first, and get explicit user confirmation before calling either.

## Step 1 — Decide what populates the page

`create-psp` accepts three ways to pick monitors, plus `autoAddMonitors`, which applies only when `monitorIds` isn't sent:

| Field | Behavior |
| -- | -- |
| `monitorIds` | Explicit list. If you also send `autoAddMonitors: true`, `monitorIds` wins and auto-add stays off. The only field that populates the response's `monitorIds` array. |
| `monitorGroupIds` | Resolves group membership into `monitorsCount` correctly (verified) — see [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md). |
| `tagIds` | Resolves tagged monitors into `monitorsCount` correctly (verified). Takes numeric tag IDs from `list-tags`, not tag names. |
| `autoAddMonitors: true` | Every monitor on the account (except a few dashboard-only types such as dependency monitors), including monitors created later. Only applies when `monitorIds` isn't sent. |

**`monitorGroupIds`/`tagIds` resolve into `monitorsCount` but the `monitorIds` array in the response stays empty.** Don't read an empty `monitorIds` on a group/tag-scoped page as "no monitors are showing"; check `monitorsCount` instead. On an auto-add page `monitorIds` comes back as `[0]`, which means auto-add is on (all monitors, except a few dashboard-only types such as dependency monitors) — not a real list.

Ask before using `autoAddMonitors: true` — it's convenient but means internal/staging monitors show up on a public page unless the user is deliberate about it, and it touches every monitor on the account.

## Step 2 — Create, unpublish, then add monitors

`status` takes `PAUSED` or `ENABLED`, but **`create-psp` ignores `status: PAUSED`**: a new page is always created `ENABLED` (public) and stays public until `update-psp` pauses it. There is no way to create a page that is never public. If the user wants to review before going live, keep that public moment harmless:

1. Create the page with no monitors (or with a `password`):

```json
{ "friendlyName": "Acme API Status" }
```

2. Immediately unpublish it with `update-psp`:

```json
{ "pspId": 900123, "status": "PAUSED" }
```

3. **Always** confirm with `get-psp`. Only tell the user the page is a private draft once `get-psp` shows `PAUSED`.
4. Add the monitors with `update-psp` (`monitorIds`, `monitorGroupIds`, or `tagIds`), then re-check with `get-psp`. These fields replace the whole list: to add to an existing page, read `monitorIds` / `tagIds` with `get-psp` and send them in full. `get-psp` doesn't return `monitorGroupIds`, so for groups ask the user for the complete list and verify with `monitorsCount`. If `monitorIds` reads `[0]` (auto-add), don't merge into it — `[0, id]` is rejected. `autoAddMonitors: false` does nothing; to turn auto-add off, send a complete explicit `monitorIds` list and check that `get-psp` no longer shows `[0]`. See [how updates treat lists](../../AGENTS.md#how-updates-treat-list-and-map-fields).

Creating with the monitors already attached means a half-configured page (real monitors, no password) is public from the moment it's created until the pause lands.

Things MCP **cannot** do — tell the user to use the dashboard instead:
- Upload a logo or favicon.
- Point a `customDomain` at UptimeRobot — the field just registers the domain; the user still needs to create the CNAME record with their DNS provider.

## Step 3 — Announcements

Announcement `status` has four states and only `pspId` is schema-required. **The blank defaults are not safe:** omitting `title`/`content` leaves them `null` (a blank notice), and omitting `status`/`startDate` doesn't fall back to `Offline` (draft) — it defaults to `Pending` with `startDate` set to the current time, which will auto-publish blank (see below). Always set `title`, `content`, `type`, and `status` explicitly:

| Status | Meaning |
| -- | -- |
| `Offline` | Draft, not visible |
| `Pending` | Scheduled — auto-publishes once `startDate` passes |
| `Published` | Live now |
| `Archived` | Was live, now hidden but kept for history |

**`Pending` → `Published` is asynchronous, not instant.** A background job publishes `Pending` announcements once `startDate` arrives, but it doesn't run the moment `startDate` passes — expect a short delay (on the order of a minute) before the status flips. Don't assume "still shows `Pending` when I just checked" means it's stuck, and don't assume you must manually flip it to `Published` at the exact scheduled time. If the user needs it live *immediately*, set `status: Published` directly rather than relying on the delay.

```json
{
  "pspId": 900123,
  "title": "Investigating elevated error rates",
  "content": "We're seeing increased 5xx errors on the API. Investigating.",
  "type": "Issue",
  "status": "Published"
}
```

To publish immediately on create, set `status: Published` and **omit `startDate`** — the server stamps the current time; don't invent one. To schedule for later, send a future `startDate` and `status: Pending`.

**Announcements may notify the page's subscribers.** Whether subscribers are emailed hasn't been verified. `deliveryStatus: "InQueue"` is set on every new announcement, so it tells you nothing either way. The MCP can't show whether a page has subscribers, so always tell the user and get confirmation before creating or publishing an announcement.

**Updating an existing announcement** (`update-psp-announcement`, only provided fields change):

- Publish now: `status: Published` **and** `startDate` set to the current UTC time — an omitted `startDate` keeps the stored schedule.
- Reschedule: a future `startDate` **and** `status: Pending`. Only `Pending` announcements publish when their time arrives, so a future `startDate` alone on a `Published` announcement does not reschedule it.
- Take down: `status: Offline` or `Archived`.

**Date format.** `startDate`/`endDate` must be UTC ISO 8601 ending in `Z` — `YYYY-MM-DDTHH:mm:ssZ` (fractional seconds allowed) or `YYYY-MM-DDTHH:mmZ`. Offsets like `+02:00` are rejected; convert to UTC first. `endDate` may be `null` for no end.

`type` is `Info`, `Maintenance`, or `Issue` — pick `Issue` for incident updates, `Maintenance` for planned work (cross-reference [`maintenance-windows`](../maintenance-windows/SKILL.md) if the user is also scheduling one), `Info` for everything else.

**`creationDate` isn't stable.** It changes on every `update-psp-announcement` call, not just at creation (behaves like "last modified" despite the name). Don't use it to report when an announcement was originally posted if it's been edited since — capture the timestamp yourself at creation time if the user needs an accurate history.

Pin the active incident announcement so it's the first thing visitors see:

```json
{ "pspId": 900123, "announcementId": 5001 }
```

(via `pin-psp-announcement`). A page has one pin: pinning replaces whatever is pinned now, so check `get-psp` `pinnedAnnouncementId` first and tell the user if something else is pinned. Unpin and set `status: Archived` once resolved — don't just leave it pinned and stale.

## Full example flow

User: "We're down, post something on the status page and let me know when it's resolved so I can update it."

1. `list-psps` (or ask) to find the right `pspId`.
2. Show the user the title and content, confirm (it may notify subscribers), then `create-psp-announcement` with `type: Issue`, `status: Published`.
3. `pin-psp-announcement` so it's visible at the top.
4. When the user confirms resolution: `update-psp-announcement` with `status: Archived` (or edit the content to say "Resolved" and leave it briefly before archiving).
5. `unpin-psp-announcement`.

## Common mistakes

- Sending `update-psp` `monitorIds: [newId]` to add one monitor — it replaces the list and removes every other monitor from the public page. Read the current list with `get-psp` and send it in full (for groups, ask the user — `get-psp` doesn't return them).
- Passing `status: PAUSED` to `create-psp` and assuming it produced a draft — create ignores it and the page is public. Create without monitors (or with a password), `update-psp` `{pspId, status: "PAUSED"}`, confirm with `get-psp`, then add monitors.
- Publishing (`status: ENABLED`) before the user has reviewed which monitors are included — internal monitors leak onto a public page.
- Setting `autoAddMonitors: true` without asking — it includes every monitor on the account (except a few dashboard-only types), including ones created later; confirm before using since it also exposes every internal/staging monitor.
- Creating an announcement with only `pspId` set expecting a safe draft — it saves as `Pending` with `startDate: now`, which will auto-publish blank once the background job runs (not instantly, but not a stable draft either). Always fill `title` + `content` + `type` + `status`.
- Assuming a `Pending` announcement checked moments after creation is stuck/broken because it hasn't auto-published yet — the transition job runs asynchronously; give it time before concluding it's not working.
- Creating or publishing an announcement without asking — it may notify the page's subscribers, even when the page is paused.
- Hard-coding a `startDate` on a `status: Published` create — omit it and let the server stamp the time. Sending a future `startDate` alone to reschedule a `Published` announcement — also set `status: Pending`.
- Sending dates with a timezone offset (`+02:00`) — use UTC with a trailing `Z`.
- Leaving a resolved incident announcement pinned and `Published` — archive and unpin once it's over.
- Promising logo upload or custom-domain DNS setup via MCP — both require the dashboard.

## Related

- [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md) — groups/tags feeding `monitorGroupIds` / `tagIds`.
- [`maintenance-windows`](../maintenance-windows/SKILL.md) — pair a `Maintenance`-type announcement with an actual suppression window.
- [`incident-response`](../incident-response/SKILL.md) — the incident this announcement is usually about.
- [`errors`](../errors/SKILL.md) — the `requires a plan with the "psp-subscribers" feature` error when the plan lacks it.
