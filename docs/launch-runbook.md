# Launch runbook

How to start, watch, update, and recover Tourist Companion. **Local is the only environment that exists today.** Railway production is documented and not provisioned.

Asana: [Create launch runbook](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218672871601561) (EPIC 10 — QA, Security & MVP Launch). Notes: deployment, rollback, monitoring, partner updates, support contacts, and incident handling.

Date: 20 September 2026. Local first. Railway later. Asana task left open. No git commit.

## Related docs

| Topic | Doc |
| --- | --- |
| Railway services, env vars, Postgres, TLS, healthchecks | `infra/RAILWAY.md` |
| Staging vs production pipeline | `infra/DEPLOY.md` |
| Secrets, GitHub Environments, seed ban | `infra/SECRETS.md` |
| Request IDs, logs, metrics, health | `docs/observability.md` |
| Partner intake → approve / pause | `docs/partner-onboarding.md` |
| Security follow-ups before a public host | `docs/security-review.md` |
| Critical journeys | `docs/test-strategy.md` |
| Latest local UAT | `docs/uat-results.md` |
| Product surfaces | `docs/architecture.md` |

Do not copy Railway dashboard steps here. When you are ready to host, follow `infra/RAILWAY.md` end to end.

## Current posture

| Environment | Status | How it runs |
| --- | --- | --- |
| **Local** | In use | Compose Postgres + `npm run dev` (API) + `ng serve` (SPA) |
| **Staging** | Not provisioned | Isolated DB and secrets when it exists (`infra/DEPLOY.md`) |
| **Production (Railway)** | Not provisioned | Three resources in one project: Postgres plugin, **api**, **web**. See `infra/RAILWAY.md` |

GitHub workflows (`.github/workflows/ci.yml`, `deploy.yml`) stay **manual** (`workflow_dispatch`). They do not deploy to Railway. Do not create a Railway project, attach GitHub, or turn on auto-deploy until you choose to.

Seeded demo accounts (`demo@tourist-companion.local` / `demo-password`, `ops@tourist-companion.local` / `ops-password`) are **local/staging only**. Never run `npm run db:seed` against production.

## Roles

| Role | Owns at launch |
| --- | --- |
| Engineering | Local start/stop, migrations, rollback of code, API logs, health |
| Partner ops | Listing intake, approve/pause, conversion records, partner email |
| On-call (same people until a roster exists) | Incident severity, traveler-facing content pause, secret rotation |

Fill named humans and a paging channel in the ops vault before a public hostname exists. This repo does not store personal phone numbers.

## Pre-launch gate

Do not call a public URL “live” until these are true.

- [ ] Critical UAT journeys in `docs/test-strategy.md` pass on the target host. Local UAT (`docs/uat-results.md`, 20 September 2026) **failed** Plan / itinerary (`GET /trips/:id/itinerary` 500). That is launch-blocking until fixed and re-checked.
- [ ] `GET /health?verbose=true` reports `database: up`.
- [ ] Traveler SOS / `GET /emergency` still exposes `tel:999` and `tel:112`.
- [ ] Production (when it exists): `APP_ENV=production`, `NODE_ENV=production`, unique ≥32-char `JWT_SECRET` and `ADMIN_TOKEN`, no seed, `FRONTEND_ORIGIN` exact SPA origin.
- [ ] SPA compiled against the real API origin (`infra/RAILWAY.md` — SPA API origin). Session cookie is `Secure` only when `NODE_ENV=production`.
- [ ] Web and API on subdomains of the same registrable domain (not two `*.up.railway.app` hosts — public suffix; cookies will not send).
- [ ] `GET /metrics` is not advertised. It is unauthenticated; treat as internal until gated (`docs/security-review.md`).
- [ ] First ops admin created **without** seed (signup + SQL `role` update, or a one-off admin path you control).
- [ ] Partner listings that will show to travelers have completed `docs/partner-onboarding.md`.

## Deployment

### Local (now)

From the repo root. Node 20+. Postgres must be up before the API.

```bash
docker compose -f infra/docker-compose.yml up -d

cd backend
cp .env.development.example .env   # or .env.example
npm install
npm run db:migrate
npm run db:seed                    # local only
npm run dev                        # http://localhost:3000
```

Second terminal:

```bash
cd frontend
npm install
npm start                          # http://localhost:4200
```

Default local DB: `postgres://tourist:tourist@127.0.0.1:5432/tourist_companion`. That user, password, and Compose volume must never be production.

