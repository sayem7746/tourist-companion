# Railway production (when ready)

Runbook for hosting Tourist Companion on [Railway](https://railway.app). **Nothing in this file has been provisioned.** Do not create a Railway project, attach GitHub, or turn on GitHub Actions deploys until you are ready. Local Postgres stays `docker compose -f infra/docker-compose.yml up -d` (`infra/docker-compose.yml`). Secrets live in `infra/SECRETS.md`. Pipeline shape lives in `infra/DEPLOY.md`.

GitHub workflows stay **manual** (`workflow_dispatch` in `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`). They do not talk to Railway.

## Target shape

Three Railway resources in **one project**, same region:

| Resource | Role | Source |
| --- | --- | --- |
| **Postgres** | Isolated production database | Railway plugin (not the local Compose volume) |
| **API** | Fastify (`backend/`) | Root Directory `backend` |
| **Web** | Angular SPA (`frontend/`) | Root Directory `frontend` |

Use a **second** Railway project (or environment) for staging. Staging and production must not share Postgres, `JWT_SECRET`, `ADMIN_TOKEN`, or API keys.

Suggested public hostnames after custom domains:

| Service | Example origin |
| --- | --- |
| Web | `https://app.example.com` |
| API | `https://api.example.com` |

Session cookies (`tc_access`, `HttpOnly; SameSite=Lax; Secure` when `NODE_ENV=production`) are scoped to the API host. CORS allowlists a **single** SPA origin (`FRONTEND_ORIGIN`). Put web and API on **subdomains of the same registrable domain** so the cookie is same-site. Do not rely on two `*.up.railway.app` URLs for login: `up.railway.app` is a public suffix, so those hosts are cross-site and the SPA `withCredentials` cookie will not be sent.

## When you are ready (dashboard)

Do this by hand in Railway. Do not wire GitHub Actions to `railway up` or enable a deploy workflow for this step.

1. Create a Railway project (production). Optional: a second project named staging.
2. Add a **PostgreSQL** plugin. Wait until it is healthy. Copy the connection URL only into Railway variables (never into git).
3. Create service **api** from this repo.
   - Root Directory: `backend`
   - Watch paths (optional): `/backend/**`
   - Builder: Nixpacks (default)
   - Node: **20** (`NIXPACKS_NODE_VERSION=20`; `backend/package.json` `engines.node` is `>=20`)
   - Build: `npm ci && npm run build`
   - **Release / pre-start:** `npm run db:migrate`
   - Start: `npm start` (`node dist/index.js`)
   - Healthcheck: `GET /health` (path `/health`)
   - Do **not** set `PORT` yourself. Railway injects it; `backend` already reads `config.PORT`.
   - Bind: leave `HOST=0.0.0.0`
4. Attach the Postgres plugin to **api**. Set `DATABASE_URL` from the plugin (prefer the **private** URL; see [Postgres](#postgres)).
5. Set the API variables in [Environment variables](#environment-variables). Generate new secrets; never reuse local or staging values.
6. Generate a public HTTPS URL for **api**, then (recommended) attach `api.example.com` ([Domain and SSL](#domain-and-ssl)).
7. Create service **web** from the same repo.
   - Root Directory: `frontend`
   - Watch paths (optional): `/frontend/**`
   - Node 20
   - Build: `npm ci && npm run build:production`
   - Start: **do not** use `npm start` (`ng serve` is the dev server). Use a static SPA server, for example:
     ```bash
     npx --yes serve dist/tourist-companion/browser -s -l tcp://0.0.0.0:$PORT
     ```
     Angular’s application builder writes `dist/tourist-companion/browser`. The `-s` flag rewrites unknown paths to `index.html` (client routes such as `/trips/new`).
8. Set the compiled API origin **before** the production frontend build (see [SPA API origin](#spa-api-origin)).
9. Attach `app.example.com` to **web**. Set API `FRONTEND_ORIGIN` to that exact origin (`https://app.example.com`, no trailing slash). Redeploy **api** if the origin changed.
10. Smoke-check [After first deploy](#after-first-deploy).

CLI equivalent (still manual, still later): `railway login`, `railway init`, `railway add --plugin postgres`, then `railway up` from `backend/` / `frontend/` with the commands above. Prefer the dashboard until the project exists.

## Postgres

**Local** (unchanged):

```bash
docker compose -f infra/docker-compose.yml up -d
```

Default local URL: `postgres://tourist:tourist@127.0.0.1:5432/tourist_companion`. That user, password, and volume must never be production.

**Railway**

- Provision Postgres in the same project and region as **api**.
- Set the API `DATABASE_URL` to the plugin variable (Railway reference `${{ Postgres.DATABASE_URL }}` or `${{ Postgres.DATABASE_PRIVATE_URL }}`).
- Prefer **`DATABASE_PRIVATE_URL`** (host like `*.railway.internal`). Traffic stays on Railway’s private network and typically does not need TLS between api and Postgres.
- If you must use the **public** `DATABASE_URL`, require TLS. Append `sslmode=require` when the URL has no `ssl` query (example: `postgres://…/railway?sslmode=require`). Public connections that fail with a certificate error usually need `sslmode=require` (or the equivalent `pg` SSL settings); do not commit `rejectUnauthorized: false` unless you have confirmed Railway’s current cert story.
- Database name on Railway is often `railway`, not `tourist_companion`. That is fine: `node-pg-migrate` uses whatever path is in `DATABASE_URL` (`backend/database.json` reads `ENV=DATABASE_URL`).
- Pool size in `backend/src/db/pool.ts` is `max: 10`. Stay on one API replica at MVP, or lower `max` if you add replicas so you do not exhaust the plugin’s connection limit.
- Apply schema with `npm run db:migrate` against **that** `DATABASE_URL` only.
- **Never** run `npm run db:seed` in production. Seed creates `demo@tourist-companion.local` / `demo-password` and `ops@tourist-companion.local` / `ops-password`. Create the first real ops user through signup plus a SQL role update, or a one-off admin path you control.

Staging Postgres is a separate plugin. Do not restore production dumps onto staging without scrubbing secrets and PII.

## Environment variables

Set these on the Railway **api** service (not in git, not in GitHub Actions until you choose to). Placeholders match `backend/.env.production.example`. Staging/production config **rejects** the development JWT/admin strings and requires `JWT_SECRET` / `ADMIN_TOKEN` of at least 32 characters plus `DATABASE_URL`.

Generate secrets locally, then paste into Railway:

```bash
openssl rand -base64 48
```

### API — required

| Variable | Production value | Notes |
| --- | --- | --- |
| `APP_ENV` | `production` | |
| `NODE_ENV` | `production` | Enables `Secure` on `tc_access`; hides error stacks |
| `HOST` | `0.0.0.0` | |
| `LOG_LEVEL` | `info` | |
| `DATABASE_URL` | Railway Postgres URL | Prefer private URL; see [Postgres](#postgres) |
| `JWT_SECRET` | random ≥32 chars | Unique to this environment |
| `JWT_EXPIRES_IN` | `7d` | Optional; default `7d` |
| `ADMIN_TOKEN` | random ≥32 chars | Shared ops secret (`X-Admin-Token` or Bearer). Rotate like `JWT_SECRET`. |
| `FRONTEND_ORIGIN` | `https://app.example.com` | Exact SPA origin: scheme + host, no path, no trailing slash |

Do **not** set `PORT` on Railway. The platform provides it; Fastify listens on `config.PORT`.

### API — optional

| Variable | Default / suggested | Notes |
| --- | --- | --- |
| `LLM_API_KEY` | unset | Omit or leave `CHANGE_ME*` to retrieve-and-rank Malaysia knowledge (no live LLM) |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | |
| `LLM_MODEL` | `gpt-4o-mini` | |
| `PLACES_PROVIDER` | `seed` | `google` / `overpass` only with a real key/endpoint |
| `GOOGLE_PLACES_API_KEY` | unset | Server-side only; never put in the SPA |
| `WEATHER_PROVIDER` | `open-meteo` | No API key. `seed` skips live fetch |
| `OPEN_METEO_BASE_URL` | `https://api.open-meteo.com` | |
| `WEATHER_TIMEOUT_MS` | `2500` | |
| Rate-limit / concierge history knobs | see `.env.production.example` | In-process only; not shared across replicas |

`CHANGE_ME*` keys are treated as unset (`hasUsableApiKey` in `backend/src/config.ts`).

### SPA API origin

The browser calls `environment.apiBaseUrl` from `frontend/src/environments/environment.ts`. The production file currently has the placeholder `https://api.example.com`. **Update that value to the real API origin** (`https://api.example.com` after DNS, or the Railway `*.up.railway.app` URL only for a cookie-less smoke) **and rebuild web**.

`frontend/.env.production.example` documents `NG_APP_API_BASE_URL`. GitHub’s placeholder deploy job injects it, but the Angular build does **not** read `NG_APP_*` today. Until that is wired, the compiled `environment.ts` (or an equivalent file replacement) is the source of truth. Keep the Railway/GitHub public API URL in sync with that file.

SPA variables are public. Never put `DATABASE_URL`, `JWT_SECRET`, `ADMIN_TOKEN`, or provider API keys in `frontend/`.

## Domain and SSL

Railway terminates TLS for you (Let’s Encrypt) on:

- Default `https://<service>.up.railway.app`
- Custom domains added under the service **Settings → Networking → Custom domain**

Steps for a real hostname:

1. In Railway, add `app.example.com` on **web** and `api.example.com` on **api**.
2. At the DNS host, create the `CNAME` (or ALIAS) records Railway shows. Do not point the apex at Railway unless you use their documented ALIAS/ANAME path.
3. Wait until the dashboard shows a valid certificate. HTTP should redirect to HTTPS.
4. Set API `FRONTEND_ORIGIN=https://app.example.com` and rebuild the SPA with `apiBaseUrl=https://api.example.com`.
5. Confirm the session cookie is `Secure` (requires `NODE_ENV=production`) and that login from the SPA sets `tc_access` on the API host.

No application-level certificate files are required. Do not disable HTTPS or serve the SPA on `http://` in production: cookies would drop `Secure` only when `NODE_ENV` is not `production`, which you must not do on Railway.

## Monitoring

Railway provides process CPU, memory, restart history, and log drain on each service. The API already emits JSON logs (Pino) with `requestId`, method, URL, status, and duration (`docs/observability.md`). Request logs do not include `Authorization` or cookie values.

| Probe | Use on Railway |
| --- | --- |
| `GET /health` | Liveness / Railway HTTP healthcheck. Body `{ status, timestamp }`. |
| `GET /health?verbose=true` | Readiness: `database` is `up` / `down` / `skipped`, plus in-process latency totals. **Public.** Prefer it for a manual smoke, not as a scrape target on the open internet. |
| `GET /metrics` | JSON snapshot (`requestsTotal`, `errorsTotal`, percentiles, `byRoute`). **Unauthenticated** and resets on process restart. Do not publish this URL; add auth or split it before a public launch if the hostname is guessable. |
| `GET /admin/dashboard` | Ops counts (JWT `role: admin` or `ADMIN_TOKEN`). SPA: `/admin`. |
| Railway logs | Structured API logs; SPA is static so look at **api** first |

Healthcheck settings for **api**: path `/health`, follow HTTPS, reasonably short interval. Do not use verbose health as the platform probe (extra DB ping on every check).

**web** has no `/health`. Use a TCP check or `GET /` (static `index.html`).

One API replica at MVP: in-process rate limits and metrics are per process. `trustProxy` is **off**, so `request.ip` behind Railway’s proxy is the edge, not the client, until Fastify `trustProxy` is enabled **intentionally** (`docs/security-review.md`). Do not enable it blindly; spoofed `X-Forwarded-For` would bypass rate limits.

Optional later: Railway log drain to a vendor, or replace `/metrics` with Prometheus. Not required to ship the first environment.

## Production configuration checklist

- [ ] `APP_ENV=production` and `NODE_ENV=production` on **api**
- [ ] Strong unique `JWT_SECRET` and `ADMIN_TOKEN`
- [ ] `DATABASE_URL` points at Railway Postgres (private URL when possible)
- [ ] Migrations run on each deploy; seed does **not**
- [ ] `FRONTEND_ORIGIN` matches the HTTPS SPA origin exactly
- [ ] SPA production build compiled against the HTTPS API origin
- [ ] Custom domains + Railway TLS on web and api (same parent domain for cookies)
- [ ] Railway healthcheck on `GET /health`
- [ ] `HOST=0.0.0.0`; `PORT` left to Railway
- [ ] Optional LLM / Google keys omitted until needed
- [ ] GitHub Actions still `workflow_dispatch` only; no auto-deploy to Railway
- [ ] Local Compose Postgres unused by production

## After first deploy

```bash
# Liveness (API public URL)
curl -sS "https://api.example.com/health"

# Database attached
curl -sS "https://api.example.com/health?verbose=true"
# expect "database":"up"

# SPA
curl -sS -o /dev/null -w '%{http_code}\n' "https://app.example.com/"
```

Then in a browser: open the SPA origin, sign up a throwaway tourist, confirm `Set-Cookie` is `Secure` and subsequent `/auth/me` succeeds (CORS + credentials). Create the first ops admin **without** seed. Hit a deep SPA route (e.g. `/trips/new`) to confirm the static `-s` fallback.

## Out of scope until you deploy

- Creating the Railway project, plugin, or custom domains
- Storing real secrets in GitHub Environments
- Turning on GitHub Actions or Railway auto-deploy from `main`
- Terraform / kube / extra APM vendors
