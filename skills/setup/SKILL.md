---
name: setup
description: Configure the UptimeRobot MCP server by providing your API key. Only needed if the plugin was installed without using the in-app userConfig prompt (e.g. direct .mcp.json registration).
disable-model-invocation: true
---

# Setup UptimeRobot

If you installed the plugin from the marketplace, Claude Code already prompted you for your API key at enable time and stored it securely — you don't need this skill.

Use this skill only when you're registering the MCP server manually outside the plugin (for example, scripting `claude mcp add` in CI).

## Step 1 — Get your API key

Go to [dashboard.uptimerobot.com/integrations](https://dashboard.uptimerobot.com/integrations) → **API** → **Main API key** → **+ Create**.

## Step 2 — Add the MCP server

```bash
claude mcp add uptimerobot --transport http https://mcp.uptimerobot.com/mcp \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Step 3 — Restart Claude Code

Quit and relaunch. Run `/plugin` to confirm `uptimerobot MCP Server` shows ✓ connected.

## Common mistakes

- Using a read-only API key — write operations like `create-monitor` will return `-31002 access_denied`. Use the **Main API Key**.
- Forgetting to restart after running `claude mcp add` — the server won't appear until next session.

## Related

- `manage-monitors` — list and update monitors once connected.
- `errors` — for auth error codes like `-31002`.
