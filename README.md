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

## Environments and secrets

Copy example env files (placeholders only) — never commit real `.env` files:

```bash
cp backend/.env.development.example backend/.env
```

Per-environment examples: `backend/.env.{development,staging,production}.example` and `frontend/.env.{development,staging,production}.example`. GitHub Actions injects `secrets.DATABASE_URL`, `secrets.JWT_SECRET`, `secrets.FRONTEND_ORIGIN`, and `secrets.API_BASE_URL` (see `infra/SECRETS.md`).

## CI/CD

Pull requests and pushes to `main` run lint, test, and build for frontend and backend (`.github/workflows/ci.yml`). Staging vs production deploy notes (no cloud credentials) are in `infra/DEPLOY.md`.

## Status

Foundation work is in progress. See the Asana project **Tourist companion**.
