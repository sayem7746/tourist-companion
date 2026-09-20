# Test strategy

Automated and critical-path coverage for the Malaysia tourist companion MVP.

Asana: [Create test strategy](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218663074686916) (EPIC 10 — QA, Security & MVP Launch). Follow-on work: [Implement backend automated tests](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218665030487159), [Implement frontend automated tests](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218672871581604), [Run end-to-end UAT](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218664509826125).

## Goal

Ship an MVP that a traveler can trust from signup through arrival, nearby discovery, itinerary, concierge, referral, and emergency help — and that ops can administer without leaking partner or CMS data. Tests exist to catch regressions on that path before launch, not to chase a coverage percentage.

Product surfaces: `docs/architecture.md`. Traveler onboarding: `docs/trip-onboarding.md`. Concierge bounds: `docs/concierge-use-cases.md`.

## Layers

Keep the pyramid thin at the top. Prefer Fastify `inject` and Angular TestBed over browser E2E except where only a real browser can prove the journey.

| Layer | Proves | Tool | MVP bar |
| --- | --- | --- | --- |
| **Unit** | Pure functions, classifiers, mappers, seed integrity, config validation | Vitest (`backend/test`) and Jasmine helpers inside Karma specs | Fast, no I/O. Cover algorithms that are easy to get wrong (itinerary generation, hours, referral status, concierge SOS). |
| **Integration** | Memory stores + route handlers wired through `buildApp` | Vitest + Fastify `app.inject` with `NODE_ENV=test` (in-memory stores; no `DATABASE_URL`) | Default backend suite. Every public or authenticated MVP route has at least one happy path and one auth/validation failure. |
| **API** | HTTP contract against PostgreSQL stores, cookies, CORS | Same Vitest harness with a test database, or a small Playwright/API suite | Missing today. Add a smoke set for auth, trips, itinerary, referrals, and admin mutations before production. |
| **UI** | Component render, filters, HTTP calls, guards, error/empty states | Angular Karma + Jasmine (`ng test`) with `HttpTestingController` | Every traveler and ops screen that ships in MVP. Mock the API; do not start the Node server. |
| **Critical E2E** | Real browser + real API for launch-blocking journeys | Not implemented (add Playwright) | Five traveler journeys plus one ops journey, below. Complement, do not replace, manual UAT. |

Do not use live Google Places, Overpass, Open-Meteo, or the LLM in CI. Those providers already have mocked unit tests and seed fallbacks; a failure of a third-party key must not fail the build.

## Tooling (current)

| Area | Runner | How to run | Notes |
| --- | --- | --- | --- |
| Backend | Vitest 3 (`backend/vitest.config.ts`, `test/**/*.test.ts`) | `cd backend && npm test` | Node environment. `NODE_ENV=test` selects in-memory stores in `backend/src/app.ts`. |
| Frontend | Angular Karma (`@angular/build:karma`) + Jasmine | `cd frontend && npm test` or `npm run test:ci` (ChromeHeadless, no watch) | `karma-coverage` is installed but **not wired** in `frontend/angular.json` (no `codeCoverage` flag, no thresholds). |
| CI | `.github/workflows/ci.yml` | Manual `workflow_dispatch` | Runs frontend lint/format/`test:ci`/build and backend lint/test/build. Not on push/PR. |
| E2E | None | — | No Playwright or Cypress dependency. |
| Shared types | None | — | `shared/` has no test files. |

Backend tests never set `DATABASE_URL`, so they never exercise `*-pg-store.ts`. Verbose health is asserted as `database: skipped`. That is intentional for the unit/integration suite; it is not a substitute for a Postgres API smoke.

## Coverage map — backend (Vitest)

Twenty-four files under `backend/test/`. Most files mix **unit** (pure helpers) and **API/integration** (`app.inject` against memory stores).

