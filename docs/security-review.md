# Security review

Local review of Tourist Companion (Angular SPA + Fastify API) against authentication, authorization, secrets, input validation, rate limits, logging, dependency vulnerabilities, and AI data handling.

Asana: [Run security review](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218663074516311) (EPIC 10). Depends on implemented tourist/admin authentication.

Date: 20 September 2026. Scope: this workspace only. No exploit proofs of concept. Asana task left open. No git commit.

## Summary

The API already had a solid baseline: bcrypt password hashes, HttpOnly session cookies, CORS allowlisted to `FRONTEND_ORIGIN`, Zod `.strict()` request bodies, parameterized SQL, trip and profile queries scoped by `userId`, hashed password-reset secrets, and production checks that reject the development JWT/admin placeholders.

This pass found remaining gaps around **session/role lifetime**, **unauthenticated AI and metrics surfaces**, **static admin shared secrets**, and **in-process rate limiting**. High-severity issues that could be fixed locally without a redesign were applied (see [Fixes applied](#fixes-applied)). Residual findings should be treated as launch blockers or near-term follow-ups.

| Severity | Location | Finding |
| --- | --- | --- |
| High | `backend/src/auth/tokens.ts:32`, `backend/src/auth/middleware.ts:69` | Access JWTs carry `role` for up to 7 days. Admin demotion or logout does not revoke the token; `requireAdmin` never re-reads the user row. |
| High | `backend/src/concierge/routes.ts:156`, `backend/src/concierge/prompts.ts:24` | `POST /concierge/chat` is optional-auth. Signed-in profile/trip context and client-supplied `history` are sent to a third-party LLM when `LLM_API_KEY` is set. |
| High | `backend/src/routes/metrics.ts:3` | `GET /metrics` is unauthenticated and exposes traffic volume and per-route error rates. |
| High | `backend/src/auth/middleware.ts:71`, `backend/src/db/seed.ts:24` | A static `ADMIN_TOKEN` is a full admin credential. Seeded `demo-password` / `ops-password` accounts are documented and must never exist in production. |
| Medium | `backend/src/partners/referral-routes.ts:177` | Cookie-authenticated `GET /referrals/go/:providerId` is a state-changing GET. `SameSite=Lax` still sends the cookie on cross-site top-level navigations. |
| Medium | `backend/src/auth/routes.ts:89`, `backend/src/auth/tokens.ts:70` | Login/signup JSON still returns the JWT (stealable by XSS) in addition to the HttpOnly cookie. Cookie `Max-Age` is hardcoded to 7 days and can outlive `JWT_EXPIRES_IN`. |
| Medium | `backend/src/rate-limit.ts:1`, `backend/src/config.ts:15` | Auth, places, and concierge limiters are in-process (not shared across replicas). `trustProxy` is off, so `request.ip` is wrong or spoofable behind a reverse proxy. |
| Medium | `backend/src/partners/referral-routes.ts:117` | Referral clicks accept caller-supplied `tripId` / `itineraryItemId` without proving those rows belong to the authenticated user. |
| Medium | `frontend/src/index.html:1` | SPA has no Content-Security-Policy. Templates escape text (no `innerHTML`), which limits XSS impact, but a future sink plus the JSON JWT would be severe. |
| Medium | `backend/package.json` (`node-pg-migrate`, `vitest`) | `npm audit` reports 2 high / 2 moderate in **tooling**, not the production request path. Fixes are semver-major. |
| Low | `backend/src/auth/routes.ts:24` | Passwords require length 8–128 only. Signup 409s on duplicate email (account enumeration). |
| Low | `backend/src/routes/health.ts:23` | `GET /health?verbose=true` is public and returns uptime, DB up/down, and aggregate latency. |

## Authentication

**What works**

- Signup always creates `role: tourist`; extra `role` in the body is rejected (`400`).
- Passwords are bcrypt-hashed (10 rounds outside tests). Login uses a dummy hash when the account is missing so timing is closer between known and unknown emails.
- Sessions are issued as HS256 JWTs in an `HttpOnly; SameSite=Lax` cookie (`Secure` in production). `/auth/me`, trips, profile, and itinerary require a verified token.
- Reset secrets are 32 random bytes, stored as SHA-256 hashes, expire in one hour, and **all** unused tokens for that user are invalidated after a successful reset.
- `/auth/login`, `/auth/admin/login`, `/auth/signup`, `/auth/forgot-password`, and `/auth/reset-password` share a per-IP sliding window (default 20 / 15 minutes outside tests).
- Auth responses set `Cache-Control: no-store`.

**Findings**

1. **No server-side session store (high).** Logout only clears the cookie. A stolen Bearer token or a copy of `tc_access` remains valid until `JWT_EXPIRES_IN` (default 7d). There is no password-change logout of other devices.
2. **Role is a JWT claim (high).** `verifyAccessToken` trusts `role` from the payload. Promoting or demoting an operator in the database does not affect outstanding tokens.
3. **Dual delivery of the access token (medium).** The JSON body includes `token` even though the SPA uses `withCredentials` cookies and does not persist it. Any XSS or overly verbose client logging can copy a still-valid session.
4. **Forgot-password returns `resetToken` whenever `NODE_ENV !== 'production'`.** That is convenient for tests and local mail-less reset, but a mis-set `NODE_ENV` on a shared host would leak reset secrets in the HTTP response.
5. **Weak password policy (low).** No complexity, breach list, or lockout beyond the IP rate limit.

## Authorization

**What works**

- Tourist data (profile, trips, itinerary, concierge history, referral list) is loaded with `userId` from the verified token. Cross-user trip reads return `404`.
- Signup cannot self-assign `admin`. `/auth/admin/login` refuses tourist credentials without setting a cookie.
- CMS, FAQ, partner admin, audit, dashboard, and referral analytics use `requireAdmin` (JWT `role: admin` or `ADMIN_TOKEN`).
- Public partner listings hide paused rows. Booking URLs must be `https://` before redirect.

**Findings**

1. **`ADMIN_TOKEN` is a shared superuser secret (high).** Presentation via `X-Admin-Token` or `Authorization: Bearer` skips user identity. Audit rows then record `actorType: admin_token` with no email. Treat rotation and storage with the same care as `JWT_SECRET`. Prefer retiring the header once ops JWT login is the only path.
2. **State-changing GET (medium).** `GET /referrals/go/:providerId` records a click and 302s to the partner. Cross-site top-level GET will include a `SameSite=Lax` cookie. Use POST (as `/referrals/clicks` already does) or a CSRF token.
3. **Unauthenticated write-ish public surfaces (medium).** `GET /r/:code` increments click state without auth (by design for sharing). Keep codes unguessable (current generator is `TC-` + 12 hex chars).
4. **Unverified foreign keys on referrals (medium).** `tripId` / `placeId` / `itineraryItemId` are stored as given. Integrity issue more than a read-IDOR, but it pollutes analytics and could attach activity to another traveler’s trip UUID.

## Secrets and configuration

**What works**

- `.env`, `.env.*` (except `*.example`) are gitignored. Example files use `CHANGE_ME_*` or documented insecure **development** placeholders.
- Staging/production (`APP_ENV` or `NODE_ENV=production`) require `JWT_SECRET` and `ADMIN_TOKEN` ≥ 32 characters and not the dev strings, plus `DATABASE_URL`.
- `hasUsableApiKey` ignores empty/`CHANGE_ME` LLM and Google keys and falls back to seed data.
- Deploy workflow injects GitHub Environment secrets and does not echo values (`infra/SECRETS.md`).
- Google Places key is sent as `X-Goog-Api-Key` from the server, not compiled into the SPA.

**Findings**

1. **Development defaults are well-known.** `dev-only-insecure-jwt-secret` / `dev-only-insecure-admin-token` must never ship. The config guard covers staging/production if `NODE_ENV`/`APP_ENV` are set correctly.
2. **Seed accounts (high if the environment is shared).** `demo@tourist-companion.local` / `demo-password` and `ops@tourist-companion.local` / `ops-password` are created only when hashes are empty, but `infra/SECRETS.md` already says do not seed production. Enforce that in the deploy host, not only in docs.
3. **No `TRUST_PROXY` setting.** Until the API sits behind a known proxy and Fastify `trustProxy` is enabled **intentionally**, do not assume `request.ip` is the client. Enabling it blindly would let callers spoof `X-Forwarded-For` and bypass rate limits.

## Input validation

**What works**

- Route bodies/queries/params go through Zod (`.strict()`, enums, UUID, ISO dates, max string lengths). Concierge messages cap at 2000 characters; CMS bodies at 20 000.
- Fastify `bodyLimit` is 256 KiB.
- SQL uses parameterized queries; dynamic `WHERE` clauses bind values (`$1`, `$2`) rather than concatenating user text.
- Overpass queries interpolate only numeric lat/lng/radius and fixed tag filters, not the free-text `q` parameter.
- Embassy websites are allowlisted to official HTTPS hosts. Itinerary `bookingUrl` must be `https://`.

**Findings**

1. Partner `https://` checks are prefix/protocol only. An admin can still point outbound redirects at any HTTPS host (expected for affiliates; keep admin auth tight).
2. LLM output is interpolated in Angular templates (escaped). Do not later bind concierge `text` with `innerHTML`.

## Rate limits

| Surface | Default (non-test) | Key |
| --- | --- | --- |
| Auth signup/login/forgot/reset | 20 / 15 min | IP |
| `GET /places/nearby`, `GET /places/:id` | 60 / 1 min | IP |
| `POST /concierge/chat` | 30 / 1 min | user id or IP |

**Findings**

- Limiters are in-memory maps. Multiple API processes each have a full budget.
- Public emergency, embassy, safety, knowledge, FAQ, and partner list routes are unlimited (acceptable for static JSON; watch if they later hit paid backends).
- Concierge anonymous users share the IP bucket; a NAT or mobile gateway can starve others.

## Logging and observability

**What works**

- Request logs record method, URL, status, duration, and request id — not `Authorization` or cookie headers (`disableRequestLogging` plus custom hooks).
- Production error serialization omits stacks.
- Concierge logs category/escalation/mode, not the user utterance or reply.
- Metrics `byRoute` keys now use Fastify route templates (`GET /trips/:id`), not raw URLs, so trip UUIDs are not published on `/metrics`. Unmatched paths collapse to `(unmatched)`.

**Findings**

1. **`GET /metrics` is public (high for an internet-facing API).** It still reveals which features are used and error rates. Bind it to admin auth, network policy, or scrape-only localhost before production.
2. **Verbose health is public (low).** Useful for probes; consider gating `verbose=true` or omitting DB status on the public listener.
3. **Pino default request serializers are not fully customized.** Keep `disableRequestLogging` (or Fastify 6 `logController`) so upgrades do not start logging headers.

## Dependency vulnerabilities

Ran `npm audit` locally on 20 September 2026.

| Package | Audit severity | Notes |
| --- | --- | --- |
| Frontend (`frontend/`) | none | Clean. |
| `glob` via `node-pg-migrate@7` | high | Advisory is glob CLI `-c/--cmd` command injection. Migrations use the library to list files, not that CLI flag. Fix available is **major** `node-pg-migrate@9`. |
| `node-pg-migrate` | high | Same transitive `glob` advisory. |
| `vitest` / `@vitest/mocker` | moderate | Test-time path traversal in mock redirects. Fix available is **major** Vitest 5. Not shipped to production. |

No runtime dependency in the API graph (`fastify`, `jsonwebtoken`, `bcrypt`, `pg`, `zod`, `dotenv`) was flagged. Do not take a major migrator/test bump as part of this review; schedule it separately and re-run audit after.

## AI data handling

**What works**

- Without a usable `LLM_API_KEY`, concierge retrieve-and-ranks local Malaysia articles and published FAQs. No user text leaves the process.
- Unsafe, medical, visa, legal, booking, and SOS intents short-circuit to canned copy and **do not** call the LLM.
- Follow-up chips from the model are filtered to chips that already exist on retrieved articles.
- History persistence skips SOS turns, is trip-scoped, TTL-capped (default 7 days), and deletable via authenticated `DELETE /concierge/history`.
- System prompt forbids inventing venues, live times, clinical advice, and crime how-tos.

**Findings**

1. **Third-party disclosure (high when the LLM is enabled).** `contextBlock` sends first name, area, dates, itinerary, accommodation, diet, and mobility needs to `LLM_BASE_URL` (default OpenAI). There is no retention agreement, regional pinning, or zero-data-retention flag in code. Traveler copy now lives on `/privacy` and `/terms`; still consider stripping mobility/diet or requiring auth + explicit consent before a commercial launch.
2. **Client-controlled `history` (medium).** If the client sends `history`, it replaces stored turns for that request. A caller can inject fake assistant messages into the model context (prompt injection). Prefer server-side history only for signed-in users.
3. **Anonymous chat still bills and rate-limits by IP.** Cost and abuse risk if the LLM key is live. Require auth for LLM mode, or keep retrieve-and-rank for anonymous.
4. **Classifier is regex, not a safety model.** Jailbreaks that avoid the listed patterns can still reach the LLM; grounding and JSON parsing reduce but do not eliminate instruction-override risk.

## Frontend notes

- Guards call `/auth/me` with cookies; `safeReturnUrl` / `safeAdminReturnUrl` reject absolute and protocol-relative URLs.
- External links use `rel="noreferrer"`.
- Arrival checklist progress is in `localStorage` (device-local, non-secret).
- Angular environment files hold only `apiBaseUrl`.

## Fixes applied (this review)

Local hardening only; behavior covered by backend Vitest (186 tests).

| Change | Why |
| --- | --- |
| Pin JWT sign/verify to `HS256` | Avoid algorithm confusion if the library defaults change. |
| Dummy bcrypt compare on unknown logins | Reduce user-enumeration via response timing. |
| Invalidate all reset tokens for a user after reset | Close unused parallel tokens. |
| Auth and places IP rate limits | Slow password spraying and Google Places quota burn. |
| `Cache-Control: no-store` on auth responses | Stop shared caches from storing JWTs. |
| Security headers + `Vary: Origin` | `nosniff`, `DENY` framing, `no-referrer`. |
| Metrics keyed by route template | Stop UUID leak on `GET /metrics`. |
| Fastify `bodyLimit` 256 KiB | Cap oversized JSON. |

## Recommended follow-ups (not done)

1. Look up `users.role` (and a token version / password-changed-at) on every `requireAuth` / `requireAdmin`.
2. Stop returning `token` in JSON once native apps can use cookies, or store it only in memory with a short TTL.
3. Protect `GET /metrics` (and verbose health) with admin auth or private networking.
4. Retire `ADMIN_TOKEN` after ops JWT login is proven; rotate if it was ever logged.
5. Change `/referrals/go` to POST; verify `tripId` ownership.
6. Require authentication (or disable LLM) for concierge; persist history only from the store.
7. Set Fastify `trustProxy` only behind a known proxy, and use Redis/shared rate limits when running more than one replica.
8. Add a CSP on the SPA once font and image hosts are enumerated.
9. Major-bump `node-pg-migrate` / Vitest on a dedicated dependency PR after `npm audit` is clean.
10. Confirm production deploy never runs `npm run db:seed`.

## Verification

- `cd backend && npm test` — 186 passed.
- `cd backend && npm audit` — 2 high / 2 moderate (tooling).
- `cd frontend && npm audit` — 0.

Browser verification was not in scope (API/auth hardening and documentation only).
