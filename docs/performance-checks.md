# Performance checks

Local timing of Tourist Companion (Angular SPA + Fastify API + PostgreSQL) for API response times, database queries, AI concierge latency, map/places usage, and common mobile journeys.

Asana: [Run performance checks](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218665030399430) (P2, estimate M). Depends on nearby UI.

Date: 20 September 2026. Method: `curl` timing against `http://127.0.0.1:3000` (API) and `http://localhost:4200` (SPA), plus `EXPLAIN ANALYZE` on the seeded Postgres. No GitHub Actions added. Asana task left open. No git commit.

## Summary

On this laptop, **seed-backed public APIs are fast**: `GET /metrics` after the run reported process p50 **0.65 ms**, p95 **5.5 ms**, and 205 of 217 counted requests finishing in **≤ 5 ms**. Login is the expected bcrypt outlier (~60–75 ms). Concierge is on the retrieve-and-rank path (`LLM_API_KEY` unset) at **2–13 ms**. Nearby search uses the Malaysia seed (`provider: seed`), not Google Places.

The two issues that will actually hurt a traveler are **payload and a broken Plan read**:

| Severity | Finding |
| --- | --- |
| High | `GET /trips/:id/itinerary` returns **500** on the seeded demo trip (`itinerary_days_itinerary_number_unique`). Home then Plan cannot load a day card. First failure took **128 ms**; retries ~5 ms. |
| High | Dev SPA ships **one 1.84 MB `main.js`** (eager routes, unoptimized `ng serve`) plus Google Fonts and a **137 KB** Stitch map PNG. API JSON is small; the shell is the mobile cost. |
| Medium | Explore never sends GPS (`lat`/`lng`). Nearby is always a named area (default KLCC). Map view is a static image, not a maps SDK. |
| Medium | When `PLACES_PROVIDER=google`, `category=all` fans out **seven** Nearby Search calls (8 s timeout each). Place photos are sequential (up to 3 × 8 s). Overpass timeout is **12 s**. |
| Medium | Live LLM (when keyed) has an **8 s** abort. Weather on itinerary GET uses Open-Meteo with a **2.5 s** timeout and seed fallback. Neither was live in this run. |
| Medium | Referral analytics loads **all** `referrals` and `providers` into memory. Fine at seed size (1 + 3 rows); not a rollup query. |
| Low | `GET /knowledge` returns the full corpus (**33 KB**). FAQ search is `ILIKE '%q%'` over five CMS rows. |

MVP bar from this pass: keep seed/public JSON p95 under ~25 ms locally, treat login bcrypt (~60 ms) as acceptable, keep concierge retrieve-and-rank under ~50 ms, and do not block first paint on itinerary GET or a live maps/LLM round trip.

## Environment

| Piece | This run |
| --- | --- |
| Host | macOS, API `tsx watch` on port 3000, Angular `ng serve` on port 4200 |
| Bind | API answers `127.0.0.1:3000`. SPA is advertised as `http://localhost:4200/` (IPv6 `::1`). `curl http://127.0.0.1:4200` fails; use `localhost`. |
| Database | `GET /health?verbose=true` → `database: up`. Seeded `tourist_companion`. Pool `max: 10`. |
| Places | Unset `PLACES_PROVIDER` / no Google key → Malaysia seed (19 records; 17 within default KLCC 2 km). |
| Concierge | No usable `LLM_API_KEY` → `mode: retrieve_and_rank`. |
| Weather | Default non-test is Open-Meteo (`WEATHER_TIMEOUT_MS=2500`). Itinerary GET never succeeded, so live weather was not timed. |
| Auth | Demo tourist `demo@tourist-companion.local`; ops `ops@tourist-companion.local`. |
| Process metrics | After this run: `requestsTotal` 217, `errorsTotal` 10, latency max 128 ms (`GET /trips/:id/itinerary`). |

`ng serve` banner (unoptimized): initial **757 KB** (`main.js` 752.50 KB + `styles.css` 4.57 KB). Transferred `GET /main.js` was **1,835,654 bytes** (~1.84 MB) because the Vite/Angular dev transform is larger than the banner “raw size”.

## Method

Repeat locally (API already on 3000, app on 4200):

