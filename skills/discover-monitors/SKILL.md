---
name: discover-monitors
description: Scan the current project/repo for monitorable resources — public pages, GET/HTTP API endpoints, health checks, and cron/scheduled jobs — then propose and create UptimeRobot monitors after confirmation. Use for onboarding a codebase into UptimeRobot.
tags: [onboarding, discovery, scan, create, monitoring, uptimerobot]
---

# Discover monitors for a project

> **Preflight — read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured — `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

Use this when the user has installed the plugin into a repo and wants to know **what to monitor** — "set up monitoring for this project", "what should I be monitoring here?", "onboard this codebase into UptimeRobot". This skill walks the codebase, classifies monitorable resources, resolves their live URLs, proposes a plan, and creates monitors **only after the user confirms**.

The flow is always: **scan → resolve URLs → reduce by failure domain → propose (no writes) → confirm → create**. Never create monitors before the proposal is approved.

The detection-pattern catalog (per-framework globs and grep patterns) lives in [`reference.md`](reference.md). Consult it while scanning rather than reproducing the patterns here.

## Step 1 — Scan the repo for candidate resources

Use read-only tools (Glob / Grep / Read) from the project root. Classify findings into three buckets (see [`reference.md`](reference.md) for the full pattern list per framework):

- **Public / main pages** → collect as page **candidates** (not one monitor each). Frontend route/page directories (Next.js `app/` & `pages/`, Astro/Nuxt/SvelteKit), static `index.html`, `sitemap.xml`, `robots.txt`, server-rendered route maps (Rails `config/routes.rb`, Django `urls.py`). Finding 12 pages does **not** mean 12 monitors — Step 3 reduces these by failure domain before anything is proposed.
- **HTTP API endpoints — GET only for now** → candidate **HTTP** monitors (or an **API** monitor when there's a JSON/header response worth asserting on, or **KEYWORD** for a single body string). Route declarations such as Express/Fastify `app.get(...)`, Next.js route handlers exporting `GET`, FastAPI `@app.get`, Flask `@app.route(..., methods=["GET"])`, Spring `@GetMapping`, Go `http.HandleFunc` / chi / gin. As you find each route, tag its **probeability**:
  - **public** — no auth, GET, safe to hit repeatedly. Directly monitorable.
  - **protected** — read-only and safe to GET, but requires an auth header. Monitorable *only* with a supplied token (see Step 5); otherwise skip.
  - **not-probeable** — mutating (POST/PUT/PATCH/DELETE) or a Bearer-protected cron route. These are **not** API-monitor candidates — cron routes go to HEARTBEAT, mutations are skipped.
  - **API vs HTTP** is just: do we have a response body worth asserting on? If yes → **API** monitor (JSONPath/header check); if it's only "is it up" → **HTTP**.
  - **Flag health endpoints as highest priority**: `/health`, `/healthz`, `/ready`, `/readyz`, `/livez`, `/status`, `/ping`, `/api/health`. These are the single most valuable thing to monitor.
  - **Ignore non-GET routes** (POST/PUT/PATCH/DELETE) — they usually mutate state and are not safe to probe on an interval.
- **Cron / scheduled jobs** → candidate **HEARTBEAT** monitors. `crontab` / `*.cron` files, GitHub Actions `schedule:` cron, Kubernetes `CronJob`, systemd `*.timer`, `node-cron` / `node-schedule`, Celery beat schedules, `vercel.json` `crons`, cloud scheduler configs, and **database schedulers** like Postgres `pg_cron` (`cron.schedule(...)` in `*.sql` / Supabase migrations). An empty `vercel.json` `crons: []` does **not** mean there are no jobs — also grep `*.sql` for `cron.schedule` / `pg_cron`. Jobs that fire by POSTing to a Bearer/secret-protected `/api/cron/*` route are HEARTBEAT candidates, not HTTP (a probe gets 401 and would run real work).

Keep a working list of `{ resource, bucket, path-or-route, source file, cron cadence if any }`.

## Step 2 — Resolve live / base URLs (hybrid)

Code defines route *paths* (`/api/health`), not the deployed *base URL*. Resolve them like this:

1. **Try to infer** the production base URL(s) from the repo:
   - `.env*` / `.env.example` keys like `BASE_URL`, `PUBLIC_URL`, `SITE_URL`, `API_URL`, `NEXT_PUBLIC_*_URL`, `VERCEL_URL`.
   - Deployment configs: `vercel.json`, `netlify.toml`, `render.yaml`, `fly.toml`, Docker/compose host hints.
   - `package.json` `homepage`, README badges/links, CI deploy steps.
2. **Skip local hosts** as production targets: `localhost`, `127.0.0.1`, `0.0.0.0`, `*.local`, anything on a dev port. Never propose a monitor for these.
3. **If you inferred a base URL → confirm it** with the user before composing full URLs ("I found `https://app.example.com` in `vercel.json` — is that the production URL, and is there a separate staging/API host?"). Use `AskUserQuestion` or a plain prompt.
4. **If you could not infer one → ask** the user to enter the production base URL(s) and which stage (prod / staging).

Map each route path onto the confirmed base(s) to build full `https://…` URLs. Cron jobs become HEARTBEAT monitors and need **no** base URL.

## Step 3 — Reduce candidates by failure domain

This is the step that keeps the plan smart instead of noisy. Pages and routes that share a host and deploy have **shared fate** — they go down together. Monitoring six marketing pages on one Vercel app is 6× the cost for 1× the signal: a single static page almost never fails while the host is up. So before proposing anything, collapse candidates down.

1. **Bucket every candidate into a failure domain** — the set of resources that fail together. Approximate it by `host + hosting platform + render path (static/SSG vs SSR/dynamic) + backing service`. Static pages on the same frontend deploy are **one** domain. An API on a different host, a separate worker/service, or an SSR route hitting a different backend each form their **own** domain.

2. **Pick ONE representative per domain**, choosing the most diagnostic probe available, in this order:
   1. A **health endpoint** that exercises app + DB/dependencies — best signal.
   2. A **dynamic / data-backed GET route** — its failure reflects backend health.
   3. The **homepage** as a last-resort liveness check — proves only that the host/deploy serves HTML.

3. **Add a second monitor in a domain only for a genuinely independent failure mode** — e.g. an SSR checkout route that depends on a third-party/payment API the health check doesn't touch. "It's an important page" is not, by itself, an independent failure mode.

4. **Do not enumerate marketing / static pages.** One representative liveness monitor per web deploy is enough.

**No health endpoint, only static pages?** Propose a single homepage monitor — prefer a **KEYWORD** monitor asserting real on-page text (e.g. a headline or nav label) over a bare `200`, so a blank or 500 shell is still caught. Then **explicitly tell the user** that a static `200` is weak signal and recommend they add a `/health` route that touches the DB/backend for true liveness. (KEYWORD recipe: [`create-keyword-monitor`](../create-keyword-monitor/SKILL.md).)

**API endpoints — be explicit, don't go silent.** Decide each API domain's representative the same way, but reason about it out loud:

- A **public** GET API with an assertable body → make it an **API** monitor (e.g. `$.status == "ok"`) rather than a bare HTTP 200 check — it catches more.
- **No publicly probeable API** (every API route is auth-gated, POST, or an internal cron route) → create **no** API monitor, but **say so**: e.g. *"Found 7 API routes but none are publicly probeable (all Bearer-protected or POST), so I didn't create an API monitor."* Then recommend adding a public `/health` route that touches the backend — the same weak-signal logic as the no-health-page case above. Don't leave the user guessing whether APIs were considered.
- A **protected** read-only endpoint the user wants covered → offer the authenticated path in Step 5 (token supplied by the user, stored in UptimeRobot).

**Worked example.** Candidates `/`, `/login`, `/pricing`, `/about` all serve from one Vercel deploy, no health endpoint → propose **1** monitor (homepage, KEYWORD-asserted) + flag the missing health check. Add `example.com` web + `api.example.com` API → **2** monitors: homepage liveness + API health. Not four, not six.

## Step 4 — Propose a monitoring plan (no writes yet)

First, call `list-monitors` (paginate per `conventions`) and **drop any resource that is already monitored** so re-runs don't create duplicates. Optionally call `list-integrations` so you can offer alert contacts in the proposal.

Then present a Markdown table — and create nothing yet:

| Resource | Type | Name | URL / target | Interval | Notes |
| -- | -- | -- | -- | -- | -- |
| `/api/health` | HTTP | `acme-api · health` | `https://api.acme.com/health` | 60s | Highest priority |
| Homepage | HTTP | `acme-web · homepage` | `https://acme.com` | 300s | |
| Nightly backup (cron `0 3 * * *`) | HEARTBEAT | `acme · nightly-backup` | _generated on create_ | 86400s | grace 1800s |

Guidance for the proposal:

- **Defaults**: health endpoints `60`s; main pages / APIs `300`s. **Every heartbeat must set both `interval` and `gracePeriod`** — `interval` = seconds between expected pings (from the cron cadence: `*/5 * * * *` → 300, `0 1 * * *` → 86400); `gracePeriod` = slack to absorb the job's normal runtime so a slow-but-fine run doesn't false-alarm (a few minutes for short jobs, longer for heavy ones). Show both in the proposal table.
- **Keep it lean.** Propose only the Step 3 representatives — one liveness monitor per failure domain, preferring the most diagnostic probe. Don't propose a monitor per GET route or per page; monitoring everything burns plan limits and creates noise for no extra signal.
- **Tags**: derive from the repo / service name so the user can group them later.
- If the proposed count is large relative to typical plan limits, say so and recommend trimming before you create anything (`-28001` / `-28002` are not retryable — see `errors`).

## Step 5 — Confirm, then create

Only after the user approves the table, create each monitor with `create-monitor`. **Do not duplicate payload rules** — defer to the per-type skills for exact parameters:

- HTTP pages & endpoints → [`create-http-monitor`](../create-http-monitor/SKILL.md)
- Health checks with a body assertion → [`create-keyword-monitor`](../create-keyword-monitor/SKILL.md) or [`create-api-monitor`](../create-api-monitor/SKILL.md)
- Cron / scheduled jobs → [`create-heartbeat-monitor`](../create-heartbeat-monitor/SKILL.md)

Follow [`conventions`](../conventions/SKILL.md) throughout: pass `type` as a string enum, never send `url` on a HEARTBEAT, and call `get-monitor-details` after each write to confirm the stored config before reporting success. **For heartbeats, the verify step must confirm both `interval` and `gracePeriod` are stored** — a heartbeat created without them isn't really monitoring anything.

### Monitoring a protected (read-only) endpoint

If the user opts to monitor a protected but safe-to-GET endpoint, create an HTTP or API monitor with auth — `authType: "BEARER"` + the token, or a `customHttpHeaders` entry (param details in [`create-api-monitor`](../create-api-monitor/SKILL.md) / [`create-http-monitor`](../create-http-monitor/SKILL.md)). Before doing so:

- **Warn that the token is stored in UptimeRobot's monitor config** — it leaves the repo. Let the user decide.
- **Have the user paste the token**; don't lift a secret out of the repo and ship it to UptimeRobot on your own initiative. Never echo it back in output.
- This applies only to **read-only** protected routes. Bearer-protected **cron / mutation** routes stay HEARTBEAT — a probe would 401 and run real work.

### Wiring heartbeats into the codebase

A heartbeat monitor does nothing until the job actually pings the generated URL. Don't just print a snippet — offer to wire it in. Confirm with the user whether they want **create + wire** (edit the code) or **create only** (you hand them the snippet); honor that choice.

For each heartbeat, the order is fixed because the URL doesn't exist until creation:

1. **Create** the monitor → capture the generated URL from the response.
2. **Wire the ping into the job's success path** — edit the actual job code:
   - **Only after the real work succeeds.** Never ping at the start, or unconditionally — that defeats the monitor (it would report healthy even when the job throws). On failure, skip the ping and let UptimeRobot raise the incident after `interval + gracePeriod`.
   - **Make the ping non-fatal** — wrap it so a heartbeat hiccup never breaks the job itself.
   - **Don't hardcode the URL where the repo expects config** — if the project uses env vars / secrets, add it as one (e.g. `HEARTBEAT_URL_<JOB>`) and reference that.
   - Match the job's shape:
     - **Shell / cron job** → append after the command, guarded on success: `<job> && curl -fsS --retry 3 "$HEARTBEAT_URL" > /dev/null`
     - **HTTP-invoked job** (e.g. a pg_cron / scheduler that POSTs to an `/api/cron/*` route) → ping from the **end of the route handler, after the work resolves successfully**, not from the SQL/scheduler side:
       ```ts
       // after the queue work has completed without throwing
       try { await fetch(process.env.HEARTBEAT_URL_CRAWL_TICK!); } catch {}
       ```
     - **GitHub Actions** → add a final step with `if: success()` that curls the URL.
3. **Confirm the edit** back to the user and note that the ping starts only **after they deploy** the change.

If the user chose create-only, give them the guarded snippet above and clearly mark the job as **not yet wired**.

Finish with a short summary: what was created, what was skipped (already monitored), which heartbeats were **wired** (and need a deploy), and any left **unwired** for the user to handle.

## Common mistakes

- Proposing monitors for `localhost` / dev ports instead of the deployed host.
- Proposing multiple pages that share a host/deploy (shared fate) — they go down together; one representative liveness monitor per failure domain is enough.
- Monitoring every GET route instead of one diagnostic representative per failure domain — wasteful and noisy.
- Picking the static homepage when a health check or data-backed route exists — a `200` on a static page won't catch backend/DB outages.
- Creating monitors before the base URL is confirmed or before the user approves the plan.
- Treating POST/PUT/PATCH/DELETE routes as monitorable — only GET endpoints are safe to probe.
- Silently creating no API monitor when APIs exist — say *why* (auth-gated / POST / internal) and recommend a public health endpoint.
- Treating every Bearer-protected route as un-monitorable — read-only ones can be monitored with an auth header; only cron / mutation routes must stay HEARTBEAT.
- Putting a token into a monitor without flagging that it's stored in UptimeRobot, or lifting a secret from the repo instead of having the user paste it.
- Sending `url` on a HEARTBEAT monitor (`-29001`) — the server generates it.
- Creating a heartbeat without setting **both** `interval` and `gracePeriod` — defaults won't match the job's schedule, so it never alerts correctly. Verify both are stored.
- Printing the heartbeat URL but never wiring it into the job — the monitor will false-alarm immediately. Wire it (or clearly mark it unwired).
- Pinging at the start of the job, unconditionally, or in a way that can throw — the ping must fire only **after** the work succeeds and must be non-fatal.
- Ignoring plan limits: don't retry `-28001` / `-28002`; trim the plan and tell the user.
- Re-creating monitors that already exist — always pre-check with `list-monitors`.

## Related

- [`setup`](../setup/SKILL.md) — connect / authenticate the MCP server first.
- [`conventions`](../conventions/SKILL.md) — type rules, discovery-before-writes, verification.
- [`create-http-monitor`](../create-http-monitor/SKILL.md), [`create-keyword-monitor`](../create-keyword-monitor/SKILL.md), [`create-api-monitor`](../create-api-monitor/SKILL.md), [`create-heartbeat-monitor`](../create-heartbeat-monitor/SKILL.md) — per-type create recipes.
- [`list-integrations`](../list-integrations/SKILL.md) — find alert-contact IDs to attach.
- [`manage-monitors`](../manage-monitors/SKILL.md) — list, inspect, pause/resume after onboarding.