| Domain | File | Unit | API / integration (in-memory) | Gaps |
| --- | --- | --- | --- | --- |
| Health / metrics | `health.test.ts`, `observability.test.ts` | Error log stack policy; in-process percentiles | `GET /health`, verbose health, `GET /metrics`, `X-Request-Id` | CORS / `FRONTEND_ORIGIN`; cookie credential preflight. |
| Config | `config.test.ts` | Staging/production secret gates | — | — |
| Auth | `auth.test.ts` | Unknown roles default to tourist | Signup, login, `/auth/me`, logout cookie clear, password reset, tourist vs admin JWT, `ADMIN_TOKEN`, `/auth/admin/login` | No Postgres unique-email / password-hash round trip. |
| Profile | `profile.test.ts` | — | Auth required; default prefs; PATCH; validation | — |
| Trips | `trips.test.ts` | — | CRUD, per-user isolation, date/interest validation | — |
| Trip places | `trip-places.test.ts` | — | Save / list / remove nearby place; 404 isolation | — |
| Itinerary | `itinerary.test.ts`, `itinerary-generate.test.ts` | Draft planner (meals/activities, locked gaps, budget, style, hops, arrival offset) | Skeleton GET, item CRUD/reorder, PUT replace-all, owner scope, regenerate, weather disclaimer on days | Persist the same flows through Postgres (see P0). |
| Weather | `weather.test.ts` | Seed vs Open-Meteo mapping, geo, fallback | Hints attached in itinerary GET | No live Open-Meteo in CI (by design). |
| Places | `places.test.ts` | Seed JSON parity, KL hours, Google/Overpass normalize, provider selection | `GET /places/categories`, `/places/nearby`, `/places/:id` | Live Google/Overpass not in CI (by design). |
| Arrival | `arrival.test.ts` | — | Checklist, transport, connectivity, currency, transfer helper; airport filters | — |
| Concierge | `concierge.test.ts`, `concierge-history.test.ts` | Chip/SOS classifiers, limiter, current-trip picker, history TTL | Chat (anon + JWT), retrieve-and-rank, SOS/out-of-bounds, rate limit, LLM fallback, history GET/DELETE | Live LLM not in CI (by design). |
| Knowledge / FAQs | `knowledge.test.ts`, `faqs.test.ts` | Seed parity; CMS FAQ → knowledge map | `GET /knowledge`, public `GET /faqs`, admin FAQ CRUD/publish | — |
| Content CMS | `content.test.ts` | Kinds + slugify | Admin CRUD/publish; tourist rejected | Public read of published CMS (non-FAQ kinds) is not a first-class tourist API — arrival/safety copy is still seed-driven. |
| Partners / referrals | `partners.test.ts`, `referrals.test.ts` | Categories, ops-field stripping, tracking URLs, status machine, analytics rollup | Public list/detail, admin CRUD/approve/pause, clicks/leads/bookings, `GET /r/:code`, `GET /referrals/go/:providerId`, admin analytics | Inject tests use `Authorization: Bearer`, not the cookie `withCredentials` path the SPA uses. |
| Emergency / embassy / safety | `emergency.test.ts`, `embassies.test.ts`, `safety.test.ts` | Seed JSON parity; topic coverage | Public GET + filters | — |
| Ops dashboard / audit | `dashboard.test.ts`, `audit.test.ts` | Snapshot assembly; action/entity enums | `GET /admin/dashboard`, `GET /admin/audit`; partner/content/FAQ mutations write audit | Reads and failed writes are correctly **not** audited (asserted). |

**Asana backend follow-on** (“authentication, trips, itinerary, nearby search, referrals, admin, and concierge APIs”) is largely met at the in-memory API layer. Remaining backend work is Postgres smoke, CORS/cookies, and a few thinner routes — not greenfield coverage of those domains.

## Coverage map — frontend (Karma / Jasmine)

Twenty-eight `*.spec.ts` files. Typical pattern: TestBed + `HttpTestingController` (HTTP mocked) plus small helper `describe` blocks. These are **UI/component** tests, not browser E2E.