```bash
# API (IPv4)
curl -sS -o /dev/null -w '%{http_code} ttfb=%{time_starttransfer} total=%{time_total} size=%{size_download}\n' \
  http://127.0.0.1:3000/health

# SPA (hostname, not 127.0.0.1)
curl -sS -o /dev/null -w '%{http_code} ttfb=%{time_starttransfer} total=%{time_total} size=%{size_download}\n' \
  -H 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15' \
  http://localhost:4200/explore
```

This pass used 3–7 samples per URL after a warmup GET. Times are wall-clock `curl` `time_total` / `time_starttransfer` (TTFB) in milliseconds. They include localhost loopback, not cellular RTT. Percentiles on n=3–7 are indicative, not a load test.

Postgres: `EXPLAIN (ANALYZE, BUFFERS)` as role `tourist` against the same seed. Live row counts are tiny (users 2, trips 1, content 5, providers 3, nearby `places` table 1 — Explore does **not** read that table; it uses the in-process Malaysia seed).

## API response times

Server-side `GET /metrics` after the run (Fastify `elapsedTime`, excludes `/metrics` itself):

| | p50 | p95 | p99 | max |
| --- | --- | --- | --- | --- |
| All counted routes | 0.65 ms | 5.5 ms | 63.9 ms | 127.9 ms |

Histogram: 205 / 217 ≤ 5 ms; 216 / 217 ≤ 100 ms. The p99 is login (bcrypt). The max is the itinerary 500.

### Public JSON (seed / in-process)

| Endpoint | n | Status | p50 total | p95 total | Size |
| --- | --- | --- | --- | --- | --- |
| `GET /health` | 7 | 200 | 0.8 ms | 1.0 ms | 54 B |
| `GET /health?verbose=true` | 7 | 200 | 1.3 ms | 8.3 ms | 261 B |
| `GET /emergency` | 5 | 200 | 0.8 ms | 1.1 ms | 5.2 KB |
| `GET /emergency?urgency=sos` | 1 | 200 | 0.6 ms | — | 2.4 KB |
| `GET /embassies` | 5 | 200 | 0.9 ms | 1.2 ms | 16.1 KB |
| `GET /embassies?q=united` | 5 | 200 | 0.9 ms | 1.1 ms | 2.4 KB |
| `GET /safety` | 5 | 200 | 0.8 ms | 0.8 ms | 3.8 KB |
| `GET /knowledge` | 5 | 200 | 2.1 ms | 12.1 ms | **32.9 KB** |
| `GET /knowledge?q=klia` | 5 | 200 | 1.8 ms | 2.0 ms | 4.8 KB |
| `GET /faqs` | 5 | 200 | 1.7 ms | 1.8 ms | 691 B |
| `GET /partners` | 5 | 200 | 1.8 ms | 3.2 ms | 1.9 KB |
| `GET /arrival-checklist` | 5 | 200 | 1.7 ms | 2.7 ms | 4.4 KB |
| `GET /arrival-transport?airport=KUL` | 5 | 200 | 0.8 ms | 1.0 ms | 3.0 KB |
| `GET /arrival-connectivity?airport=KUL` | 5 | 200 | 0.8 ms | 1.1 ms | 4.5 KB |
| `GET /arrival-currency?airport=KUL` | 5 | 200 | 0.7 ms | 0.9 ms | 4.7 KB |
| `GET /arrival-transfer?airport=KUL&destination=KLCC` | 5 | 200 | 0.7 ms | 1.1 ms | 2.1 KB |
| `GET /places/categories` | 5 | 200 | 0.7 ms | 0.7 ms | 977 B |
| `GET /places/nearby` (default KLCC) | 5 | 200 | 1.0 ms | 1.5 ms | 9.4 KB (17 places) |
| `GET /places/nearby?area=klcc&category=food` | 5 | 200 | 0.9 ms | 0.9 ms | 2.9 KB |
| `GET /places/nearby?area=bukit_bintang&openNow=true` | 5 | 200 | 1.0 ms | 1.4 ms | 8.9 KB |
| `GET /places/nearby?area=batu_caves&category=attractions` | 5 | 200 | 0.8 ms | 0.9 ms | 1.3 KB |
| `GET /places/nearby?q=pharmacy&walk15=true` | 5 | 200 | 0.9 ms | 1.1 ms | 2.3 KB |
| `GET /places/nearby?lat=3.158&lng=101.712&radius=1500&category=atm` | 5 | 200 | 0.9 ms | 1.2 ms | 1.8 KB |
| `GET /places/nearby` iPhone UA | 5 | 200 | 0.9 ms | 1.5 ms | 9.4 KB |
| `GET /places/my-attr-petronas` | 5 | 200 | 1.0 ms | 1.4 ms | 1.4 KB |

