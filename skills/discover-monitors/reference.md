# discover-monitors — detection reference

Detection patterns for the `discover-monitors` skill, kept out of `SKILL.md` for readability. These are heuristics — they find *candidates*. Always confirm URLs and prune the list with the user before creating anything.

Run searches from the project root with Glob (file discovery) and Grep (content match). Skip `node_modules/`, `vendor/`, `dist/`, `build/`, `.next/`, `.git/`, and other dependency/build dirs.

---

## 0. Selecting monitors: failure domains & diagnostic value

Detection finds *candidates*. Selection decides which candidates become monitors — this is where the plan stays lean. The core idea: resources that fail together don't each need a monitor.

**Failure domain** = the set of resources that go down together. Approximate it by:

`host + hosting platform + render path (static/SSG vs SSR/dynamic) + backing service`

All static pages on one frontend deploy share a domain. An API on a separate host, a separate worker/service, or an SSR route hitting a different backend each form their own domain.

**Pick one representative per domain**, ranked by how much it actually exercises:

| Rank | Probe | Catches | Use when |
| -- | -- | -- | -- |
| 1 | Health endpoint (`/health` etc. that touches app + DB) | Backend, DB, dependency outages | Available |
| 2 | Dynamic / data-backed GET route | Backend/DB outage behind a real page | No health endpoint |
| 3 | Homepage (static) — ideally KEYWORD-asserted | Host/CDN/deploy down, blank/500 shell | Nothing deeper exists |

Rules:

