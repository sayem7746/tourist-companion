# Secrets and environments

Development, staging, and production must not share databases, JWT secrets, or API keys. Real secrets are never committed. Copy an `*.example` file to a gitignored `.env` on a developer machine; CI and deploy inject values from GitHub Actions.

## What lives where

| Kind | Frontend | Backend |
| --- | --- | --- |
| Public config | `NG_APP_API_BASE_URL`, Angular `src/environments/` | `HOST`, `PORT`, `LOG_LEVEL`, `FRONTEND_ORIGIN`, `APP_ENV` |
| Secrets | None (SPA is public) | `DATABASE_URL`, `JWT_SECRET`, `ADMIN_TOKEN`, future third-party API keys |

Open-Meteo weather hints use a public forecast API (no key). Set `WEATHER_PROVIDER=seed` to skip live fetch.

Angular environment files are compiled into the client. Put only public API origins there.

## Example files (placeholders only)

| Environment | Backend | Frontend |
| --- | --- | --- |
| Development | `backend/.env.development.example` | `frontend/.env.development.example` |
| Staging | `backend/.env.staging.example` | `frontend/.env.staging.example` |
| Production | `backend/.env.production.example` | `frontend/.env.production.example` |

Local backend:

```bash
cp backend/.env.development.example backend/.env
```

`.env`, `.env.local`, and `.env.*` (except `*.example`) are gitignored.

## GitHub Actions injection

Workflow: `.github/workflows/deploy.yml`. Create GitHub **Environments** named `staging` and `production`. Add **secrets** and **variables** with these names (values stay in GitHub; the workflow maps them onto process env):

| GitHub secret | Injected as | Used by |
| --- | --- | --- |
| `DATABASE_URL` | `env.DATABASE_URL` / `${{ secrets.DATABASE_URL }}` | Backend, migrations |
| `JWT_SECRET` | `env.JWT_SECRET` | Backend tokens |
| `ADMIN_TOKEN` | `env.ADMIN_TOKEN` | Partner, content, and FAQ admin (`X-Admin-Token` or Bearer). JWT `role: admin` from `/auth/admin/login` is also accepted. |
| `JWT_EXPIRES_IN` | `env.JWT_EXPIRES_IN` | Backend tokens (optional; default `7d`) |
| `LLM_API_KEY` | `env.LLM_API_KEY` | Optional concierge LLM; omit to retrieve-and-rank the knowledge seed |
| `GOOGLE_PLACES_API_KEY` | `env.GOOGLE_PLACES_API_KEY` | Optional Explore nearby (Google Places). Omit or `CHANGE_ME_*` to use the Malaysia seed |
| `FRONTEND_ORIGIN` | `env.FRONTEND_ORIGIN` | Backend CORS |
| `API_BASE_URL` | `NG_APP_API_BASE_URL` on the frontend build step | SPA API origin |

| GitHub variable | Injected as | Used by |
| --- | --- | --- |
| `HOST` / `PORT` (optional) | Override in the deploy workflow if the bind address is not `0.0.0.0:3000` | API process |

Example (do not log secret values):

```yaml
env:
  APP_ENV: staging
  NODE_ENV: production
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
  FRONTEND_ORIGIN: ${{ secrets.FRONTEND_ORIGIN }}
```

```yaml
- name: Build frontend
  working-directory: frontend
  env:
    NG_APP_API_BASE_URL: ${{ secrets.API_BASE_URL }}
  run: npm ci && npm run build:staging
```

Production deploys should use the `production` environment with a required reviewer. Staging can deploy from `main`. Until a host exists, the deploy job only builds, migrates, and checks that placeholders are set. When you create Railway, set the same names on the API service (`infra/RAILWAY.md`); do not copy values into git or into a GitHub deploy job until you want Actions to ship.

## Rules

- Do not commit `.env` files that contain real credentials.
- Do not echo `secrets.*` in logs.
- Do not run `npm run db:seed` in production.
- Future keys (maps, LLM, partner APIs) follow the same pattern: example files with `CHANGE_ME_*`, GitHub secret names, backend-only unless the value is public.
