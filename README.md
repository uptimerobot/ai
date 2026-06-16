# UptimeRobot for AI agents

This repo is UptimeRobot's single source of truth for AI agent integrations. It publishes:

- `**llms.txt**` and `**AGENTS.md**` — discovery and orientation for LLMs and coding agents.
- `**.claude-plugin/**` and `**.cursor-plugin/**` — installable plugin manifests for Claude Code and Cursor.
- `**skills/**` — self-contained skill files covering every UptimeRobot MCP tool plus onboarding and runbook workflows.
- `**rules/**` — shared rules loaded by both Cursor and Claude Code.
- `**mcp.json**` — Cursor-format MCP server config (dot-less filename).
- `**.mcp.json**` — Claude Code MCP server config (dot-prefixed so Claude Code auto-registers the server when the plugin loads).
- `**assets/logo.png**` — marketplace logo, declared as the `icon` in the Cursor manifest (Claude Code's plugin manifest has no icon field; the directory listing supplies its icon at submission time).

Both `mcp.json` files are now identical — they register the same `mcp-remote` launcher that proxies to `https://mcp.uptimerobot.com/mcp` and runs the OAuth browser flow. The two filenames exist only because Claude Code and Cursor each expect their own convention.

The same content is mirrored under `uptimerobot.com/` for crawler discovery (`uptimerobot.com/llms.txt`, `uptimerobot.com/AGENTS.md`, etc.).

## Install

### Claude Code

#### From the marketplace (once published)

UptimeRobot is being submitted to Anthropic's **community** plugin marketplace. Once accepted, add that marketplace once and install:

```bash
/plugin marketplace add anthropics/claude-plugins-community
/plugin install uptimerobot@claude-community
```

Or run `/plugin`, open the **Discover** tab, find **UptimeRobot**, and install it. (The community marketplace must be added first — it isn't built in. Only Anthropic's curated official marketplace shows up in `/plugin` with no setup.)

The MCP server auto-registers via `.mcp.json` as soon as the plugin loads. The first time it connects, a browser opens for you to log into UptimeRobot and authorize access (OAuth) — there's no API key to paste. Tokens are cached locally, so you only do this once.

#### Manual / scripted install

For setups that don't go through the marketplace (dotfiles, dev environments), see `[skills/setup/SKILL.md](skills/setup/SKILL.md)`. Short version:

```bash
claude mcp add uptimerobot -- npx -y mcp-remote@latest https://mcp.uptimerobot.com/mcp
```

Then quit and relaunch Claude Code, completing the OAuth browser flow when it appears. Run `/plugin` to confirm `uptimerobot MCP Server` shows ✓ connected.

### Cursor

#### From the Marketplace (once published)

Browse the [Cursor Marketplace](https://cursor.com/marketplace), find **UptimeRobot**, and click **Add to Cursor**. Authorize through the OAuth browser flow when the MCP server first connects — no API key needed.

#### Local install (for development and pre-submission testing)

Follow [Cursor's plugin docs](https://cursor.com/docs/plugins):

```bash
# Clone or symlink this repo into Cursor's local plugin folder
git clone https://github.com/uptimerobot/ai.git ~/.cursor/plugins/local/uptimerobot-ai
```

Launch Cursor and run **Developer: Reload Window** from the command palette.

Verify the plugin is discovered:

- **Settings → Rules, Skills, Subagents** — the `uptimerobot.mdc` rule and every `skills/*/SKILL.md` entry should be listed.
- **Settings → Tools & MCPs** — `uptimerobot` should appear with 10 tools once the MCP server connects. Complete the OAuth browser flow on first connection.

### Other agents / direct MCP

Any MCP-compatible client can connect via the same `mcp-remote` launcher (OAuth on first use):

```json
{
  "mcpServers": {
    "uptimerobot": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "https://mcp.uptimerobot.com/mcp"]
    }
  }
}
```

#### Headless / CI (no browser)

Where the OAuth browser flow can't run, connect over plain HTTP with a Main API key from the dashboard (**Integrations & API**) instead:

```json
{
  "mcpServers": {
    "uptimerobot": {
      "type": "http",
      "url": "https://mcp.uptimerobot.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

## What the plugin provides

Ten tools via MCP — full list and payloads in `[AGENTS.md](AGENTS.md)` and `[skills/](skills/)`:


| Tool                    | Purpose                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `create-monitor`        | Create HTTP, KEYWORD, PING, PORT, HEARTBEAT, DNS, API, or UDP monitors |
| `update-monitor`        | Change name, URL, interval, alert contacts, tags, HTTP settings        |
| `update-monitor-status` | Pause or resume a monitor                                              |
| `list-monitors`         | Paginated list with search + state filters                             |
| `get-monitor-details`   | Full config + current state for one monitor                            |
| `get-monitor-stats`     | Aggregated up/down/paused counts + uptime %                            |
| `get-response-times`    | Time-series response-time data with buckets                            |
| `list-incidents`        | Incidents across monitors, with time range + monitor filter            |
| `get-incident-details`  | Per-incident checker locations, logs, traceroute                       |
| `list-integrations`     | Available alert-contact integrations                                   |


## Plan requirements

UptimeRobot plans are **Free, Solo, Team, Enterprise**. Monitor-type availability, interval minimums, and monitor limits depend on the active plan — the MCP server enforces these and returns error code `-28002` (`subscription_limit_exceeded`) when a call would exceed them. See `[skills/errors/SKILL.md](skills/errors/SKILL.md)`.

## Contributing

This repo is generated / curated. File issues at [https://github.com/uptimerobot/ai/issues](https://github.com/uptimerobot/ai/issues). For MCP server bugs, use [https://uptimerobot.com/contact](https://uptimerobot.com/contact).

## Privacy

See the [UptimeRobot Privacy Policy](https://uptimerobot.com/privacy/).

## License

MIT. See [LICENSE](LICENSE).