**Cookie host:** SPA `apiBaseUrl` is `http://localhost:3000`. The `tc_access` cookie is `SameSite=Lax`. Keep the browser on `localhost` (not `127.0.0.1`) for the SPA so the cookie is same-site. If another process binds IPv6 `*:3000`, `localhost:3000/health` may not be Fastify — stop that process or move the API.

Smoke:

```bash
curl -sS "http://localhost:3000/health"
curl -sS "http://localhost:3000/health?verbose=true"   # expect "database":"up"
curl -sS -o /dev/null -w '%{http_code}\n' "http://localhost:4200/"
```

Then in a browser: sign up a throwaway tourist, open Plan, Arrival, Explore, Concierge SOS → `/emergency`, and `/admin/login` with the seeded ops user.

Local checks before you treat a branch as releasable (same commands CI runs):

```bash
cd frontend && npm ci && npm run lint && npm run format:check && npm run test:ci && npm run build
cd backend && npm ci && npm run lint && npm test && npm run build
```

### Shared preview / staging (when it exists)

Isolated Postgres. Seed is allowed. Secrets must not match production. Pipeline shape: migrate → deploy API → deploy SPA → `GET /health` (`infra/DEPLOY.md`). GitHub Environment `staging` is a placeholder until a host exists.

### Railway production (later)

When you are ready, **do the work in `infra/RAILWAY.md`**, not from memory:

