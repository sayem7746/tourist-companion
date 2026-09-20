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

Development seed is **idempotent** (`ON CONFLICT` / existence checks). It creates one demo user, KL trip, KLIA place, Grab provider, trip-place link, referral, and KLIA/KLIA2 arrival checklist items. JSON copies: `db/arrival-checklist.json`, `db/malaysia-knowledge.json` (concierge MVP articles), and `db/malaysia-places.json` (Explore nearby seed when no maps API key).

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
| `trip_places` | Itinerary links between trips and places |
| `providers` | Partner businesses used for referrals |
| `referrals` | Attribution codes from a user/trip to a provider |
| `arrival_checklist_items` | CMS-ready airport arrival steps by traveler stage (KLIA / KLIA2) |
| `concierge_messages` | Last N concierge turns per trip for signed-in users, with TTL and delete |

The API opens a `pg` pool (optional `DATABASE_URL`), reports DB status on `GET /health?verbose=true`, exposes `GET /metrics`, serves tourist auth under `/auth/*`, tourist profile under authenticated `GET`/`PATCH /profile`, trip CRUD under authenticated `/trips`, public `GET /knowledge?topic=&category=&q=` (Malaysia concierge seed: transport, etiquette, weather, payments, food, attractions, FAQ), public `GET /places/categories`, `GET /places/nearby` (filters: `category`, `radius`, `openNow`, `q`, approximate `lat`/`lng` or `area`; Google Places or Overpass when configured; otherwise the Malaysia nearby seed — `docs/nearby-categories.md`), and `GET /places/:id` (address, contact, hours, licensed photos, and navigation/booking actions), `POST /concierge/chat` (optional JWT; rate limited; persists last N messages per trip for signed-in users with TTL; LLM when `LLM_API_KEY` is set, otherwise retrieve-and-rank from the knowledge seed with no fake live data), authenticated `GET`/`DELETE /concierge/history`, and public `GET /arrival-checklist?airport=&stage=`, `GET /arrival-transport?airport=`, `GET /arrival-connectivity?airport=`, `GET /arrival-currency?airport=`, and `GET /arrival-transfer?airport=&destination=`. See `docs/observability.md` and `docs/concierge-use-cases.md`.
