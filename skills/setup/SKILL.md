---
name: setup
description: Configure the UptimeRobot API key, OR diagnose why `uptimerobot:*` MCP tools aren't visible in the current session. Invoke this skill any time you cannot see UptimeRobot tools, before telling the user the MCP is misconfigured — Step 0 detects the most common case (server already connected, tools loaded after session start) and resolves it without re-keying. Also invoke on `-31001` auth errors or first-time setup.
tags: [setup, auth, api-key, configuration, onboarding]
---

# Setup UptimeRobot

Invoke this skill when:
- Any UptimeRobot tool returns `-31001 user_not_found`.
- The MCP server fails to connect or returns an authentication error.
- The user reports that UptimeRobot tools aren't working.
- The user explicitly asks to configure or reconfigure their API key.

---

## Step 0 — Check whether setup is already done

**Always run this step first.** It prevents the most common failure mode: looping the user through setup every session even though the MCP server is already configured and connected. The MCP connection sometimes finishes after the assistant's tool list is captured, so the absence of UptimeRobot tools at session start is *not* proof the key is missing.

Run:

```bash
claude mcp list 2>&1 | grep -i uptimerobot
```

Interpret the output:

- **A line containing `uptimerobot` and `✓ Connected`**: configuration already works. Do **not** ask for the API key. Tell the user:

  > Your UptimeRobot MCP server is already configured and connected (`claude mcp list` shows ✓). The tools aren't showing up in this session — that usually means the MCP connection finished after my tool list was captured.
  >
  > **To unblock this session:** fully quit Claude Code (close the terminal, not just `/exit`) and relaunch. The tools will be available from the start.
  >
  > **If you launched with `claude --plugin-dir .`:** that mode registers the plugin's `.mcp.json` (which uses `${user_config.api_key}` and only resolves when the plugin is installed via marketplace) on top of your saved local config, causing a conflict. Launch with just `claude` instead — the project's skills are still available without `--plugin-dir`.

  Then **stop this skill**. Do not proceed to Step 1.

- **A line containing `uptimerobot` and `✗ Failed to connect`**: the saved key is invalid or stale. Continue to Step 1 to collect a new one.

- **No `uptimerobot` line at all**: the server hasn't been configured yet. Continue to Step 1.

- **Multiple `uptimerobot` entries** (e.g. `claude.ai UptimeRobot` plus a plain `uptimerobot`): only the plain `uptimerobot` (HTTP) entry matters for this skill. The `claude.ai`-prefixed one is a separate cloud MCP server unrelated to this plugin.

---

## Step 1 — Explain the situation

Tell the user:

> It looks like your UptimeRobot API key isn't configured yet (or the current key is invalid). Let's fix that — it takes about a minute.

---

## Step 2 — Direct to the API key

Tell the user:

> Go to **[dashboard.uptimerobot.com/integrations](https://dashboard.uptimerobot.com/integrations)**, scroll to the **API** section, and copy your **Main API key**. If you don't have one yet, click **+ Create**.
>
> Use the **Main API key** — not a read-only key. Read-only keys block `create-monitor`, `update-monitor`, and other write operations.

Wait for the user to retrieve their key before continuing.

---

## Step 3 — Collect the key

Ask:

> Please paste your UptimeRobot API key so I can configure the connection.

Once the user provides the key, do **not** echo it back in full. Proceed immediately to Step 4.

---

## Step 4 — Configure the MCP server

Run via Bash, substituting the user's key:

```bash
claude mcp add uptimerobot --transport http https://mcp.uptimerobot.com/mcp \
  -H "Authorization: Bearer <KEY>"
```

If that fails because the server already exists in some scope, remove it from each scope it shows up in (the error message will list them) then re-add:

```bash
claude mcp remove uptimerobot -s local
claude mcp remove uptimerobot -s user   # only if the error mentioned user scope
claude mcp add uptimerobot --transport http https://mcp.uptimerobot.com/mcp \
  -H "Authorization: Bearer <KEY>"
```

Tell the user:
> API key saved. Now I'll verify the connection…

---

## Step 5 — Validate connectivity

Run `claude mcp list 2>&1 | grep uptimerobot` and confirm a line shows `✓ Connected`.

If yes, tell the user:

> Connected! Your key is saved at user/local scope and will persist across sessions and projects.
>
> **Important:** to use the UptimeRobot tools in this session, fully quit Claude Code (close the terminal) and relaunch. The newly-added MCP server is registered now, but its tools are loaded at session start.

Then optionally call `list-monitors` once tools are available in a fresh session — but do not block this skill on that.

---

## Step 6 — Handle validation failures

**`claude mcp list` still shows `✗ Failed`:**
1. Check for leading/trailing spaces in the key the user pasted.
2. Confirm they used the **Main API key** (not read-only).
3. Try regenerating the key in the dashboard and pasting the new one.

Restart from Step 3.

**`-31002 access_denied` when the user later runs a write operation:**
The key is valid but read-only. Tell the user:
> This is a read-only key — it can list monitors but can't create or modify them. Go back to the dashboard, find your **Main API key**, and paste it here.

Restart from Step 3.

**MCP server not reachable (network error):**
Tell the user:
> The UptimeRobot MCP server at `https://mcp.uptimerobot.com/mcp` isn't reachable right now. Check your internet connection and try again. If the issue persists, visit [uptimerobot.com/status](https://uptimerobot.com/status).

---

## Why am I being asked again?

If the user reports they've configured the key before but the skill keeps re-running every session, the cause is almost always one of these:

1. **MCP connection lag**: tools aren't in the assistant's tool list at session start because the MCP handshake hadn't completed yet. **Fix**: Step 0 detects this case and stops the skill from re-prompting.

2. **`--plugin-dir .` shadowing**: launching Claude Code with `--plugin-dir .` registers the plugin's `.mcp.json` (which uses `${user_config.api_key}` — only populated by marketplace install, not `--plugin-dir`). This shadows the working `claude mcp add` entry. **Fix**: launch Claude Code without `--plugin-dir .` once the key is saved via `claude mcp add`. Project-level skills/agents/rules are still picked up from the working directory.

3. **Stale or revoked key**: the key was rotated in the dashboard. **Fix**: re-collect via Step 3.

---

## Notes

- **Cursor users:** `claude mcp add` writes to the Claude Code config, not Cursor. For Cursor, set `UPTIMEROBOT_API_KEY=<key>` in your shell profile or `.env` file and restart Cursor — the project's `mcp.json` (no leading dot) reads `${env:UPTIMEROBOT_API_KEY}`.
- **Marketplace install path** (when this plugin ships to the Claude Code marketplace): users install via `claude plugin install uptimerobot@<marketplace>` and Claude Code prompts for the key via the `userConfig` block in `.claude-plugin/plugin.json`. No `claude mcp add` needed. This skill only handles the manual/dev path.

## Related

- `manage-monitors` — list and control monitors once connected.
- `errors` — full error code reference.