1. One Railway project, same region: Postgres plugin + **api** (`backend/`) + **web** (`frontend/` static SPA). Optional second project/environment for staging.
2. API: Node 20, `npm ci && npm run build`, release `npm run db:migrate`, start `npm start`, healthcheck `GET /health`. Do not set `PORT`. Prefer `DATABASE_PRIVATE_URL`.
3. Web: `npm ci && npm run build:production`, static server with SPA fallback (not `ng serve`). Compile `apiBaseUrl` to the HTTPS API origin first.
4. Custom domains on the same parent (`app` + `api`), `FRONTEND_ORIGIN` exact, `NODE_ENV=production`.
5. Smoke in [After first deploy](../infra/RAILWAY.md#after-first-deploy).

GitHub Actions must not call `railway up` until you explicitly wire it. Production deploys stay a human gate.

## Rollback

Goal: restore a last-known-good traveler experience. Prefer **redeploy previous code** over reversing migrations unless the new schema is what broke reads/writes.

### Local

1. Stop the API and SPA processes (Ctrl-C). Leave Postgres up unless the data itself is the problem.
2. Check out the last known-good commit (do not force-push `main`).
3. Restart API and SPA. Confirm `/health?verbose=true` and a tourist login.
4. **Schema:** `cd backend && npm run db:migrate:down` rolls back **one** node-pg-migrate revision. Read that migration’s `down` function first. Down is the wrong tool for “the process crashed” and can drop columns/tables. If you down, run the matching `up` only when you intend to re-apply.
5. **Data:** restoring the Compose volume is a last resort for local only. It wipes everything in `tourist_companion_pgdata`.

Do not down-migrate in a loop hoping to “reset production-like” state. Recreate local DB if you need a clean seed:

```bash
docker compose -f infra/docker-compose.yml down
docker volume rm tourist-companion_tourist_companion_pgdata   # name may vary; docker volume ls
docker compose -f infra/docker-compose.yml up -d
cd backend && npm run db:migrate && npm run db:seed
```

### Railway (when it exists)

Follow Railway’s deployment history: **redeploy the previous successful api and/or web deployment**. Keep the Postgres plugin attached.

| Situation | Action |
| --- | --- |
| Bad SPA build / wrong `apiBaseUrl` | Redeploy previous **web**. API unchanged. |
| Bad API process / 5xx, DB still healthy | Redeploy previous **api**. Do not migrate down unless the new migration is the failure. |
| Migration applied and new code requires it | Forward-fix, or deploy a hotfix that works with the new schema. Down-migrate only if `down` is safe and you have a snapshot. |
| Unsafe or wrong partner listing | Pause the listing (`POST /admin/partners/:id/pause`). Do not roll back the whole app. |
| Wrong CMS / FAQ copy | Unpublish that row (`/admin/content`, `/admin/faqs`). Concierge retrieve-and-rank will drop unpublished FAQs. |
| Secrets leaked | Rotate `JWT_SECRET` / `ADMIN_TOKEN` in Railway variables and redeploy **api**. Existing `tc_access` cookies die with the old JWT secret (sessions last up to `JWT_EXPIRES_IN`, default 7d). Tell ops they must log in again. |

Never restore a production dump onto staging without scrubbing PII. Never seed production as a “rollback.”

## Monitoring

Detail and field names: `docs/observability.md`. Railway process CPU, memory, restarts, and log drain: `infra/RAILWAY.md` (Monitoring).

| Signal | Local | Railway (later) |
| --- | --- | --- |
| Liveness | `GET http://localhost:3000/health` | Railway HTTP healthcheck on **api** path `/health` (not verbose) |
| Readiness | `GET /health?verbose=true` — `database` `up` / `down` / `skipped` | Same URL; public. Use for a manual smoke, not the platform probe |
| Traffic / errors | `GET /metrics` JSON (in-process; resets on restart) | Same; do not publish the URL |
| Ops counts | SPA `/admin` ← `GET /admin/dashboard` | Same (admin JWT or `ADMIN_TOKEN`) |
| Mutations | `GET /admin/audit` | Same |
| Logs | Pino JSON on the API process (`requestId`, method, URL, status, `durationMs`) | Railway logs on **api**. SPA is static; start with api |
| Traveler report | Ask for `X-Request-Id` (response header and error JSON `error.requestId`) | Same |

Watch after a deploy (local or Railway):

- Verbose health `database` stays `up`.
- Spike in `errorsTotal` or p95 on `GET /trips/:id/itinerary`, `/auth/login`, `/concierge/chat`, `/places/nearby`.
- Concierge `mode` if an LLM key is live (cost and 8s abort). Seed retrieve-and-rank is the default.
- Partner click 5xx or sudden pause of every listing.
- Process restarts / OOM on Railway **api**. One replica at MVP: in-process rate limits and metrics are per process. `trustProxy` is off until enabled on purpose.

**web** has no `/health`. Local: `GET http://localhost:4200/`. Railway: TCP or `GET /` (`index.html`).

## Partner updates

Marketplace go-live and pause rules: `docs/partner-onboarding.md`. Ops UI: `/admin/login` → `/admin/partners`. Audit: `/admin/audit`.

| Change | How | Tell the partner |
| --- | --- | --- |
| First go-live | Checklist green, then `POST /admin/partners/:id/approve` | Ops email (`contactEmail`): listing is on traveler CTAs |
| Copy, HTTPS booking URL, commission, disclosure | `PATCH /admin/partners/:id` then confirm the tourist `GET /partners/:id` has no `contactEmail` / `commission` | Email if the booking URL or disclosure travelers see changed |
| Paid placement on/off | Patch `listing.sponsored` only if the contract says so | Written confirmation |
| Unsafe, lapsed license, contract end | `POST /admin/partners/:id/pause` the same day | Ops email the same day. Existing referral codes still 302; new clicks/leads 404 |
| Conversion they reported | Admin `POST /referrals/bookings` with partner evidence. Clicks are not invoices | Billing contact; reconcile with `GET /admin/referrals/analytics?providerId=` |
| Partner wants out | Pause; delete only if no referral rows (API 409 otherwise) | Confirm pause |

Do not attach partner CTAs to SOS, emergency numbers, or visa advice. Do not put ops phone/email in listing summaries.

Content that is not a partner but is a “live update”: publish/unpublish CMS (`/admin/content`) and FAQs (`/admin/faqs`). Published FAQs ground concierge and `GET /knowledge`. Unpublish is the content rollback.

## Support contacts

### Traveler-facing (in product)

These are for **travellers in Malaysia**, not for paging engineering. Keep them correct in `backend/db/malaysia-emergency.json` (served by `GET /emergency`). Confirm against official sources if numbers change.

| Who | Number | When |
| --- | --- | --- |
| Police / ambulance / fire (MERS) | **999** | Immediate danger. Also **112** from mobile networks |
| Tourist Police (KL, Bukit Bintang) | 03-2149 6590 / 03-2149 6593 | Lost property, touts, visitor help — not SOS |
| IPK KL switchboard | 03-2115 9999 | Non-emergency police enquiry / how to report |
| Tourism Malaysia info line | 1300-88-5050 | Destinations/events, working days 09:00–17:00 MYT |
| MaTiC visitor centre | 03-9235 4800 | Walk-in maps / transport, daytime counter |

Embassies: in-app `GET /embassies` (official websites only). Safety copy: `GET /safety`. Concierge SOS (`#E11D48`) must stay visible and must open emergency help — chat does not replace 999.

### Product and engineering (fill before public launch)

Store in the ops vault, not in git.

| Contact | Purpose | Placeholder |
| --- | --- | --- |
| On-call engineer | API down, 5xx, data, secrets | TBD |
| Partner ops | Listings, conversions, pause notices | TBD (same as on-call until a roster exists) |
| Escalation / founder | Sev-1 longer than 30 minutes, press, PDPA | TBD |
| LLM / Places vendor | Key leak, quota, outage | Account owner in vault; keys only in env |
| Railway (later) | Platform outage | Railway status + project members |

Ops sign-in is `/admin/login` (JWT `role: admin`) or `ADMIN_TOKEN` (`X-Admin-Token` or Bearer). Treat `ADMIN_TOKEN` like `JWT_SECRET`. Audit rows for the header show `actorType: admin_token` with no email — prefer named admin JWT for launch mutations.

### Partner counterparties

One ops inbox per listing: `providers.contact_email` (never on tourist `GET /partners`). Billing and a named human live in the contract / vault (`docs/partner-onboarding.md`).

## Incident handling

An incident is anything that blocks a traveler from a critical journey (auth, trip, plan, arrival, nearby, concierge, referral, **emergency**) or exposes data/secrets.

### Severity

| Sev | Meaning | Examples | First response |
| --- | --- | --- | --- |
| **1** | Unsafe or whole product down | Emergency directory wrong/missing; API 5xx for everyone; secret in logs/git | Fix or roll back now. Keep SOS numbers reachable (static `/emergency` if API is up; status note if not) |
| **2** | Core journey broken | Login, itinerary 500, cookie/CORS so SPA cannot session, all partner clicks fail | Hotfix or redeploy previous. Pause only the broken partner if isolated |
| **3** | Degraded | One listing, CMS typo, LLM timeout falling back to seed, Open-Meteo miss | Unpublish/pause/patch. No full rollback |
| **4** | Cosmetic / ops | Admin UI nit, analytics lag | Ticket; next business day |

### Detect

Health checks, `/metrics` error spike, Railway restart, traveler report with `X-Request-Id`, partner email, admin audit of an unexpected approve/pause/publish.

### Respond

1. **Preserve SOS.** Do not disable `/emergency`, `/safety`, or the concierge SOS control to “simplify” an outage. If the API is hard-down, a status page should still print **999 / 112**.
2. **Capture** request id, timestamp, environment (local vs staging vs production), recent deploy, and whether Postgres verbose health is `down`.
3. **Contain**
   - Bad listing → pause.
   - Bad CMS/FAQ → unpublish.
   - Bad release → rollback (above).
   - Abuse / LLM cost → unset `LLM_API_KEY` (retrieve-and-rank) and redeploy; concierge stays in-bounds without a live model.
   - Places quota → `PLACES_PROVIDER=seed`.
   - Leaked `JWT_SECRET` / `ADMIN_TOKEN` / `DATABASE_URL` → rotate, redeploy, invalidate sessions; never commit the new values.
4. **Do not** run seed on the affected production DB. Do not enable Fastify `trustProxy` mid-incident without reading `docs/security-review.md`.
5. **Communicate**
   - Travellers: short honest status if the public host is down (not inside chat as a fake live outage map).
   - Partners: ops email if their listing was paused or clicks 404.
   - Internal: Asana comment or the paging channel, with request ids — no secrets.
6. **Verify** the same smoke as deploy: health, login, one itinerary read, `/emergency`, one partner GET. Re-walk the UAT journey that failed.
7. **After**
   - What broke, time to detect/contain, whether rollback or pause was used.
   - Follow-up ticket (do not mark this runbook task complete as a substitute).
   - If production data was copied anywhere, treat it as a PDPA issue.

### Likely MVP failure modes

| Symptom | Likely cause | Move |
| --- | --- | --- |
| Plan empty / itinerary 500 unique `day_number` | Date alignment vs Postgres `DATE` (`docs/uat-results.md`) | Sev-2. Fix forward; do not seed-over. |
| SPA “Failed to fetch” / no cookie | SPA on `127.0.0.1` vs API `localhost`, or two Railway `up.railway.app` hosts, or `FRONTEND_ORIGIN` mismatch | Align origins; see cookie notes in `infra/RAILWAY.md`. |
| `/health` 307 to another app | Port 3000 stolen locally | Stop the other process. |
| Verbose `database: down` | Compose/plugin stopped or wrong `DATABASE_URL` | Restore DB; do not point production at local Compose. |
| Admin actions as `admin_token` | Shared header used | Rotate if leaked; switch to ops JWT. |

## Out of scope until you deploy

- Creating the Railway project, plugin, or custom domains (`infra/RAILWAY.md`)
- Named on-call roster and a public status page
- Auto-deploy from `main`, Terraform, extra APM
- 24/7 traveler support staffed by this app (SOS is 999, not engineering)
- In-app payout files or storing bank accounts

When Railway exists, keep this file as the **ops** path (who does what, rollback, incidents) and `infra/RAILWAY.md` as the **host** path (what to click and which env vars to set).
