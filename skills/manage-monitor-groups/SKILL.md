---
name: manage-monitor-groups
description: Choose between monitor groups and tags for organizing monitors, and create, fill, move between, or delete monitor groups. Tags are usually the better default.
tags: [monitor-groups, tags, organize, groups, uptimerobot]
---

# Manage monitor groups

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this when the user wants to organize monitors ("put these in a group", "tag these as production", "a section per team on the status page").

**Tools:** `list-monitor-groups`, `get-monitor-group`, `create-monitor-group`, `update-monitor-group`, `delete-monitor-group`, `update-monitor`, `list-monitors`, `list-tags`. The tools' own schemas and descriptions are the reference for parameters — this page only covers what they don't say.

**Tags or groups?** A monitor can have many tags but sits in at most one group. Tags need no plan feature and show up in `get-monitor-details`. Groups need the `monitor-groups` plan feature; use them when the user wants one bucket per monitor, or a group as its own section on a status page. When unsure, use tags.

`update-monitor` — move one monitor into group 222 (`0` = no group):

```json
{ "monitorId": 800111, "groupId": 222 }
```

`list-monitors` — read a group's members:

```json
{ "groupId": 222, "limit": 100 }
```

## Gotchas

- **Membership is only readable through `list-monitors` + `groupId`.** `get-monitor-details` has no group field, and the group tools return only `id`, `name` and dates. To find a monitor's group, check candidate groups with `list-monitors`.
- **`update-monitor-group` only renames.** Move monitors with `update-monitor` `groupId`.
- `create-monitor-group` with `groupIds` moves **every** monitor out of the listed groups. For a partial move, use `update-monitor` per monitor.
- `delete-monitor-group` keeps the monitors: they go to `monitorsNewGroupId`, or to no group if you leave it out. Still permanent for the group — confirm with the user.
- Group names aren't unique — check `list-monitor-groups` before creating one.
- Tag names are free text: `prod`, `Prod` and `production` are three tags. Check `list-tags` (50 per page — paginate) and reuse an existing name.
- `tagNames` on `update-monitor` replaces the whole tag set — merge with the `tags` from `get-monitor-details`.
- `create-psp` `tagIds` and `delete-tag` need the tag's numeric `id` from `list-tags`, not its name. `delete-tag` removes the tag from every monitor.

## Related

- [`update-monitor`](../update-monitor/SKILL.md) — `tagNames` and `groupId`.
- [`status-pages`](../status-pages/SKILL.md) — show a group or tags on a status page.
- [`bulk-pause`](../bulk-pause/SKILL.md) — act on monitors by tag.
