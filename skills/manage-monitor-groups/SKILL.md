---
name: manage-monitor-groups
description: Choose between monitor groups and tags for organizing monitors — group membership is opaque and write-only over MCP, so tags are usually the better default.
tags: [monitor-groups, tags, organize, groups, uptimerobot]
---

# Manage monitor groups

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

UptimeRobot has **two** organizing mechanisms and they aren't interchangeable:

- **Tags** (`tagNames` on a monitor, discovered via `list-tags`) — free-form, many-per-monitor, no fixed ID, changeable any time via `update-monitor`.
- **Monitor groups** (`create-monitor-group` / `update-monitor-group` / `get-monitor-group` / `list-monitor-groups`, requires the `monitor-groups` plan feature) — one-per-monitor, has its own numeric ID, shows as a visual grouping on status pages.

Use this skill when the user says "organize my monitors", "put these into a group", "what should I tag this", or "set up groups for the status page".

## The membership-is-invisible gotcha (read this first)

**Group membership cannot be read back through any tool.** `create-monitor-group` and `update-monitor-group` accept `monitorIds`/`groupIds` on write, but the response only ever contains `id`, `name`, `createdAt`, `updatedAt` — no monitor list. `get-monitor-group` and `list-monitor-groups` return the same shape. `get-monitor-details` on a monitor doesn't report a `groupId` either. There is currently **no way to ask "which monitors are in this group" or "which group is this monitor in"** over MCP — the dashboard is the only place to see it.

Practical consequences:
- If you assign monitors to a group, **track the IDs yourself** (chat context or a note) — none of `create-monitor-group`, `update-monitor-group`, `get-monitor-group`, or `list-monitor-groups` will confirm it back to you directly.
- Don't tell the user "group X contains monitors A, B, C" unless you were the one who just set that exact membership and haven't lost track of it.
- This is a strong practical reason to prefer tags over groups: `get-monitor-details` *does* return `tags` for a monitor, so tag membership is always directly verifiable, unlike group membership.

**Indirect workaround — get explicit user confirmation before doing this.** [`status-pages`](../status-pages/SKILL.md)' `create-psp` resolves `monitorGroupIds` into a real `monitorsCount` on the response, which can be used to check how many monitors a group actually has. But `create-psp` **ignores `status: PAUSED` and always creates the page publicly** — this briefly exposes real monitor topology/counts on a live public URL, not a safe local check. Don't do this autonomously: confirm with the user first, then immediately follow up with `update-psp` + `status: PAUSED` to unpublish (see [`status-pages`](../status-pages/SKILL.md) Step 2). It's a last-resort workaround, not a proper read tool.

## Decision: tags vs. groups

| Need | Use |
| -- | -- |
| Verifying membership later matters | Tags — `get-monitor-details` returns `tags`; nothing returns group membership |
| A monitor can belong to more than one bucket (e.g. `production` + `us-east-1`) | Tags |
| Filtering in `list-monitors`, `bulk-pause`, or a status page's `tagIds` | Tags |
| A single named bucket shown as its own section on a status page (`monitorGroupIds`) | Groups |
| The org chart is stable (one monitor, one group) | Groups |

Most users asking to "organize" monitors actually want tags — they're cheaper to change, verifiable, and don't require the `monitor-groups` plan feature. Default to tags unless the user specifically wants grouped status-page sections.

## The group-reassignment gotcha

**There is no tool to move an existing monitor into a different existing group.** `update-monitor-group` only renames a group (`monitorGroupId` + `name` — nothing else); `update-monitor` has no `groupId` field. Group membership is set exactly once, at monitor-creation time (`groupId` on `create-monitor`) or group-creation time (`monitorIds`/`groupIds` on `create-monitor-group`).

The only way to reorganize after the fact is to dissolve groups into a *new* one:

```json
{ "name": "All API monitors", "groupIds": [111, 222] }
```

`create-monitor-group`'s `groupIds` pulls every monitor out of groups `111` and `222` into the new group. It **moves** them, not copies — the source groups end up empty. You cannot cherry-pick individual monitors out of a group this way though — it's all-or-nothing per source group. To move just a few monitors, recreate the target group via `monitorIds` naming the exact set instead:

```json
{ "name": "All API monitors", "monitorIds": [800111, 800222, 800333] }
```

## Creating a group

```json
{ "name": "US East", "monitorIds": [800111, 800222] }
```

Before creating, call `list-monitor-groups` to check a group with that name doesn't already exist (there's no server-side uniqueness check — duplicates are easy to create by accident). Immediately after creating, note the `monitorIds` you sent somewhere retrievable — it's the only record you'll have, since nothing reads it back.

## Tags: discover before creating

Tag names are free text with no dedup — `"prod"`, `"Prod"`, and `"production"` are three different tags. Before tagging a monitor, call `list-tags` and match against the existing set instead of typing a new variant:

```json
{ "cursor": 0 }
```

Then set the monitor's tags (full replacement, not merge — see [`update-monitor`](../update-monitor/SKILL.md)):

```json
{ "monitorId": 800123456, "tagNames": ["production", "us-east-1"] }
```

## Common mistakes

- Trying to confirm group membership with `get-monitor-group`, `list-monitor-groups`, or `get-monitor-details` — none of them return it directly. Don't claim to have "checked" without using the status-pages workaround.
- Assuming `update-monitor-group` can reassign monitors — it only renames.
- Using `groupIds` when the user wants a partial move — it takes *every* monitor from the source group(s).
- Creating a new tag variant (`"Production"`) instead of reusing the existing one (`"production"`) because you didn't call `list-tags` first.
- Recommending monitor groups to a Free/Solo-plan user without checking — `create-monitor-group` requires the `monitor-groups` plan feature and fails otherwise.
- Forgetting that `list-tags` returns at most 50 per page — paginate before concluding a tag doesn't exist.

## Related

- [`update-monitor`](../update-monitor/SKILL.md) — tag a monitor (`tagNames`).
- [`status-pages`](../status-pages/SKILL.md) — display a group or a set of tags as a public status page section.
- [`bulk-pause`](../bulk-pause/SKILL.md) — tag-based filtering for pause/resume operations.
- [`errors`](../errors/SKILL.md) — `-28002 subscription_limit_exceeded` when the plan lacks the `monitor-groups` feature.
