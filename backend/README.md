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

Development seed is **idempotent** (`ON CONFLICT` / existence checks). It creates one demo user, KL trip, KLIA place, Grab provider, trip-place link, referral, and KLIA/KLIA2 arrival checklist items. JSON copy: `db/arrival-checklist.json`.

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

The API opens a `pg` pool (optional `DATABASE_URL`), reports DB status on `GET /health?verbose=true`, exposes `GET /metrics`, serves tourist auth under `/auth/*`, tourist profile under authenticated `GET`/`PATCH /profile`, trip CRUD under authenticated `/trips`, and public `GET /arrival-checklist?airport=&stage=`. See `docs/observability.md`.
