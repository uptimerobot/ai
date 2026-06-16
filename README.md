# UptimeRobot for AI agents

This repo is UptimeRobot's single source of truth for AI agent integrations. It publishes:

- **`llms.txt`** and **`AGENTS.md`** — discovery and orientation for LLMs and coding agents.
- **`.claude-plugin/`** and **`.cursor-plugin/`** — installable plugin manifests for Claude Code and Cursor.
- **`skills/`** — self-contained skill files covering every UptimeRobot MCP tool plus onboarding and runbook workflows. The `discover-monitors` skill scans an installed project for monitorable resources (pages, GET endpoints, health checks, cron jobs) and proposes monitors to create.
- **`rules/`** — shared rules loaded by both Cursor and Claude Code.
- **`mcp.json`** — Cursor-format MCP server config (dot-less filename, uses `${env:...}` interpolation).
- **`.mcp.json`** — Claude Code MCP server config (dot-prefixed so Claude Code auto-registers the server when the plugin loads).
- **`assets/logo.png`** — marketplace logo (referenced from the Cursor manifest; the Claude Code manifest does not declare an icon).

Both `mcp.json` files point at the same remote server (`https://mcp.uptimerobot.com/mcp`) and carry the same API key header — the two filenames exist because Claude Code and Cursor each expect their own convention.

The same content is mirrored under `uptimerobot.com/` for crawler discovery (`uptimerobot.com/llms.txt`, `uptimerobot.com/AGENTS.md`, etc.).

## Install

### Claude Code

#### From the Marketplace (recommended)

Browse the Claude Code plugin marketplace, find **UptimeRobot**, and enable it. Claude Code will prompt you for your UptimeRobot API key at enable time (defined via `userConfig` in the plugin manifest) and store it securely in your OS keychain — no shell env var needed. The MCP server auto-registers via `.mcp.json` as soon as the plugin loads.

Get your API key from the UptimeRobot dashboard: **Integrations & API** → **Main API key** (read/write) or **Read-only API key**.

#### Manual / CI install

For scripted setups that don't go through the marketplace (CI, dotfiles, dev-containers), see [`skills/setup/SKILL.md`](skills/setup/SKILL.md). Short version:

```bash
claude mcp add uptimerobot --transport http https://mcp.uptimerobot.com/mcp \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Then quit and relaunch Claude Code. Run `/plugin` to confirm `uptimerobot MCP Server` shows ✓ connected.

### Cursor

#### From the Marketplace (once published)

Browse the [Cursor Marketplace](https://cursor.com/marketplace), find **UptimeRobot**, click **Add to Cursor**, and provide your API key when prompted.

#### Local install (for development and pre-submission testing)

Follow [Cursor's plugin docs](https://cursor.com/docs/plugins):

```bash
# 1. Clone or symlink this repo into Cursor's local plugin folder
git clone https://github.com/uptimerobot/ai.git ~/.cursor/plugins/local/uptimerobot-ai

# 2. Launch Cursor with UPTIMEROBOT_API_KEY in the environment (macOS)
export UPTIMEROBOT_API_KEY=ur_mainKey_...
open -a "Cursor"

# Linux: launch Cursor from the same terminal where you exported the variable.
# Windows: set the environment variable via System Properties → Environment Variables,
#          then restart Cursor.
```

After Cursor is open, run **Developer: Reload Window** from the command palette.

Verify the plugin is discovered:

- **Settings → Rules, Skills, Subagents** — the `uptimerobot.mdc` rule and every `skills/*/SKILL.md` entry should be listed.
- **Settings → Tools & MCPs** — `uptimerobot` should appear with 10 tools once the MCP server connects.

Get your API key from the UptimeRobot dashboard: **Integrations & API** → **Main API key** (read/write) or **Read-only API key**.

### Other agents / direct MCP

Any MCP-compatible client can connect directly:

```json
{
  "mcpServers": {
    "uptimerobot": {
      "url": "https://mcp.uptimerobot.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## What the plugin provides

Ten tools via MCP — full list and payloads in [`AGENTS.md`](AGENTS.md) and [`skills/`](skills/):

| Tool | Purpose |
| -- | -- |
| `create-monitor` | Create HTTP, KEYWORD, PING, PORT, HEARTBEAT, DNS, API, or UDP monitors |
| `update-monitor` | Change name, URL, interval, alert contacts, tags, HTTP settings |
| `update-monitor-status` | Pause or resume a monitor |
| `list-monitors` | Paginated list with search + state filters |
| `get-monitor-details` | Full config + current state for one monitor |
| `get-monitor-stats` | Aggregated up/down/paused counts + uptime % |
| `get-response-times` | Time-series response-time data with buckets |
| `list-incidents` | Incidents across monitors, with time range + monitor filter |
| `get-incident-details` | Per-incident checker locations, logs, traceroute |
| `list-integrations` | Available alert-contact integrations |

## Plan requirements

UptimeRobot plans are **Free, Solo, Team, Enterprise**. Monitor-type availability, interval minimums, and monitor limits depend on the active plan — the MCP server enforces these and returns error code `-28002` (`subscription_limit_exceeded`) when a call would exceed them. See [`skills/errors/SKILL.md`](skills/errors/SKILL.md).

## Marketplace submission readiness

Checklist for Cursor Marketplace review (tracked against [`cursor.com/docs/reference/plugins`](https://cursor.com/docs/reference/plugins)):

- [x] Cursor manifest present at `.cursor-plugin/plugin.json` with only documented fields, explicit `rules` / `skills` / `mcpServers` paths, and a `logo` reference.
- [x] `mcp.json` at repo root (Cursor format) using `${env:UPTIMEROBOT_API_KEY}` interpolation.
- [x] `.mcp.json` at repo root (Claude Code format) — unchanged, do not rename.
- [x] `assets/logo.png` present and referenced from the Cursor manifest (`.cursor-plugin/plugin.json`).
- [x] No secrets committed. Auth is passed at runtime via the `UPTIMEROBOT_API_KEY` environment variable.
- [x] [`LICENSE`](LICENSE) present (MIT).
- [x] Rule files (`rules/*.mdc`) carry YAML frontmatter with `description` and `alwaysApply`.
- [x] Skill files (`skills/*/SKILL.md`) carry YAML frontmatter with `name` and `description`.

## Contributing

This repo is generated / curated. File issues at https://github.com/uptimerobot/ai/issues. For MCP server bugs, use https://uptimerobot.com/contact.

## License

MIT. See [LICENSE](LICENSE).
