# Backend database

PostgreSQL is the system of record for users, trips, places, partner providers, and referrals.

## Local Postgres

From the repo root:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Copy `backend/.env.development.example` (or `.env.example`) to `backend/.env`. Staging and production placeholders: `.env.staging.example` and `.env.production.example`. Do not commit populated env files. Default URL:

`postgres://tourist:tourist@127.0.0.1:5432/tourist_companion`

## Migrate

From `backend/`:

```bash
npm run db:migrate
```

Other commands:

- `npm run db:migrate:down` — roll back the latest migration
- `npm run db:migrate:create -- name_of_change` — add a new migration file

Migrations live in `backend/migrations/` and are applied with [node-pg-migrate](https://github.com/salsita/node-pg-migrate).

## Seed

Development seed is **idempotent** (`ON CONFLICT` / existence checks). It creates one demo user, KL trip, KLIA place, Grab `transfers` provider with listing/location/contact fields, an arrival-channel referral, and KLIA/KLIA2 arrival checklist items. JSON copies: `db/arrival-checklist.json`, `db/malaysia-knowledge.json` (concierge MVP articles), and `db/malaysia-places.json` (Explore nearby seed when no maps API key).

```bash
npm run db:seed
```

SQL source of truth: `db/seed.sql`. Do not run seed in production.

## Core entities

| Table | Purpose |
| --- | --- |
| `users` | Traveller accounts (email, display name, password hash) |
| `tourist_profiles` | Language, dietary preferences, mobility needs, travel style |
| `trips` | A user's visit window, destination, travelers, budget, interests, and arrival/stay details |
| `places` | Airports, attractions, and other POIs |
| `trip_places` | Wishlist links between trips and places |
| `itineraries` | One plan per trip (1–7 days, draft/active/archived) |
| `itinerary_days` | Calendar days on a plan |
| `itinerary_items` | Timed activity / meal / travel / note blocks |
| `providers` | Partner businesses: listing, location, contact, commission, and active status |
| `referrals` | Attribution / click tracking (`status`, `channel`, optional itinerary item) |
| `arrival_checklist_items` | CMS-ready airport arrival steps by traveler stage (KLIA / KLIA2) |
| `concierge_messages` | Last N concierge turns per trip for signed-in users, with TTL and delete |

The API opens a `pg` pool (optional `DATABASE_URL`), reports DB status on `GET /health?verbose=true`, exposes `GET /metrics`, serves tourist auth under `/auth/*`, tourist profile under authenticated `GET`/`PATCH /profile`, trip CRUD under authenticated `/trips`, trip-scoped itinerary CRUD under authenticated `GET`/`PUT /trips/:id/itinerary`, `POST`/`PATCH`/`DELETE /trips/:id/itinerary/items`, `POST /trips/:id/itinerary/reorder`, and `POST /trips/:id/itinerary/regenerate` (draft plan from trip dates, interests, budget, destination, and travel style using the Malaysia places seed; keeps `locked` items; itinerary days include weather planning hints from Open-Meteo when available, otherwise the Malaysia climate seed, always with disclaimer language), public `GET /knowledge?topic=&category=&q=` (Malaysia concierge seed: transport, etiquette, weather, payments, food, attractions, FAQ), public `GET /places/categories`, `GET /places/nearby` (filters: `category`, `radius`, `openNow`, `q`, approximate `lat`/`lng` or `area`; Google Places or Overpass when configured; otherwise the Malaysia nearby seed — `docs/nearby-categories.md`), and `GET /places/:id` (address, contact, hours, licensed photos, and navigation/booking actions), `POST /concierge/chat` (optional JWT; rate limited; persists last N messages per trip for signed-in users with TTL; LLM when `LLM_API_KEY` is set, otherwise retrieve-and-rank from the knowledge seed with no fake live data), authenticated `GET`/`DELETE /concierge/history`, public `GET /arrival-checklist?airport=&stage=`, `GET /arrival-transport?airport=`, `GET /arrival-connectivity?airport=`, `GET /arrival-currency?airport=`, and `GET /arrival-transfer?airport=&destination=`, and partner admin CRUD under `/admin/partners` (`GET`/`POST` `/admin/partners`, `GET`/`PATCH`/`DELETE` `/admin/partners/:id`, `POST` `/admin/partners/:id/approve` and `/pause`; `ADMIN_TOKEN` via `X-Admin-Token` or Bearer, or a JWT with `role: "admin"`). See `docs/observability.md` and `docs/concierge-use-cases.md`.
