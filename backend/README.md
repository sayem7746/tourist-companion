# Backend database

PostgreSQL is the system of record for users, trips, places, partner providers, and referrals.

## Local Postgres

From the repo root:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Copy `backend/.env.example` to `backend/.env`. Default URL:

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

Development seed is **idempotent** (`ON CONFLICT` / existence checks). It creates one demo user, KL trip, KLIA place, Grab provider, trip-place link, and referral.

```bash
npm run db:seed
```

SQL source of truth: `db/seed.sql`. Do not run seed in production.

## Core entities

| Table | Purpose |
| --- | --- |
| `users` | Traveller accounts (auth comes later) |
| `trips` | A user's visit window and destination |
| `places` | Airports, attractions, and other POIs |
| `trip_places` | Itinerary links between trips and places |
| `providers` | Partner businesses used for referrals |
| `referrals` | Attribution codes from a user/trip to a provider |

The API only opens a `pg` pool (optional `DATABASE_URL`) and reports DB status on `GET /health?verbose=true`. Full CRUD is out of scope for this schema task.
