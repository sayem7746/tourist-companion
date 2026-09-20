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

See `backend/README.md` for schema, migrate, and seed details. Request IDs, logging, metrics, and health are in `docs/observability.md`.

## Environments and secrets

Copy example env files (placeholders only) — never commit real `.env` files:

```bash
cp backend/.env.development.example backend/.env
```

Per-environment examples: `backend/.env.{development,staging,production}.example` and `frontend/.env.{development,staging,production}.example`. GitHub Actions injects `secrets.DATABASE_URL`, `secrets.JWT_SECRET`, `secrets.FRONTEND_ORIGIN`, and `secrets.API_BASE_URL` (see `infra/SECRETS.md`).

## Local run

```bash
docker compose -f infra/docker-compose.yml up -d
cd backend && cp .env.example .env && npm install && npm run db:migrate && npm run db:seed && npm run dev
# another terminal
cd frontend && npm install && npm start
```

API: http://localhost:3000/health · App: http://localhost:4200

## CI/CD

GitHub Actions CI and Deploy are **manual** (`workflow_dispatch`) so pushes to `main` do not fail or email. Railway deploy can be wired later. Notes: `infra/DEPLOY.md`.

## Status

Foundation work is in progress. See the Asana project **Tourist companion**.
