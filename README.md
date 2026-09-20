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

## CI/CD

Pull requests and pushes to `main` run lint, test, and build for frontend and backend (`.github/workflows/ci.yml`). Staging vs production deploy notes (no cloud credentials) are in `infra/DEPLOY.md`.

## Status

Foundation work is in progress. See the Asana project **Tourist companion**.
