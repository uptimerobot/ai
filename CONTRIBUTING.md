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

### What belongs in a skill

The MCP server's tool schemas and descriptions already tell agents every
parameter, and a live A/B evaluation showed agents complete single-tool tasks
just as well without a skill. Write skills for:

- **Multi-step workflows** (bulk pause around a deploy, SLA reports, incident
  response).
- **Behaviour the schemas don't state**, verified against the live server
  (for example, `create-psp` ignoring `status: PAUSED`).

Don't restate parameter lists or enums from the schemas: those copies are
what drifted from the server before. If a behaviour belongs in a tool's
description, raise it with the MCP server team instead.

Skill files are published at `uptimerobot.com/skills/<name>/SKILL.md`, so
don't delete or rename a skill without arranging a redirect.

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

## MCP servers (`mcp.json` / `.mcp.json`)

The UptimeRobot server is registered as a direct streamable-HTTP connection to
`https://mcp.uptimerobot.com/mcp`; the client runs the OAuth browser flow itself.
Nothing runs on the user's machine, and no API key, header, or env var is in the
config — keep it that way. The plugin directory scan flags local package
launchers, unpinned packages, and credential reads:

```json
{
  "mcpServers": {
    "uptimerobot": {
      "type": "http",
      "url": "https://mcp.uptimerobot.com/mcp"
    }
  }
}
```

`mcp.json` (Cursor) and `.mcp.json` (Claude Code) must stay identical. When adding
other MCP servers, prefer referencing scripts via `${CLAUDE_PLUGIN_ROOT}` /
`${CURSOR_PLUGIN_ROOT}` and never commit secrets.

## MCP Registry (`server.json`)

The server is listed in the [official MCP Registry](https://registry.modelcontextprotocol.io)
as **`com.uptimerobot/uptimerobot`**. `server.json` at the repo root is the source
of truth. It is a *remote* entry — the registry stores metadata only, so nothing is
published to npm and there is no package to build.

Two rules matter more than anything else here:

- **`description` is capped at 100 characters.** The longer `plugin.json` description
  will not fit; don't copy it over.
- **Published versions are immutable, and there is no unpublish.** A typo can only be
  fixed by publishing a *new* version string. Always run `mcp-publisher validate`
  first.

Deliberate omissions in `server.json` — please don't "fix" these:

- **No `headers` entry.** The server authenticates via OAuth (browser flow), and
  clients discover that from its protected-resource metadata. Declaring an
  `Authorization` header as required would make every client prompt for an API key
  and bypass OAuth. The Bearer-token path stays a documented headless/CI escape
  hatch, not registry metadata.
- **No `packages` array.** There is no package; the server is remote-only.

### Publishing an update

Bump `version` in `server.json` first — reuse of a published version is rejected.
Use `0.1.1-1`, `0.1.1-2`, … prerelease strings for registry-metadata-only changes so
you don't burn a patch release on a typo. Keep `version` in step with the three
`plugin.json` manifests (`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`) —
nothing in CI enforces this.

```bash
mcp-publisher validate

# Paste the hex key at the silent prompt, so it stays out of shell history.
read -rs MCP_KEY
mcp-publisher login dns --domain uptimerobot.com --private-key "$MCP_KEY"
unset MCP_KEY

mcp-publisher publish
mcp-publisher logout   # removes the saved token — run it even if publish fails
```

`mcp-publisher` (1.8.1) only accepts the key as `--private-key` — no prompt, environment
variable or key file — so never type it inline: it would land in your shell history. Run
this on your own machine; the key is briefly visible in the process list while the login
runs.

Verify with:

```bash
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=com.uptimerobot/uptimerobot"
```

### Namespace credential

The `com.uptimerobot/*` namespace is proven by an Ed25519 key whose public half is
published as a TXT record on the `uptimerobot.com` apex
(`v=MCPv1; k=ed25519; p=<public key>`, managed in Cloudflare). The private key
(`key.pem`) **lives in the team password manager** — keep it outside the repo (`key.pem` is gitignored only as a safety net). Paste its hex
form at the `read -rs` prompt above; don't put it in a script or a command line. Losing it
means losing the ability to publish updates under this namespace.

## Testing a change

Before opening a PR:

1. Lint the JSON: `python -c "import json,sys; [json.load(open(p)) for p in sys.argv[1:]]" .claude-plugin/plugin.json .cursor-plugin/plugin.json .codex-plugin/plugin.json hooks/hooks.json mcp.json .mcp.json codex.mcp.json server.json`.
   If you touched `server.json`, also run `mcp-publisher validate`.
2. Install the plugin locally in Claude Code and/or Cursor and verify the new
   skill/command/agent/rule loads and runs as expected.
3. Update `README.md` if you added a new top-level directory or convention.