| Screen / area | Spec | What it covers | Gaps |
| --- | --- | --- | --- |
| Shell / routes | `app.spec.ts` | Brand, SOS, tab bar, public vs `authGuard` / `adminGuard` route wiring | Guards are asserted as route config, not executed (except `admin.guard.spec.ts`). |
| Home | `home.spec.ts` | Malay greeting helpers; Tropical Sanctuary chrome | Signed-in vs anonymous dashboard data is shallow. |
| Tourist login | `auth/login.spec.ts` | Renders the form | **Does not POST `/auth/login`**, errors, or `returnUrl`. |
| Signup | — | — | **No `signup.spec.ts`.** Component posts `/auth/signup` and honors `returnUrl`. |
| `authGuard` | (route wiring only) | — | No dedicated spec for redirect to `/login?returnUrl=`. |
| Onboarding | `trips/trip-onboarding.spec.ts` | 6-step validation; `POST /trips` with credentials | Auth-required redirect is product (`docs/trip-onboarding.md`) but not tested here. |
| Plan / itinerary | `trips/trip-dashboard.spec.ts` | Load trips, generate, add/replace/remove/move/lock stops, regenerate day/full, sponsored cards | Real drag-and-drop / map is not in Karma. |
| Preferences | `profile/preferences.spec.ts` | GET/PATCH profile and trip interests | — |
| Arrival | `arrival-checklist.spec.ts`, `arrival-transport.spec.ts`, `arrival-connectivity.spec.ts`, `arrival-currency.spec.ts`, `arrival-transfer-helper.spec.ts` | Load, airport filter, local checklist progress, errors | Checklist progress is localStorage-only; no API persist (product). |
| Explore | `explore.spec.ts`, `place-details.spec.ts` | Nearby query helpers, chips, search debounce, bookmark, details 404 | Geolocation permission in a real browser is E2E-only. |
| Concierge | `concierge.spec.ts` | Chips, SOS styling, retry, signed-in history restore/delete | Camera/mic composer is out of MVP (`docs/concierge-use-cases.md`). |
| Partners (traveler) | `partners/partner-listings.spec.ts` | Sponsored ranking, disclosure, click then outbound URL | Lead capture UI if any is not covered here. |
| Emergency / embassy / safety | `emergency.spec.ts`, `embassies.spec.ts`, `safety.spec.ts` | Directories, filters, `tel:` / https-only links, errors | — |
| Ops login / guard | `admin-login.spec.ts`, `admin.guard.spec.ts` | Admin login POST, tourist rejected, guard redirect | — |
| Ops home / CMS / FAQ / partners / audit | `admin.spec.ts`, `admin-content*.spec.ts`, `admin-faq*.spec.ts`, `admin-partners*.spec.ts`, `admin-partner-editor.spec.ts`, `admin-audit.spec.ts` | Counts, CRUD, publish, approve/pause gates, audit filters | Referral analytics chart is not a dedicated Angular spec (API covered in Vitest). |

**Asana frontend follow-on** (“onboarding, dashboard, arrival assistant, concierge, nearby helper, itinerary, and emergency”) is met with Karma except tourist **login submit**, **signup**, and **authGuard behavior**. Those three are the highest-value UI gaps.

Services (`*.service.ts`) are not unit-tested in isolation; component specs already assert the HTTP URLs they call. Do not add a second copy of those tests unless a service grows logic beyond HTTP.

## Critical end-to-end journeys (automated)

Add Playwright (`frontend/` or a top-level `e2e/`) against local `ng serve` + API (memory or Docker Postgres). Keep the suite under ~10 minutes. Seed with `npm run db:seed` when using Postgres (`demo@tourist-companion.local` / `ops@tourist-companion.local` — `backend/README.md`).

These match the UAT Asana note: trip creation → arrival, discovery, itinerary, concierge, referral, emergency.

