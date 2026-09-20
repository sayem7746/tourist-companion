# Tourist Companion

Malaysia tourist companion MVP: trip setup, KLIA arrival help, AI concierge, nearby places, itinerary planning, partner referrals, and safety.

## Repository layout

| Path | Purpose |
| --- | --- |
| `frontend/` | Angular web app |
| `backend/` | Node.js API |
| `shared/types/` | Shared TypeScript types |
| `shared/config/` | Shared config contracts |
| `docs/` | Product and engineering documentation |
| `infra/` | CI, environments, and deployment config |

## Local PostgreSQL

```bash
docker compose -f infra/docker-compose.yml up -d
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
```

See `backend/README.md` for schema, migrate, and seed details.

## Status

Foundation work is in progress. See the Asana project **Tourist companion**.
