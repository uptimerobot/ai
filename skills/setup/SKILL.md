---
name: setup
description: Connect or reconnect the hosted UptimeRobot MCP server, or work out why UptimeRobot MCP tools (any tool whose name contains `uptimerobot`) are missing or fail with an auth error (unauthorized, unauthenticated, token expired or invalid). Use for first-time setup, and before telling the user the UptimeRobot connection is broken.
tags: [setup, auth, oauth, configuration, onboarding]
---

# Set up UptimeRobot

These are the UptimeRobot facts you need. Add, sign in to and restart MCP servers the way your app does it; check its help if you're unsure.

- **Server:** name `uptimerobot`, URL `https://mcp.uptimerobot.com/mcp`, streamable HTTP.
- **Sign-in:** OAuth in the browser. Never ask the user for an API key or token.
- **Plugin installs:** if this plugin is installed, the server is already registered. Don't add a second copy.
- **Tools missing:** if your app loads tools on demand, search for them first. If the server shows as connected but its tools are still missing, the session started before it connected: ask the user to restart the session. Re-authorizing won't help.
- **Auth error:** re-authorize the server, then retry the original call. On `account_changed`, `owner_terminated` or `membership_removed`, the team account or membership changed: the user picks the account again while re-authorizing.
- **Can't write** (`requires roles`, `Write operations not permitted`): re-authorize with an account that can write, or ask the account owner.
- **No browser** (CI, headless): the server also accepts an `Authorization: Bearer <UptimeRobot API key>` header from a **Main** (read and write) or **Read-only** API key. The user configures it, keeping the key in an environment variable. Never read, write or ask for the key yourself. If that key is invalid or read-only, re-authorizing can't fix it: the user replaces the key.
- **Server unreachable:** tell the user to check their connection and [uptimerobot.com/status](https://uptimerobot.com/status), and try again later.
- **When it works:** call `get-user` and tell the user which account the session acts on and whether it can make changes.

## Related

- [`errors`](../errors/SKILL.md) — what each error message means and how to recover.
- [`manage-monitors`](../manage-monitors/SKILL.md) — list and control monitors once connected.
