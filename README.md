# uptimerobot/ai

Shared AI tooling for UptimeRobot engineers. This repository is a dual-target
**Claude Code** and **Cursor** plugin that bundles skills, slash commands,
sub-agents, and project rules for working across UptimeRobot repositories.

> Status: scaffolding only. Skills and commands will be added incrementally.

## What's in here

| Directory | Purpose | Used by |
| --- | --- | --- |
| `.claude-plugin/plugin.json` | Claude Code plugin manifest | Claude Code |
| `.cursor-plugin/plugin.json` | Cursor plugin manifest | Cursor |
| `skills/<name>/SKILL.md` | Reusable skills | Claude Code, Cursor |
| `commands/*.md` | Slash commands | Claude Code, Cursor |
| `agents/*.md` | Sub-agent definitions | Claude Code, Cursor |
| `rules/*.mdc` | Project rules with frontmatter | Cursor |
| `hooks/hooks.json` | Event-driven hooks | Claude Code, Cursor |
| `scripts/` | Helper scripts invoked by hooks/skills | both |
| `assets/` | Logos and static assets | both |
| `mcp.json` | Optional MCP server definitions | both |

## Installing

### Claude Code

From a project where you want to use the plugin:

```bash
# Using a local clone
/plugin install /path/to/uptimerobot/ai

# Or from Git
/plugin install https://github.com/uptimerobot/ai
```

Components are namespaced under the plugin name, e.g. `/uptimerobot-ai:<command>`.

### Cursor

1. Clone this repo locally.
2. In Cursor, open **Settings → Plugins → Add local plugin** and point it at
   the checkout directory.
3. Rules in `rules/*.mdc` are picked up automatically; skills/commands/agents
   become available through the Agent.

For team-wide rollout, see the [Cursor plugins docs](https://cursor.com/docs/plugins).

## Adding content

See [CONTRIBUTING.md](./CONTRIBUTING.md) for authoring conventions.

Quick reference:

- **Skill** → create `skills/<skill-name>/SKILL.md` with a YAML frontmatter
  `name` and `description`, then the skill body.
- **Command** → drop a markdown file into `commands/<command-name>.md`.
- **Agent** → drop a markdown file into `agents/<agent-name>.md` with
  frontmatter describing the agent.
- **Cursor rule** → add `rules/<rule-name>.mdc` with frontmatter
  (`description`, `globs`, `alwaysApply`).

Always use kebab-case for file and directory names, and reference intra-plugin
paths with `${CLAUDE_PLUGIN_ROOT}` / `${CURSOR_PLUGIN_ROOT}` from hooks and
scripts so the plugin stays portable.
