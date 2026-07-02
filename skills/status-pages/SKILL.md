---
name: status-pages
description: Create and publish a public status page from monitors, groups, or tags, and manage announcements (incident, maintenance, info notices) on it.
tags: [status-page, psp, announcements, public, uptimerobot]
---

# Status pages (PSPs)

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this when the user says "set up a status page", "publish uptime for customers", "post a maintenance notice on the status page", or "let people know we're investigating".

Two linked resources: the **page** itself (`create/update/get/list-psp`) and **announcements** posted to it (`create/update/get/list/pin/unpin-psp-announcement`, requires the `psp-subscribers` plan feature).

## Step 1 — Decide what populates the page

`create-psp` accepts three mutually-exclusive-in-practice ways to pick monitors, plus a fourth override:

| Field | Behavior |
| -- | -- |
| `monitorIds` | Explicit list. Ignored if `autoAddMonitors: true`. The only field that populates the response's `monitorIds` array. |
| `monitorGroupIds` | Resolves group membership into `monitorsCount` correctly (verified) — see [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md). |
| `tagIds` | Resolves tagged monitors into `monitorsCount` correctly (verified). |
| `autoAddMonitors: true` | Every *current* monitor on the account — verified (`monitorsCount` matched the account's full monitor total exactly). Whether it also auto-adds *future* monitors is claimed by the tool description but not independently verified (would require creating a new monitor and watching it appear over time — not tested since there's no way to delete a test monitor afterward). Ignores `monitorIds`. |

**`monitorGroupIds`/`tagIds` resolve into `monitorsCount` but the `monitorIds` array in the response stays empty** — verified against the live server. Don't read an empty `monitorIds` on a group/tag-scoped page as "no monitors are showing"; check `monitorsCount` instead. `autoAddMonitors: true` is stranger still: `monitorIds` comes back as `[0]` (a sentinel, not the real list and not `[]`) — don't read anything into that value on an auto-add page either.

**Side effect worth knowing about, not a recommended workflow:** `monitorsCount` reflects real group membership, so a page scoped by `monitorGroupIds: [<id>]` indirectly reveals how many monitors are actually in a group — [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md) has no direct read for this. But don't reach for this casually: since `create-psp` ignores `status: PAUSED` (below), the page is genuinely public the moment it's created, exposing real monitor topology/counts. Get explicit user confirmation before creating a page for this purpose, and immediately pause it afterward — don't do this autonomously as a routine check.

Ask before using `autoAddMonitors: true` — it's convenient but means internal/staging monitors show up on a public page unless the user is deliberate about it, and it touches every monitor on the account.

## Step 2 — Create, then immediately unpublish if you want a draft

```json
{ "friendlyName": "Acme API Status", "monitorIds": [800111, 800222], "status": "PAUSED" }
```

**`create-psp` ignores `status: PAUSED` — verified against the live server.** The page is created `ENABLED` (public) regardless of what you pass. If the user wants to review before going live, you must immediately follow up with a second call:

```json
{ "pspId": 900123, "status": "PAUSED" }
```

(via `update-psp` — that one *does* respect `status`.) Confirm with `get-psp` that it actually landed as `PAUSED` before telling the user the page is a private draft. Skipping this means a half-configured page (wrong monitors, no password) is public from the moment it's created.

Things MCP **cannot** do — tell the user to use the dashboard instead:
- Upload a logo or favicon.
- Point a `customDomain` at UptimeRobot — the field just registers the domain; the user still needs to create the CNAME record with their DNS provider.

## Step 3 — Announcements

Announcement `status` has four states and only `pspId` is schema-required. **The blank defaults are not safe** — verified against the live server: omitting `title`/`content` leaves them `null` (a blank notice), and omitting `status`/`startDate` doesn't fall back to `Offline` (draft) — it defaults to `Pending` with `startDate` set to the current time, which will auto-publish blank (see below). Always set `title`, `content`, `type`, and `status` explicitly:

