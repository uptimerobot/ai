---
name: setup
description: Connect and authenticate the hosted UptimeRobot MCP server (OAuth over streamable HTTP), OR diagnose why UptimeRobot MCP tools (any tool whose name contains `uptimerobot`) aren't available in the current session. Invoke this skill when no such tools exist even after loading deferred tools, before telling the user the MCP is misconfigured — Step 0 detects the most common case (server already connected, tools loaded after session start) and resolves it without re-authenticating. Also invoke on plain-text auth errors (unauthorized, unauthenticated, token expired / invalid) or first-time setup.
tags: [setup, auth, oauth, configuration, onboarding]
---

# Setup UptimeRobot

The UptimeRobot MCP server authenticates with **OAuth**. The plugin connects
directly to the hosted server at `https://mcp.uptimerobot.com/mcp` over
streamable HTTP — nothing runs locally. The client discovers the server's OAuth
endpoints and opens a browser where the user logs into UptimeRobot and authorizes
access. There is no API key to paste — the client stores the tokens itself.

Invoke this skill when:
- Any UptimeRobot tool returns an auth error — e.g. a message that mentions `unauthorized`, `unauthenticated`, `Invalid API key`, or a token that is expired, invalid, or missing (the OAuth grant is missing, expired, or revoked).
- The MCP server fails to connect or returns an authentication error.
- The user reports that UptimeRobot tools aren't working.
- The user explicitly asks to connect or reconfigure UptimeRobot.

If the server was set up with an API-key `Authorization` header (headless / CI — see the README) and returns `Invalid API key`, the steps below won't help: tell the user the key is invalid or revoked, and to replace it in the environment variable their MCP config reads (never paste the key into the config file itself), then reconnect.

---

## Step 0 — Check whether setup is already done

