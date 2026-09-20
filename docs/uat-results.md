# End-to-end UAT results

Manual traveler (and ops smoke) UAT of Tourist Companion against local `http://localhost:4200` (Angular SPA) and `http://localhost:3000` (Fastify API + PostgreSQL).

Asana: [Run end-to-end UAT](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218664509826125) (EPIC 10 — QA, Security & MVP Launch). Notes: trip creation through arrival, discovery, itinerary, concierge, referral, and emergency. Journeys follow `docs/test-strategy.md` E2E-1…E2E-7.

Date: 20 September 2026. Local only. Asana task left open. No git commit.

## Verdict

**FAIL for launch sign-off.** Auth, onboarding, arrival, Explore, concierge, SOS/emergency, referrals, privacy/terms, and ops smoke all worked in a real browser against Postgres. **Plan / itinerary (E2E-2) is broken** for both the seeded demo trip and a freshly created trip: `GET /trips/:id/itinerary` and generate/regenerate return **500**. That is launch-blocking for the companion loop.

| ID | Journey | Result |
| --- | --- | --- |
| E2E-1 | Signup / login → 6-step `/trips/new` → trip on `/trips` | **PASS** (date display defect) |
| E2E-2 | Plan → generate itinerary → add/lock stop → regenerate a day | **FAIL** |
| E2E-3 | Arrival checklist (KUL) → transport → SIM → money → transfer helper | **PASS** |
| E2E-4 | Explore nearby (KLCC) → place details → bookmark | **PASS** |
| E2E-5 | Concierge chip; SOS → `/emergency` with `tel:` | **PASS** |
| E2E-6 | Sponsored partner card → click tracked → HTTPS outbound | **PASS** |
| E2E-7 | Ops login → partners / CMS / FAQ / audit (read-only smoke) | **PASS** (smoke; no mutations this run) |

Known issue from the Asana/performance notes (`GET /trips/:id/itinerary` may 500 on the demo trip) **reproduced**, and it is **not demo-only**.

## Environment

| Piece | This run |
| --- | --- |
| Host | macOS. API `tsx watch` on port 3000 (IPv4 `*:3000`). Angular `ng serve` on port 4200 (IPv6 `[::1]:4200`). |
| SPA API | `frontend/src/environments/environment.development.ts` → `apiBaseUrl: http://localhost:3000`. Cookie `tc_access` is `SameSite=Lax`; SPA and API must share the `localhost` host. Calling the API as `127.0.0.1` from the SPA is cross-site and drops the session. |
| Health | `GET /health?verbose=true` → `status: ok`, `database: up`. After this run: `requestsTotal` 325, `errorsTotal` 33, latency max **128 ms** (itinerary 500). |
| Places | Malaysia seed (not Google). KLCC nearby returned **17** places. |
| Concierge | No usable `LLM_API_KEY` → `mode: retrieve_and_rank`. |
| Auth | New tourist `uat-20260920-t@tourist-companion.local` (display name **UAT Traveler**, user `0aa4549f-a4ce-4fdc-ae4c-4737e46fcef5`). Seeded ops `ops@tourist-companion.local`. Seeded demo tourist used only to confirm the known itinerary 500. |
| Trip | UAT trip `e36620d1-1cb1-4b35-b28e-a59eca0a349a` — Kuala Lumpur, food + culture, medium, balanced. Demo trip `0ef36a38-3b31-40e3-8119-92a930572f23`. |
| Browser | Cursor-owned Chromium tab, desktop viewport. Not a physical phone. |
| Port clash | A MediQ Next.js `next-server` was bound to IPv6 `*:3000`. `http://localhost:3000/health` then **307** to `/en/health` and the SPA showed **Failed to fetch**. That process was stopped so Fastify could answer `localhost:3000`. Leave Fastify up, or MediQ will steal IPv6 `:3000` again. |

## Method

Walk the `docs/test-strategy.md` critical journeys in the browser the way a traveler would: click, type, submit, navigate. Confirm API status from the Fastify request log and, for itinerary, a cookie-authenticated `curl` to `127.0.0.1:3000`. Do not mutate ops seed (no Pause / Delete / Unpublish).

## E2E-1 — Signup, login, trip creation — PASS

Anonymous `/trips/new` redirected to `/login?returnUrl=%2Ftrips%2Fnew`. Signup `POST /auth/signup` **201**, session cookie set, wizard completed (Kuala Lumpur, 1 adult, food + culture, medium budget, balanced style). `POST /trips` **201**; trip listed on Plan.

Entered dates **2026-10-05 → 2026-10-08**. `GET /trips` returns **2026-10-04 → 2026-10-07**. Cause: Postgres `DATE` mapped with `Date#toISOString()` in `backend/src/trips/pg-store.ts` (`toIsoDate`) in a UTC+8 session, so calendar days shift back one. Plan chrome shows the shifted range. This does not fail the journey (trip exists), but it is the likely trigger for E2E-2.

Other notes (not fail):

