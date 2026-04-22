# Contributing

This repo is a Claude Code + Cursor plugin. Most contributions add a new
**skill**, **command**, **agent**, or **rule**. Keep additions small and
focused — one concept per file/directory.

## General conventions

- Use **kebab-case** for all file and directory names.
- Every component must have a short, task-oriented `description` — this is what
  the model uses to decide when to invoke it.
- Reference any intra-plugin paths with `${CLAUDE_PLUGIN_ROOT}` (Claude Code)
  or `${CURSOR_PLUGIN_ROOT}` (Cursor), never absolute paths.
- Don't commit secrets. Use env vars or the host tool's secret manager.

## Skills (`skills/<skill-name>/SKILL.md`)

A skill is a directory containing a `SKILL.md` file and optionally extra
reference files or scripts.

```markdown
---
name: sync-timezones
description: Synchronize DST offsets using the syncTimezones CLI in api-internal.
---

# Sync timezones

Steps the agent should follow…
```

Optional supporting files:

```
skills/sync-timezones/
├── SKILL.md
├── reference.md          # extra context the model can open on demand
└── scripts/
    └── run.sh            # invoked via ${CLAUDE_PLUGIN_ROOT}/skills/.../scripts/run.sh
```

## Commands (`commands/<command-name>.md`)

A command is a single markdown file that becomes a slash command
(e.g. `/uptimerobot-ai:deploy`). Frontmatter is optional; when present it
mirrors the skill format.

```markdown
---
description: Run the local UptimeRobot dev stack.
---

Run `cd ~/repos/dev-local && .bin/ur start` and wait for all services to be
healthy before returning.
```

## Agents (`agents/<agent-name>.md`)

Sub-agents are specialized personas Claude/Cursor can delegate to.

```markdown
---
name: pr-reviewer
description: Review UptimeRobot PRs for style, security, and test coverage.
tools: [Read, Grep, Bash]
---

You are a senior reviewer for UptimeRobot repos. …
```

## Cursor rules (`rules/<rule-name>.mdc`)

Cursor-specific project rules live here with frontmatter controlling when they
apply.

```mdc
---
description: Enforce TypeScript style across api-internal.
globs:
  - "apps/api-internal/**/*.ts"
alwaysApply: false
---

- Prefer `const` over `let` unless reassignment is needed.
- …
```

## Hooks (`hooks/hooks.json`)

Hooks wire commands or scripts to lifecycle events (`PreToolUse`,
`PostToolUse`, `SessionStart`, `SessionEnd`). Keep the hook set minimal —
hooks run on every matching event.

## MCP servers (`mcp.json`)

Add MCP servers here to expose them through the plugin. Prefer referencing
scripts via `${CLAUDE_PLUGIN_ROOT}` / `${CURSOR_PLUGIN_ROOT}`.

## Testing a change

Before opening a PR:

1. Lint the JSON: `python -c "import json,sys; [json.load(open(p)) for p in sys.argv[1:]]" .claude-plugin/plugin.json .cursor-plugin/plugin.json hooks/hooks.json mcp.json`.
2. Install the plugin locally in Claude Code and/or Cursor and verify the new
   skill/command/agent/rule loads and runs as expected.
3. Update `README.md` if you added a new top-level directory or convention.