Largest public bodies: full knowledge (33 KB), embassy directory (16 KB), default nearby (9 KB). All are fine on Wi‑Fi; knowledge is the one to keep filtered (`?q=` / topic) on cellular.

`GET /emergency?urgency=immediate` is **400** (valid values are `sos` \| `assistance`). Those five 400s are part of `errorsTotal`.

### Authenticated JSON

| Endpoint | n | Status | p50 total | p95 total | Notes |
| --- | --- | --- | --- | --- | --- |
| `POST /auth/login` | 3 | 200 | 63.6 ms | 64.5 ms | bcrypt; matches metrics p99 |
| `POST /auth/admin/login` | 1 | 200 | 74.8 ms | — | Same hasher |
| `GET /auth/me` | 5 | 200 | 1.0 ms | 1.9 ms | JWT only |
| `GET /profile` | 5 | 200 | 2.2 ms | 2.8 ms | `users` ⋈ `tourist_profiles` |
| `GET /trips` | 5 | 200 | 2.5 ms | 4.3 ms | 1 trip |
| `GET /trips/:id` | 5 | 200 | 1.6 ms | 2.8 ms | |
| `GET /trips/:id/places` | 3 | 200 | 2.3 ms | 3.3 ms | 1 saved place |
| `GET /trips/:id/itinerary` | 3 | **500** | 5.6 ms | 130.8 ms | See [Database queries](#database-queries) |
| `GET /concierge/history` | 5 | 200 | 2.0 ms | 9.1 ms | Empty, then used after chat persist |
| `GET /referrals` | 3 | 200 | 1.4 ms | 2.1 ms | |
| `GET /admin/dashboard` | 5 | 200 | 2.1 ms | 9.5 ms | Store counts + in-process metrics |
| `GET /admin/audit` | 3 | 200 | 1.8 ms | 2.5 ms | Index on `created_at` |
| `GET /admin/partners` | 3 | 200 | 1.6 ms | 6.0 ms | |
| `GET /admin/content` | 3 | 200 | 1.7 ms | 6.7 ms | 5 rows |
| `GET /admin/faqs` | 3 | 200 | 3.0 ms | 3.1 ms | |
| `GET /admin/referrals/analytics` | 3 | 200 | 4.3 ms | 5.4 ms | Full-table load |

Default rate limits (in-process, per IP or user): auth **20 / 15 min**, places **60 / min**, concierge **30 / min**. They are not shared across API replicas.

## Database queries

Seeded sizes: `arrival_checklist_items` 24, `content_items` 5, `providers` 3, `users` 2, `trips` 1, `referrals` 1, `itinerary_*` empty until the first itinerary GET.

`EXPLAIN ANALYZE` (hot cache, shared buffers hits):

| Query (as used by stores) | Plan | Execution |
| --- | --- | --- |
| `users` by email | Index Scan `users_email_unique` | 0.02 ms |
| `trips` by `user_id` | Index Scan `trips_user_id_idx` | 0.11 ms |
| Published FAQs `kind + published` | Index Scan `content_items_kind_published_idx` | 0.03 ms |
| FAQ `ILIKE '%halal%'` | Same index, then filter | 0.03 ms (1 row) |
| Audit list `ORDER BY created_at DESC LIMIT 50` | Index Scan `audit_events_created_at_idx` | 0.04 ms |
| Concierge history by user+trip | Index Scan `concierge_messages_trip_created_idx` | 0.04 ms |
| Active partners | Seq Scan `providers` (3 rows; partial `providers_active_idx` unused) | 0.02 ms |
| All referrals (analytics) | Seq Scan | 0.02 ms |
| Arrival checklist `airport_code = 'KUL'` | Seq Scan 24 rows (index exists; planner prefers seq) | 0.02 ms |
| Core `places` by category | Index Scan — **unused by Explore** | 0.02 ms |

**What is healthy at MVP scale**

- Login, trips, profile, FAQs, audit, and concierge history hit unique or covering indexes.
- Itinerary **read** assembly is three queries (header, days, items `WHERE day_id = ANY($1)`), not N+1 selects.
- Parameterized SQL throughout; no string-concatenated identifiers in the timed paths.

**What will bite later**

1. **Itinerary GET is a write, and it 500s.** `GET /trips/:id/itinerary` calls `ensure()`, which inserts a draft skeleton, then `alignDays()`. On the seeded trip (1–8 Oct 2026, clipped to 7 days) that INSERT/UPDATE hits `itinerary_days_itinerary_number_unique`. Likely date shift: `toIsoDate` uses `Date#toISOString()` (UTC) on `DATE` values that `node-pg` may interpret in local time (UTC+8 here). Home loads this route after `GET /trips`, so the signed-in landing card fails.
2. **Per-row writes.** `insertDays` and item replace loop one statement per day/item (max 7 days, 40 items). Acceptable for MVP; batch if regenerate is on the hot path.
3. **Analytics is an application join.** `getReferralAnalytics` `SELECT`s every referral and provider, then rolls up in JS. Add `GROUP BY` / filtered SQL before marketplace volume grows.
4. **CMS search cannot use btree.** Leading-wildcard `LIKE` plus `unnest(tags)`. Fine for tens of FAQs; add `pg_trgm` or restrict `q` to title if ops search grows.
5. **Pool.** `max: 10`. Concierge signed-in chat already does profile + trips + history list + FAQ list + history append. Stay under that on a single instance.

`idx_scan = 0` on several indexes (`trips_start_date_idx`, `providers_active_idx`, `referrals_status_idx`, `concierge_messages_expires_at_idx`) only means this seed never needed them. Keep them.

## AI latency

`POST /concierge/chat` (optional auth). This run: **retrieve-and-rank only**.

| Prompt | n | p50 | p95 | Size | Mode |
| --- | --- | --- | --- | --- | --- |
| Halal food near KLCC (anon) | 3 | 4.5 ms | 5.4 ms | 2.4 KB | `retrieve_and_rank` / `food_spice_diet` |
| KLIA → KLCC train (anon) | 3 | 1.9 ms | 2.5 ms | 1.8 KB | `arrival_ops` |
| Emergency number (anon) | 3 | 2.1 ms | 2.3 ms | 1.0 KB | `out_of_bounds` (SOS copy, no LLM) |
| After landing at KLIA (JWT + trip) | 3 | 6.3 ms | 12.6 ms | 1.3 KB | persist history (`persisted: true`) |

Work on every chat: classify → retrieve knowledge seed → `publishedFaqArticles()` (`SELECT` published FAQs) → optional history append. Signed-in adds profile + trip context (~+4–8 ms here).

**When `LLM_API_KEY` is set** (`backend/src/concierge/llm.ts`): OpenAI-compatible `chat/completions` with `response_format: json_object`, **8 s abort**, then retrieve-and-rank fallback on error/timeout. Expect **hundreds of ms to several seconds** on a real key, bounded by 8 s. That is the dominant traveler-facing wait on Concierge, not the 2–13 ms local path.

SOS / out-of-bounds replies skip the model (measured ~2 ms). Do not add an LLM hop on that path.

Rate limit **30 chats / minute / user-or-IP** is enough for typing; a scripted client will 429.

## Map / places usage

Explore (`/explore`) calls `GET /places/nearby` with category, area, quick filters, and 250 ms search debounce. It does **not** call `navigator.geolocation` and does **not** send `lat`/`lng`. The API supports a coarsened GPS pin (~100 m); the UI never uses it. Origin is the named area (default KLCC & Downtown, 2 km).

Map chrome is `STITCH_EXPLORE_MAP_URL` (static PNG, **137 KB**, p50 **72 ms** / p95 **780 ms** to `lh3.googleusercontent.com` from this network). Pins are CSS percentages from lat/lng — no Maps JavaScript SDK, no tile server, no per-pan billing. That is the right MVP cost model; it is not a live map.

Provider matrix (`docs/nearby-categories.md`):

| Provider | This run | Timeout / fan-out | Risk |
| --- | --- | --- | --- |
| `seed` | Yes, `fallback: false` | In-process filter of 19 records | p95 ~1.5 ms. Payload 9 KB for “all”. |
| `google` | Not configured | 8 s per HTTP. `category=all` → **7 parallel** Nearby Search type groups. Text search is one `searchText`. Details fetches up to **3 photos sequentially**. | Worst case many seconds; seed fallback on failure. Quota cost on chip-spam; 60/min limiter helps. |
| `overpass` | Not configured | **12 s** abort to `OVERPASS_URL` | Public Overpass is often slower than Google; always have seed fallback. |

Directions CTA is an external `https://www.google.com/maps/dir/` link (no embed). Bookmarking hits `GET/POST/DELETE /trips/:id/places` (~2–3 ms here).

## Common mobile scenarios

SPA HTML for every traveler route (`/`, `/explore`, `/arrival`, `/concierge`, `/emergency`, `/safety`, `/embassies`, `/login`, `/trips`, …) is the same **1.1 KB** document in **~1.3 ms** (iPhone UA). Routes are not lazy; the browser then pulls:

| Resource | Size | p50 (this LAN) | Mobile note |
| --- | --- | --- | --- |
| `/main.js` | **1.84 MB** | 9.1 ms | Dominates 3G/airport Wi‑Fi. Production budget: initial warning 500 KB / error 1 MB (`frontend/angular.json`). Measure `ng build` before launch. |
| `/styles.css` | 4.6 KB | 0.8 ms | Fine |
| `/polyfills.js` | 416 B | 0.7 ms | Fine |
| Plus Jakarta Sans CSS | 10 KB | 56–138 ms | Extra RTT to `fonts.googleapis.com`; font files follow |
| Material Symbols CSS | 699 B | 62–353 ms | Same |
| Stitch map PNG | 137 KB | 72–780 ms | Explore map tab |
| Stitch logo PNG | 29 KB | 69 ms | Header |

Layout already targets a phone: `viewport-fit=cover`, `theme-color`, `apple-mobile-web-app-capable`, 48 px tab targets, `env(safe-area-inset-*)`, shell `max-width: 40rem`. That is not the bottleneck.

| Journey | What we timed | Result |
| --- | --- | --- |
| Cold open home (anon) | HTML + `GET /arrival-checklist` + `GET /places/nearby?area=klcc` + `GET /partners` | APIs under 3 ms; JS/fonts are the wait |
| Cold open home (signed in) | Above + `/auth/me` + `/trips` + **`/trips/:id/itinerary`** | Itinerary **500** — Plan card cannot render |
| Explore chips / search | Nearby variants + 250 ms debounce | Seed p95 ≤ 1.5 ms. Chip hammering is limiter-bound (60/min), not CPU |
| Place details | `/places/my-attr-petronas` + SPA `/explore/:id` | 1.4 ms / 1.4 KB JSON |
| Arrival at KLIA | checklist, transport, SIM, money, transfer helper | 0.7–2.7 ms, 2–5 KB each |
| SOS | `/emergency?urgency=sos` + Concierge SOS chat | 0.6 ms directory; 2 ms canned chat. Keep this offline-tolerant later |
| Concierge question | dining / transport / signed-in | 2–13 ms retrieve-and-rank; live LLM not measured |
| Login on device | `POST /auth/login` | ~64 ms — acceptable; do not add extra round trips after cookie set |
| Embassy lookup | `/embassies` 16 KB vs `?q=united` 2.4 KB | Prefer typed search (already debounced 250 ms) |

**IPv4 vs SPA:** automation against `127.0.0.1:4200` will look like a down app. Use `localhost:4200`.

## Recommended follow-ups (product/code, not CI)

1. Fix itinerary `alignDays` date identity and unique-key updates so `GET /trips/:id/itinerary` is a read (or an idempotent upsert that cannot 500). Re-time with Open-Meteo attached; expect up to **2.5 s** on a cold weather miss, then seed fallback.
2. Split or lazy-load the Angular bundle; self-host or subset fonts; keep the Stitch map as a static asset (or drop it on `connection.effectiveType` slow-2g). Re-check `ng build --configuration production` against the 500 KB warning.
3. Optionally send coarsened `lat`/`lng` from Explore after a permission grant; keep the named-area fallback. Do not load a maps SDK for MVP.
4. If Google Places ships, never fan out seven type searches for `all` on a mid-range phone radio; cap types or cache by coarsened pin + chip + radius.
5. Keep SOS and retrieve-and-rank off the LLM. Surface LLM latency in the composer (timeout 8 s already).
6. Replace referral analytics with SQL aggregates before partner volume grows.

## Out of scope this pass

- Load / soak tests, k6, or a GitHub Actions timing job (explicitly not added).
- Live Google Places, Overpass, Open-Meteo, or LLM keys.
- Production CDN/gzip of the SPA (dev server only).
- Marking the Asana task complete.