| ID | Journey | Why it is launch-blocking | Already approximated by |
| --- | --- | --- | --- |
| E2E-1 | Signup or login → `/trips/new` 6-step wizard → trip appears on `/trips` | Auth cookies + onboarding are the front door | Vitest auth; Karma onboarding POST; **Karma login/signup gap** |
| E2E-2 | Open Plan → generated itinerary → add/lock a stop → regenerate one day | Core “companion” value | Karma `trip-dashboard.spec.ts` + Vitest itinerary |
| E2E-3 | Arrival checklist (KUL) → transport → SIM → money → transfer helper | First-hour in Malaysia | Karma arrival specs + Vitest `arrival.test.ts` |
| E2E-4 | Explore nearby (KLCC) → place details → sign-in to bookmark | Discovery + auth upsell | Karma explore/details + Vitest places/trip-places |
| E2E-5 | Concierge chip → in-bounds reply; SOS → `/emergency` with `tel:` | Safety boundary | Karma concierge/emergency + Vitest concierge/emergency |
| E2E-6 | Sponsored partner card → click tracked → HTTPS outbound (or `/r/:code`) | Marketplace integrity | Karma listings + Vitest referrals |
| E2E-7 | Ops: `/admin/login` → create/approve partner → publish FAQ → row on `/admin/audit` | Ops cannot silently break traveler content | Karma admin specs + Vitest partners/faqs/audit |

**Manual UAT** (Asana: Run end-to-end UAT) still runs these journeys on staging after security review, plus devices/viewports Karma never sees. Automated E2E is a gate; UAT is the launch sign-off.

## Remaining gaps (priority)

### P0 — do before calling the MVP testable

1. **Playwright critical paths E2E-1…E2E-7** (or a documented subset if time-boxed: E2E-1, E2E-2, E2E-5, E2E-6).
2. **Postgres API smoke** in Vitest or Playwright: signup uniqueness, trip CRUD, itinerary persist, referral click, admin approve, restart process and read the same rows.
3. **Karma: tourist login submit, signup, `authGuard` returnUrl** — the only traveler auth UI holes.

### P1 — close the automated-test Asana items

4. CORS + cookies: allowed `FRONTEND_ORIGIN` reflects `Access-Control-Allow-Credentials`; unknown origins do not. At least one inject or Playwright case should authenticate the way the SPA does (`withCredentials` / session cookie), not only `Authorization: Bearer`.
5. Enable Karma coverage in CI as a report only (no hard fail until a baseline exists). Optionally add Vitest coverage the same way.
6. Turn CI on pull request once the suite is green locally (`workflow_dispatch` stays as a manual escape hatch).

### P2 — do not block launch

7. Isolated tests for `shared/types` (compile-time is the real contract today).
8. Password-reset UI (API exists; no Angular screen).
9. Live provider contract tests behind an explicit opt-in (`GOOGLE_PLACES_API_KEY` / `LLM_API_KEY`), never default CI.
10. Visual/regression screenshots vs Stitch; performance (separate Asana: Run performance checks).

## What not to test in MVP

- Pixel-perfect Stitch parity in Karma (a few chrome assertions are enough).
- Real-time maps tiles, camera, or mic.
- Multi-instance metrics aggregation (`docs/observability.md`: in-process snapshot).
- Payout reports (out of product; `docs/partner-onboarding.md`).
- Load/soak except the dedicated performance task.

## Implementation notes

- New backend endpoints: add `app.inject` cases next to the route file’s existing `backend/test/*.test.ts`. Prefer one happy path, one 401/403, one validation 400.
- New Angular screens: add a `*.spec.ts` beside the component; mock HTTP; assert one error/empty state.
- Do not duplicate itinerary generation or concierge classifier logic in Karma — those stay Vitest unit tests.
- `NODE_ENV=test` is required for in-memory stores. Staging/production configs without `DATABASE_URL` are rejected (`config.test.ts`).
- Never commit secrets or hit production APIs from tests.

## Related docs

- `docs/architecture.md` — services and folders
- `docs/observability.md` — health, metrics, audit
- `docs/trip-onboarding.md` — wizard rules
- `docs/concierge-use-cases.md` — in-bounds vs SOS
- `docs/partner-onboarding.md` / `docs/partner-categories.md` — approve gates
- `backend/README.md` — migrate, seed, demo users
- `infra/SECRETS.md` — CI secret injection