**Run this step first when the UptimeRobot tools are missing** (Claude Code only — in Cursor or Codex, skip to that client's setup in the README). If you came here because a tool returned an auth error, the server is connected — go straight to **Step 3**. This step prevents the most common failure mode: looping
the user through setup every session even though the MCP server is already
configured and connected. The MCP connection sometimes finishes after the
assistant's tool list is captured, so the absence of UptimeRobot tools at session
start is *not* proof the server is unconfigured.

Run:

```bash
claude mcp list 2>&1 | grep -i uptimerobot
```

Interpret the output:

- **A line containing `uptimerobot` and `✓ Connected`**: configuration already works and the OAuth grant is valid. Do **not** re-authenticate. First check whether the tools are listed under another name or only need loading (see the preflight) — if so, use them. Otherwise tell the user:

  > Your UptimeRobot MCP server is already configured and connected (`claude mcp list` shows ✓). The tools aren't showing up in this session — that usually means the MCP connection finished after my tool list was captured.
  >
  > **To unblock this session:** fully quit Claude Code (close the terminal, not just `/exit`) and relaunch. The tools will be available from the start.

  Then **stop this skill**. Do not proceed.

- **A line containing `uptimerobot` and `! Needs authentication`**: the server is registered but the user hasn't authorized yet. Go to **Step 2 (Authenticate)**.

- **A line containing `uptimerobot` and `✗ Failed to connect`**: the server is registered but the OAuth grant is stale/expired, or the server isn't reachable. Go to **Step 3 (Re-authenticate)**.

- **No `uptimerobot` line at all**: the server hasn't been registered yet. Go to **Step 1**.

- **Multiple `uptimerobot` entries** (e.g. `claude.ai UptimeRobot`, `plugin:uptimerobot:uptimerobot`, or a plain `uptimerobot`): they all point at the same hosted server. If any of them is `✓ Connected`, its tools work — use them.

---

## Step 1 — Register the server (manual / dev path only)

If the user installed this plugin from the marketplace (Claude Code) or via the
Cursor plugin, the server auto-registers from `.mcp.json` / `mcp.json` — skip to
Step 2.

For a manual / scripted setup, register the hosted server:

```bash
claude mcp add --transport http uptimerobot https://mcp.uptimerobot.com/mcp
```

If it fails because the server already exists in some scope, remove it from each
scope the error lists, then re-add:

```bash
claude mcp remove uptimerobot -s local
claude mcp remove uptimerobot -s user   # only if the error mentioned user scope
claude mcp add --transport http uptimerobot https://mcp.uptimerobot.com/mcp
```

---

## Step 2 — Authenticate (OAuth browser flow)

The user authorizes from inside Claude Code. Tell the user:

> Run `/mcp`, select **uptimerobot**, and choose **Authenticate**. A browser opens
> where you log into UptimeRobot and authorize access — there's no API key to
> paste. If the browser doesn't open, copy the URL `/mcp` shows and open it
> manually.

Then confirm connectivity with Step 4.

---

## Step 3 — Re-authenticate (fix a stale or revoked grant)

Use this when a tool returns an unauthorized / token-expired message, when `claude mcp list` shows
`✗ Failed to connect`, or when the user revoked access. Tell the user:

> Run `/mcp`, select **uptimerobot**, and choose **Clear authentication**. Then
> choose **Authenticate** to reopen the browser, log in, and re-authorize.

Then confirm connectivity with Step 4.

---

## Step 4 — Validate connectivity

Run `claude mcp list 2>&1 | grep -i uptimerobot` and confirm a line shows
`✓ Connected`.

If yes, tell the user:

> Connected! The authorization is cached locally and persists across sessions and
> projects.
>
> **Important:** if the UptimeRobot tools weren't available in this session, fully
> quit Claude Code (close the terminal) and relaunch — tools are loaded at session
> start. If they were already available and you only re-authorized (Step 3), retry
> the original call instead; no restart is needed.

Then optionally call `list-monitors` once tools are available in a fresh session —
but do not block this skill on that.

---

## Step 5 — Handle validation failures

**`claude mcp list` still shows `✗ Failed`:**
1. Confirm the browser flow completed — the user must finish authorizing in the browser. Re-run Step 3 to force a fresh attempt.
2. If the authorization page errored, have the user retry; if it persists, the account may lack access — see the access-denied note below.

**`requires roles` or `Write operations not permitted` when the user later runs a write operation** (a bare `Access denied` usually means a wrong ID — check `get-user` first; if the session can write, don't re-authenticate):
The authorized account doesn't have write permission for that action (in a team account, `delete-monitor`, `delete-tag` and `update-storm-protection-settings` are admin-only). Tell the user
to authorize with an account that has write access, then re-run Step 3 to
re-authenticate. If the server is set up with an API-key header (headless / CI), re-authenticating won't help: the key is read-only — the user must put a Main API key in the environment variable their MCP config reads.

**MCP server not reachable (network error):**
Tell the user:
> The UptimeRobot MCP server at `https://mcp.uptimerobot.com/mcp` isn't reachable right now. Check your internet connection and try again. If the issue persists, visit [uptimerobot.com/status](https://uptimerobot.com/status).

---

## Why am I being asked again?

If the user reports they've connected before but the skill keeps re-running every
session, the cause is almost always one of these:

1. **MCP connection lag**: tools aren't in the assistant's tool list at session start because the MCP handshake hadn't completed yet. **Fix**: Step 0 detects this case and stops the skill from re-prompting.

2. **Expired or revoked OAuth grant**: the cached token expired or access was revoked in the dashboard. **Fix**: re-authenticate via Step 3.

---

## Notes

- **Cursor users:** the project's `mcp.json` registers the same hosted server.
  Reload Cursor and complete the OAuth browser flow when prompted — no API key is
  needed.
- **Marketplace / plugin install path:** the server auto-registers from
  `.mcp.json` (Claude Code) or `mcp.json` (Cursor). Users only need to complete
  the OAuth browser flow on first connection — no `claude mcp add` required. This
  skill's Step 1 only applies to the manual/dev path.

### Advanced — headless / CI (no browser)

The OAuth browser flow can't run in headless environments (CI, dev-containers).
For that case, point the user to the **Headless / CI** section of the repo
[README](../../README.md#headless--ci-no-browser). It is a manual config the user
writes themselves; this skill never reads, writes, or asks for an API key.

## Related

- `manage-monitors` — list and control monitors once connected.
- `errors` — what each error message means and how to recover.