| Status | Meaning |
| -- | -- |
| `Offline` | Draft, not visible |
| `Pending` | Scheduled — auto-publishes once `startDate` passes |
| `Published` | Live now |
| `Archived` | Was live, now hidden but kept for history |

**`Pending` → `Published` is asynchronous, not instant — verified against the live server, and this took two attempts to get right.** A first test set `startDate` years in the past and checked seconds after creation: still `Pending`. That looked like status never auto-transitions — but it was actually just checking before a background job had run. A second test set `startDate` ~1 minute out and waited for it to actually pass (~90s): the announcement **had** flipped to `Published` on the next check. So there is a real scheduled process that publishes `Pending` announcements once `startDate` arrives, it's just not synchronous — don't assume "still shows `Pending` when I just checked" means it's stuck; and don't assume you must manually flip it to `Published` at the exact scheduled time either. If the user needs it live *immediately*, set `status: Published` directly rather than relying on the delay.

```json
{
  "pspId": 900123,
  "title": "Investigating elevated error rates",
  "content": "We're seeing increased 5xx errors on the API. Investigating.",
  "type": "Issue",
  "status": "Published",
  "startDate": "2026-07-02T14:05:00Z"
}
```

`type` is `Info`, `Maintenance`, or `Issue` — pick `Issue` for incident updates, `Maintenance` for planned work (cross-reference [`maintenance-windows`](../maintenance-windows/SKILL.md) if the user is also scheduling one), `Info` for everything else.

**`creationDate` isn't stable — verified against the live server.** It changes on every `update-psp-announcement` call, not just at creation (behaves like "last modified" despite the name). Don't use it to report when an announcement was originally posted if it's been edited since — capture the timestamp yourself at creation time if the user needs an accurate history.

Pin the active incident announcement so it's the first thing visitors see:

```json
{ "pspId": 900123, "announcementId": 5001 }
```

(via `pin-psp-announcement`). Unpin and set `status: Archived` once resolved — don't just leave it pinned and stale.

## Full example flow

User: "We're down, post something on the status page and let me know when it's resolved so I can update it."

1. `list-psps` (or ask) to find the right `pspId`.
2. `create-psp-announcement` with `type: Issue`, `status: Published`, describing the incident.
3. `pin-psp-announcement` so it's visible at the top.
4. When the user confirms resolution: `update-psp-announcement` with `status: Archived` (or edit the content to say "Resolved" and leave it briefly before archiving).
5. `unpin-psp-announcement`.

## Common mistakes

- Assuming `create-psp` with `status: PAUSED` produces a draft — it doesn't; the page goes live immediately and needs a follow-up `update-psp` call to actually unpublish.
- Publishing (`status: ENABLED`) before the user has reviewed which monitors are included — internal monitors leak onto a public page.
- Setting `autoAddMonitors: true` without asking — verified to include every *current* monitor (122/122 in testing); confirm before using since it also touches every internal/staging monitor on the account.
- Creating an announcement with only `pspId` set expecting a safe draft — it saves as `Pending` with `startDate: now`, which will auto-publish blank once the background job runs (not instantly, but not a stable draft either). Always fill `title` + `content` + `type` + `status`.
- Assuming a `Pending` announcement checked moments after creation is stuck/broken because it hasn't auto-published yet — the transition job runs asynchronously; give it time before concluding it's not working.
- Leaving a resolved incident announcement pinned and `Published` — archive and unpin once it's over.
- Promising logo upload or custom-domain DNS setup via MCP — both require the dashboard.

## Related

- [`manage-monitor-groups`](../manage-monitor-groups/SKILL.md) — groups/tags feeding `monitorGroupIds` / `tagIds`.
- [`maintenance-windows`](../maintenance-windows/SKILL.md) — pair a `Maintenance`-type announcement with an actual suppression window.
- [`incident-response`](../incident-response/SKILL.md) — the incident this announcement is usually about.
- [`errors`](../errors/SKILL.md) — `-28002 subscription_limit_exceeded` when the plan lacks `psp-subscribers`.
