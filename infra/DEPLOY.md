# Deploy notes (staging vs production)

CI on pull requests and pushes to `main` is defined in `.github/workflows/ci.yml` (lint, test, and build for `frontend/` and `backend/`). This file describes how **deploy** should work once a host is chosen. Do not store cloud credentials in the repo.

## Environments

| Environment | Purpose | Typical trigger | Data |
| --- | --- | --- | --- |
| **Local** | Developer machines | `docker compose` + `ng serve` / `npm run dev` | Disposable Postgres from `infra/docker-compose.yml` |
| **Staging** (development pipeline) | Shared preview of `main` | Automatic after CI passes on `main` | Isolated DB; seed allowed |
| **Production** | Live travellers | Manual approval after a tagged release | Isolated DB; **never** run `npm run db:seed` |

Staging and production must not share databases, JWT secrets, or API keys.

## Suggested GitHub environments

Create GitHub Environments named `staging` and `production` (no real secrets required until a cloud account exists):

| Secret / variable (placeholder) | Staging | Production |
| --- | --- | --- |
| `API_BASE_URL` | Staging API origin | Production API origin |
| `DATABASE_URL` | Staging Postgres | Production Postgres |
| `JWT_SECRET` | Staging-only value | Production-only value |
| `FRONTEND_ORIGIN` | Staging web origin | Production web origin |

Leave values empty until infrastructure is provisioned. Protection rules: **production** should require a reviewer; **staging** can auto-deploy from `main`.

## Pipeline shape

```
PR / push → CI (lint, test, build)
  → staging: migrate → deploy API → deploy SPA
  → production (manual): migrate → deploy API → deploy SPA
```

1. **Build** artifacts in CI (Angular production build, `backend` `tsc` output).
2. **Migrate** with `npm run db:migrate` against that environment’s `DATABASE_URL` only.
3. **Deploy** the API process (`node dist/index.js`) and static frontend to the chosen host (container registry + app platform, or object storage + CDN for the SPA). Exact vendor is TBD.
4. **Health check** `GET /health` (and `?verbose=true` on staging) before calling the release successful.

## Cursor Origin vs GitHub Actions

The canonical git remote is Cursor Origin (`origin.cursor.com`). GitHub Actions in this repo still run if a GitHub remote or mirror is connected. Until then, run the same commands locally:

```bash
cd frontend && npm ci && npm run lint && npm run format:check && npm run test:ci && npm run build
cd backend && npm ci && npm run lint && npm test && npm run build
```

## Out of scope until credentials exist

- Cloud project IDs, kube contexts, Terraform backends
- Real GitHub `secrets.*` values
- Automatic production deploys without a human gate
