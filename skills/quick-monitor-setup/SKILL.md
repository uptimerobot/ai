---
name: quick-monitor-setup
description: Create a free UptimeRobot HTTPS uptime monitor for someone using ONLY their email, no UptimeRobot account, no API key, and no MCP/OAuth. The agent calls an unauthenticated proof-of-work-gated API; the owner confirms with one click in an activation email. Use when a user wants monitoring but is not signed in to UptimeRobot and has no API key, the zero-setup path.
tags: [monitoring, http, create, uptimerobot, no-auth, agentic]
---

# Quick monitor setup (no account, email-only)

> **No MCP preflight needed.** Unlike the other UptimeRobot skills, this one does NOT use the `uptimerobot:*` MCP tools and does NOT require the user to authenticate. It is the path for when the user has no UptimeRobot account or API key. If the user IS already connected via the MCP server, prefer `create-http-monitor` instead.

Use this when a user says something like "monitor my site and email me if it goes down" but has no UptimeRobot account or API key. You (the agent) do steps 1-4; the site owner does step 5 from their inbox. The result is the standard free plan: 50 monitors, 5-minute checks, free forever, no credit card.

**The only thing the owner must provide is the email** where down and up alerts go. Use an inbox they actually check.

## Base URL

```text
https://api.uptimerobot.com
```

## Step 1: Request a proof-of-work challenge

```http
GET /agentic/agent-monitor/challenge?email=<owner-email>&url=<site>
```

- `url`: the website to monitor. A bare domain works (`www.example.com`); `https://` is assumed if you omit the scheme, so `example.com` is treated as `https://example.com`. Give an explicit `http://` only if you specifically need plain HTTP.
- Returns: `{ "nonce": "<hex>", "timestamp": <ms>, "difficulty": <bits>, "signature": "<hex>" }`.
- Read `difficulty` from the response. Never hardcode it.

## Step 2: Solve the proof of work

Find a `counter` such that `SHA-256("<nonce>|<counter>")` has at least `difficulty` leading zero bits (pipe-separated, no spaces).

```python
import hashlib
counter = 0
while True:
    h = hashlib.sha256(f"{nonce}|{counter}".encode()).digest()
    zeros = 0
    for b in h:
        if b == 0:
            zeros += 8
        else:
            zeros += 8 - b.bit_length()
            break
    if zeros >= difficulty:
        break
    counter += 1
```

## Step 3: Submit the monitor request

```http
POST /agentic/agent-monitor
Content-Type: application/json

{
  "email": "<owner-email>",
  "url": "<same url you sent in step 1>",
  "nonce": "<from challenge>",
  "timestamp": <from challenge>,
  "counter": <your solution>,
  "signature": "<from challenge>"
}
```

Send the **same `url`** you used in step 1 (the signature is bound to it). Most responses return a uniform `HTTP 200 { "status": "ok", ... }` whether accepted or silently rejected (this is deliberate, it prevents probing who has an account). The one exception: an invalid proof of work returns `HTTP 400 { "code": "INVALID_PROOF_OF_WORK" }`, re-request a fresh challenge and solve again.

## Step 4: Tell the user to check their inbox

Tell the owner: "Check your inbox for an activation email from UptimeRobot and click the link to activate your monitor." No monitor exists until they do.

## Step 5: Owner activates (they do this, not you)

The owner clicks the activation link, lands on a confirmation page, and presses **Activate**. Only then are the account and monitor created. The link expires in 24h.

## Response contract (quick reference)

| Status | Meaning |
|--------|---------|
| `200` on submit | Accepted, or silently rejected (same body). Tell the user to check their inbox. |
| `400 INVALID_PROOF_OF_WORK` on submit | Re-request a challenge and re-solve. |
| `400 INVALID_URL` on challenge | The `url` was not a usable web address (empty or a non-http scheme). Fix it and retry. |
| activation link | The browser GET shows a confirm page for a valid token; the POST (the owner's click) creates everything. |

## Notes

- One monitor per (email, site); duplicates are silently ignored.
- HTTPS monitor, 5-minute interval, on the free plan.
- Full human-readable reference: https://uptimerobot.com/quick-monitor-setup/

## Related

- `create-http-monitor`: use this instead when the user IS connected via the UptimeRobot MCP server (it creates any monitor type on their existing account).
- `setup`: connect and authenticate the MCP server if the user wants the full toolset.
