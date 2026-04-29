---
name: setup
description: Configure the UptimeRobot API key — invoked automatically when any tool returns -31001 (auth failure) or when the user hasn't set up their key yet. Walks the user through getting their Main API key from the dashboard, configures it, and validates the connection.
tags: [setup, auth, api-key, configuration, onboarding]
---

# Setup UptimeRobot

Invoke this skill when:
- Any UptimeRobot tool returns `-31001 user_not_found`.
- The MCP server fails to connect or returns an authentication error.
- The user reports that UptimeRobot tools aren't working.
- The user explicitly asks to configure or reconfigure their API key.

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

Run the following via Bash, substituting the user's key:

```bash
claude mcp add uptimerobot --transport http https://mcp.uptimerobot.com/mcp \
  -H "Authorization: Bearer <KEY>"
```

If that fails because the server already exists, remove it first then re-add:

```bash
claude mcp remove uptimerobot
claude mcp add uptimerobot --transport http https://mcp.uptimerobot.com/mcp \
  -H "Authorization: Bearer <KEY>"
```

Tell the user:
> API key saved. Now I'll verify the connection…

---

## Step 5 — Validate connectivity

Call `list-monitors` with no filters. A successful response (even an empty monitor list) confirms the key works.

On success, tell the user:

> Connected! [If monitors exist: "I can see N monitor(s) on your account." Otherwise: "Your account is empty — you're ready to create your first monitor."]

---

## Step 6 — Handle validation failures

**Still `-31001` after configuring:**
The key was saved but is still rejected. Ask the user to:
1. Check for leading/trailing spaces in the key they pasted.
2. Confirm they used the **Main API key** (not read-only).
3. Try regenerating the key in the dashboard and pasting the new one.

Restart from Step 3.

**`-31002 access_denied`:**
The key is valid but read-only. Tell the user:
> This is a read-only key — it can list monitors but can't create or modify them. Go back to the dashboard, find your **Main API key**, and paste it here.

Restart from Step 3.

**MCP server not reachable (network error):**
Tell the user:
> The UptimeRobot MCP server at `https://mcp.uptimerobot.com/mcp` isn't reachable right now. Check your internet connection and try again. If the issue persists, visit [uptimerobot.com/status](https://uptimerobot.com/status).

---

## Notes

- **Cursor users:** `claude mcp add` writes to the Claude Code config, not Cursor. For Cursor, set `UPTIMEROBOT_API_KEY=<key>` in your shell profile or `.env` file and restart Cursor.
- After running `claude mcp add`, the updated config takes effect in the current session — no restart needed.

## Related

- `manage-monitors` — list and control monitors once connected.
- `errors` — full error code reference.