- **Collapse static pages on one deploy to a single monitor.** Six marketing pages on one host = 6× cost, 1× signal.
- **Prefer a deeper probe over a shallower one** in the same domain — a health check beats the homepage.
- **Only add a second monitor in a domain for a genuinely independent failure mode** (e.g. checkout depending on a payment API the health check doesn't cover). "Important page" alone doesn't qualify.
- **No health endpoint?** Propose the homepage as a KEYWORD monitor (assert real on-page text, not a bare `200`) and recommend the user add a `/health` route that checks the backend.

---

## 1. Public / main pages → HTTP monitors

| Framework / signal | Where to look | What it yields |
| -- | -- | -- |
| Next.js (App Router) | `app/**/page.{tsx,jsx,ts,js}` | A page route per `page.*` (folder path = URL path; `(group)` segments are stripped) |
| Next.js (Pages Router) | `pages/**/*.{tsx,jsx,ts,js}` excluding `pages/api/**` and `_*.*` | Route per file |
| Nuxt | `pages/**/*.vue` | Route per file |
| SvelteKit | `src/routes/**/+page.svelte` | Route per `+page` |
| Astro | `src/pages/**/*.{astro,md,mdx}` | Route per file |
| Remix | `app/routes/**/*.{tsx,jsx}` | Route per file |
| Static site | `index.html`, `public/index.html`, `sitemap.xml`, `robots.txt` | Site root + sitemap URLs |
| Rails | `config/routes.rb` (`get '...'`, `resources :...`, `root '...'`) | Server-rendered routes |
| Django | `**/urls.py` (`path(...)`, `re_path(...)`) | Server-rendered routes |
| Laravel | `routes/web.php` (`Route::get(...)`) | Server-rendered routes |

`sitemap.xml` is the highest-signal source of public pages when present — prefer the homepage + a couple of key pages over every entry.

---

## 2. HTTP API endpoints (GET only) → HTTP / KEYWORD / API monitors

Only **GET** routes are safe to probe on an interval. Ignore POST/PUT/PATCH/DELETE.

| Stack | Grep pattern (GET routes) |
| -- | -- |
| Express / Fastify / Koa router | `\.get\(\s*['"\`]` |
| Next.js route handlers | `export\s+(async\s+)?function\s+GET` or `export\s+const\s+GET` in `app/**/route.{ts,js}` and `pages/api/**` |
| NestJS | `@Get\(` |
| FastAPI / Starlette | `@(app\|router)\.(get)\(` |
| Flask | `@app\.route\(.*methods\s*=\s*\[[^]]*["']GET["']` and bare `@app.get(` |
| Django REST | `path\(` mapping to a `RetrieveAPIView` / `ListAPIView` / `@api_view(['GET'])` |
| Spring | `@GetMapping\(` or `@RequestMapping\(.*method\s*=\s*RequestMethod\.GET` |
| Go net/http | `\.HandleFunc\(` / chi `r\.Get\(` / gin `\.GET\(` / echo `\.GET\(` |
| Rails API | `config/routes.rb` `get '...'` |
| GraphQL | a single `/graphql` endpoint — monitor its health/`__typename` query, not individual resolvers |

### Health endpoints — highest priority

Grep route paths for: `health`, `healthz`, `livez`, `readyz`, `ready`, `status`, `ping`, `heartbeat`, `/api/health`, `/-/healthy`, `/actuator/health` (Spring), `/_health`. A dedicated health endpoint is the single most valuable monitor for a service — always propose it first.

If the health endpoint returns a known body (e.g. `{"status":"ok"}` or the literal `OK`), prefer a **KEYWORD** monitor (assert the keyword exists) or an **API** monitor (assert `$.status == "ok"`) over a plain HTTP check.

### Probeability — can this endpoint be monitored?

Tag each API route so selection (§0) knows what to do with it:

| Probeability | Signal in code | Monitor? |
| -- | -- | -- |
| **public** | GET, no auth middleware on the route | Yes — HTTP or API monitor directly |
| **protected (read-only)** | GET behind an auth guard / `Authorization` check, but doesn't mutate | Only with a user-supplied token — `authType: BEARER` or `customHttpHeaders` (the secret is then stored in UptimeRobot) |
| **not-probeable** | POST/PUT/PATCH/DELETE, or a Bearer-protected cron route (`/api/cron/*`) | No — mutations are skipped; cron routes → HEARTBEAT (§3) |

**Don't go silent when nothing is publicly probeable.** If every API route is auth-gated, POST, or internal, create no API monitor but tell the user explicitly *why*, and recommend adding a public `/health` route that touches the backend — the same logic as the no-health-page case in §0.

---

## 3. Cron / scheduled jobs → HEARTBEAT monitors

HEARTBEAT monitors invert the model: the job must PING a generated URL on its schedule. Detection finds the *cadence*; the user wires the ping in afterward.

| Source | Where to look | Cadence |
| -- | -- | -- |
| Unix crontab | `crontab`, `*.cron`, `/etc/cron.d/*`, `Procfile` cron lines | Standard 5-field cron |
| GitHub Actions | `.github/workflows/*.{yml,yaml}` → `on.schedule[].cron` | Cron string |
| Kubernetes | manifests with `kind: CronJob` → `spec.schedule` | Cron string |
| systemd timers | `*.timer` → `OnCalendar=` | systemd calendar |
| Vercel cron | `vercel.json` → `crons[].schedule` | Cron string |
| node-cron / node-schedule | `cron.schedule('...')`, `schedule.scheduleJob('...')` in `*.{js,ts}` | Cron string |
| Postgres pg_cron (Supabase, RDS, Neon) | `cron.schedule(...)` in `*.sql` (often `supabase/migrations/*.sql`); 2nd arg is the cron string | Cron string |
| Celery beat | `beat_schedule` / `CELERYBEAT_SCHEDULE`, `crontab(...)` | Cron / interval |
| Sidekiq-cron / whenever | `config/schedule.yml`, `config/schedule.rb` | Cron / natural language |
| pg_boss / BullMQ repeatable jobs | `repeat: { cron: '...' }`, `schedule('...')` in queue setup | Cron string |
| Cloud schedulers | `cloud_scheduler`, EventBridge `ScheduleExpression`, GCP Cloud Scheduler YAML | Cron / rate |

**Don't stop at `vercel.json`.** An empty `crons: []` does **not** mean the project has no scheduled jobs — many apps schedule from the database instead. Before concluding "no cron / no HEARTBEAT target", grep the whole repo (including `*.sql`) for `cron.schedule` and `pg_cron`.

**Database-driven schedulers are HEARTBEAT candidates, not HTTP.** pg_cron (and similar) typically fire by POSTing to an internal endpoint via `pg_net` (`net.http_post`), usually a Bearer/secret-protected route under `/api/cron/*`. You **cannot** point an HTTP monitor at those: the probe gets a 401, and a successful probe would run real work. The right move is a HEARTBEAT the job pings on success. When you see `cron.schedule` + `net.http_post` to a protected route, propose HEARTBEAT — don't propose an HTTP monitor on the endpoint.

Translate the cron cadence into the HEARTBEAT `interval` (seconds between expected pings) and pick a `gracePeriod` that absorbs the job's normal runtime variance — set **both** on every heartbeat. Examples: `0 3 * * *` → `interval: 86400`; `*/15 * * * *` → `interval: 900`; `0 * * * *` → `interval: 3600`.

After creating the heartbeat, the job must ping the generated URL **on success only** (after the work completes, non-fatal). For an HTTP-invoked job (pg_cron → `/api/cron/*` route), wire the ping into the **route handler's success path**, not the SQL/scheduler. See Step 5 of `SKILL.md` for the per-shape recipe.

---

## 4. Base-URL inference sources

Search these (in roughly this priority order) before asking the user. Confirm anything you find; never silently trust it.

- `.env`, `.env.local`, `.env.production`, `.env.example` → keys matching `*_URL`, `BASE_URL`, `PUBLIC_URL`, `SITE_URL`, `API_URL`, `NEXT_PUBLIC_*URL`, `VITE_*URL`, `VERCEL_URL`.
- `vercel.json`, `netlify.toml`, `render.yaml`, `fly.toml`, `app.json`, `railway.json`.
- `package.json` → `homepage`.
- `docker-compose.yml` / `Dockerfile` → published hostnames, `VIRTUAL_HOST`, Traefik/ingress labels.
- Kubernetes `Ingress` / `Gateway` manifests → `spec.rules[].host`.
- `README.md` → live/demo links, status badges, "Production:" lines.
- CI deploy steps (`.github/workflows/*`) → deploy target URLs.

**Always exclude** as production targets: `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `*.local`, `*.test`, `*.example`, and any URL carrying an obvious dev port (`:3000`, `:5173`, `:8080`, `:8000`).