- Login “Create one” is `routerLink="/signup"` with **no** `returnUrl` query (`frontend/src/app/auth/login.html`). Guarded entry still works if you stay on `/login`.
- Tourist **Profile** has no Sign out. Only `/admin` exposes logout (`POST /auth/logout`).

## E2E-2 — Itinerary generate / edit — FAIL

Plan cannot load a day card. Both trips:

| Request | Trip | HTTP |
| --- | --- | --- |
| `GET /trips/:id/itinerary` | demo `0ef36a38-…` | **500** |
| `POST /trips/:id/itinerary/regenerate` | demo | **500** |
| `GET /trips/:id/itinerary` | UAT `e36620d1-…` | **500** |
| `POST /trips/:id/itinerary/generate` | UAT | **500** |

Body: `INTERNAL_ERROR` / `duplicate key value violates unique constraint "itinerary_days_itinerary_number_unique"` (`code` 23505). Stack: `alignDays` in `backend/src/itinerary/pg-store.ts` (UPDATE `itinerary_days.day_number` without swapping through a free number). `ensure()` always runs `alignDays` on GET, so a date mismatch from `toIsoDate` makes **read** fail, not only generate.

Could not add, lock, or regenerate a stop. First demo GET took **128 ms**; later failures ~5–22 ms.

## E2E-3 — Arrival — PASS

`/arrival` KUL + KLIA2 checklist loaded. Ticked **Clear immigration / MDAC** → **1/12** (localStorage only, as designed). Transfer helper for **KLCC** returned official modes. Dedicated `/arrival/sim`, `/arrival/money`, `/arrival/transport` showed CelcomDigi / currency / KLIA Ekspres–bus–Grab–private copy and Grab partner card.

## E2E-4 — Explore nearby — PASS

`/explore` KLCC: **17** places. Bookmark Petronas Twin Towers `POST /trips/…/places` **201** (`my-attr-petronas`). Details `/places/my-attr-petronas` **200**. Geolocation not used; nearby is named-area seed (same as `docs/performance-checks.md`).

## E2E-5 — Concierge and emergency — PASS

Spicy-food chip → `POST /concierge/chat` **200**, `category: food_spice_diet`, `persisted: true`, retrieve-and-rank. Composer needs a real input event (paste-only did not bind `ngModel`).

SOS / “I need emergency help” → **200**, `category: emergency`, `escalationLevel: sos`, `persisted: false`. `/emergency` lists **tel:999** and **tel:112**. `/embassies` and `/safety` loaded (**200**).

## E2E-6 — Partner referral — PASS

Klook Malaysia sponsored card: `POST /referrals/clicks` **201**, outbound **HTTPS** with UTM. Disclosure copy present (“We may earn a commission…”). Did not complete a partner booking (out of MVP).

## E2E-7 — Ops smoke — PASS (read-only)

Tourist `/admin` redirected to `/admin/login?returnUrl=%2Fadmin`. Ops login `POST /auth/admin/login` **200**. Dashboard: 3 users, 2 trips, 2 referral records, 33 HTTP errors this process. Partners: CelcomDigi, Grab, Klook (Active; Klook Sponsored). Content CMS: 5 published articles. FAQ desk: published tap-water FAQ. Audit: 4 rows including prior partner approve/pause and FAQ publish/unpublish.

Did **not** create/approve a partner or publish a FAQ this session (avoid mutating seed). The strategy’s mutation path is therefore unproven here; reads and the existing audit trail are.

## Defects

| Sev | Area | Finding |
| --- | --- | --- |
| **High** | Itinerary | GET/generate/regenerate **500** on demo **and** new trips. `alignDays` hits `itinerary_days_itinerary_number_unique`. Blocks E2E-2. |
| **High** | Trip dates | `toIsoDate` uses `toISOString()`, so DATE values display and align one day early in UTC+8. Wizard 5–8 Oct 2026 stored/shown as 4–7 Oct. Feeds the align mismatch. |
| Medium | Local ports | Another app on IPv6 `:3000` makes the configured SPA `localhost:3000` miss Fastify. Document in `infra` or bind Fastify dual-stack / a dedicated port. |
| Low | Login → signup | “Create one” drops `returnUrl`. |
| Low | Tourist session | No Sign out on Profile. |
| Low | Chrome | Bottom tab bar can intercept clicks on page actions (need scroll / overlay-aware targets). |

## Out of scope this run

- Physical devices / small viewports (Karma never sees these either).
- Live Google Places, Overpass, Open-Meteo weather on a successful itinerary GET, or LLM concierge.
- Playwright (still not in the repo).
- Ops create → approve → publish mutations.
- Password-reset UI (API only).

## Related docs

- `docs/test-strategy.md` — E2E-1…E2E-7 definitions
- `docs/performance-checks.md` — same itinerary 500 timed on the demo trip
- `docs/security-review.md` — cookies, CORS, SOS persistence
- `docs/trip-onboarding.md` / `docs/concierge-use-cases.md`
- `backend/README.md` — seed users
