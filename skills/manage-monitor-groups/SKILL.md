---
name: manage-monitor-groups
description: Choose between monitor groups and tags for organizing monitors, and create, fill, move between, or delete monitor groups. Tags are usually the better default.
tags: [monitor-groups, tags, organize, groups, uptimerobot]
---

# Manage monitor groups

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

UptimeRobot has **two** organizing mechanisms and they aren't interchangeable:

- **Tags** (`tagNames` on a monitor, discovered via `list-tags`) — free-form, many-per-monitor, assigned by name via `create-monitor` / `update-monitor`. Each tag also has a numeric `id` (from `list-tags`) — `create-psp` `tagIds` and `delete-tag` need the ID, not the name.
- **Monitor groups** (`create-monitor-group` / `update-monitor-group` / `get-monitor-group` / `list-monitor-groups` / `delete-monitor-group`, plus `groupId` on `create-monitor` / `update-monitor`; requires the `monitor-groups` plan feature) — one-per-monitor, has its own numeric ID, shows as a visual grouping on status pages.

Use this skill when the user says "organize my monitors", "put these into a group", "what should I tag this", or "set up groups for the status page".

## Reading group membership

- **Which monitors are in group X?** `list-monitors` with `{ "groupId": 111, "limit": 100 }` (paginate). This is the only tool that reads membership.
- **Which group is monitor Y in?** No tool returns it directly — `get-monitor-details` has no `groupId` field. Check candidate groups with `list-monitors` + `groupId`.
- `create-monitor-group`, `get-monitor-group`, and `list-monitor-groups` only return `id`, `name`, `createdAt`, `updatedAt` — never a monitor list.

## Decision: tags vs. groups

| Need | Use |
| -- | -- |
| A monitor can belong to more than one bucket (e.g. `production` + `us-east-1`) | Tags |
| Seeing a monitor's buckets from its own details | Tags — `get-monitor-details` returns `tags`, not the group |
| A single named bucket shown as its own section on a status page (`monitorGroupIds`) | Groups |
| The org chart is stable (one monitor, one group) | Groups |

Both can be filtered in `list-monitors` (`tags` or `groupId`). Most users asking to "organize" monitors actually want tags — they're cheaper to change and don't require the `monitor-groups` plan feature. Default to tags unless the user specifically wants grouped status-page sections.

## Moving monitors between groups

Move one existing monitor with `update-monitor`:

```json
{ "monitorId": 800111, "groupId": 222 }
```

`groupId: 0` removes the monitor from its group. `update-monitor-group` only renames a group (`monitorGroupId` + `name`, nothing else).

To merge whole groups, `create-monitor-group` with `groupIds` moves **every** monitor out of the listed groups into the new one (the source groups end up empty):

```json
{ "name": "All API monitors", "groupIds": [111, 222] }
```

## Deleting a group

`delete-monitor-group` with `{ "monitorGroupId": 111, "monitorsNewGroupId": 222 }` moves the group's monitors to group `222` (or to no group if `monitorsNewGroupId` is omitted). Confirm with the user first.

## Creating a group

```json
{ "name": "US East", "monitorIds": [800111, 800222] }
```

Before creating, call `list-monitor-groups` to check a group with that name doesn't already exist (there's no server-side uniqueness check — duplicates are easy to create by accident). Afterwards, verify with `list-monitors` + `groupId`.

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

- Telling the user group membership can't be read — `list-monitors` with `groupId` returns it.
- Using `update-monitor-group` to reassign monitors — it only renames. Use `update-monitor` `groupId`.
- Using `groupIds` when the user wants a partial move — it takes *every* monitor from the source group(s). Move individual monitors with `update-monitor` instead.
- Passing tag names to `create-psp` `tagIds` — it needs numeric IDs from `list-tags`.
- Creating a new tag variant (`"Production"`) instead of reusing the existing one (`"production"`) because you didn't call `list-tags` first.
- Recommending monitor groups to a Free/Solo-plan user without checking — `create-monitor-group` requires the `monitor-groups` plan feature and fails otherwise.
- Forgetting that `list-tags` returns at most 50 per page — paginate before concluding a tag doesn't exist.

## Related

- [`update-monitor`](../update-monitor/SKILL.md) — tag a monitor (`tagNames`) or move it to a group (`groupId`).
- [`status-pages`](../status-pages/SKILL.md) — display a group or a set of tags as a public status page section.
- [`bulk-pause`](../bulk-pause/SKILL.md) — tag-based filtering for pause/resume operations.
- [`errors`](../errors/SKILL.md) — `-28002 subscription_limit_exceeded` when the plan lacks the `monitor-groups` feature.
