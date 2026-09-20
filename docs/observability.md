# Observability

The API emits structured JSON logs (Fastify/Pino), correlates requests with IDs, exposes an in-memory metrics snapshot, and keeps `GET /health` as the liveness probe.

## Request IDs

- Incoming `X-Request-Id` is reused when present (trimmed, max 128 characters).
- Otherwise the server generates a UUID.
- The same value is:
  - stored as Fastify `request.id`
  - logged as `requestId`
  - returned as the `X-Request-Id` response header
  - included on JSON error bodies as `error.requestId`

Clients should send `X-Request-Id` on retries and log the response header when reporting failures.

## Structured logging

Logger level is `LOG_LEVEL` (`fatal` | `error` | `warn` | `info` | `debug` | `trace` | `silent`). Typical fields:

- `requestId`, `method`, `url`, `statusCode`, `durationMs`
- `err` with `type`, `message`, `code`, `statusCode`
- `stack` on `err` **only when `NODE_ENV` is not `production`**

Hooks log `incoming request` and `request completed`. Unexpected 5xx errors use `error` level; 4xx and `AppError` / Zod validation use `warn`.

## Metrics

`GET /metrics` returns a JSON snapshot from an in-process collector (not Prometheus text format):

- `requestsTotal` / `errorsTotal` (status ≥ 400)
- latency `p50` / `p95` / `p99` / `max` from a rolling sample (cap 2000)
- cumulative histogram buckets (ms): 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, `+Inf`
- `byRoute` keyed by `METHOD /path` (query string stripped)

`GET /metrics` itself is not counted. Values reset when the process restarts. For multi-instance deploys, scrape each replica or replace this with a shared backend later.

Admin `GET /admin/dashboard` (JWT `role: admin` or `ADMIN_TOKEN`) reuses this snapshot for concierge chat, nearby search, and error counts. User, trip, and referral totals come from stores when they are configured; otherwise those three also fall back to process metrics (`POST /auth/signup`, `POST /trips`, `POST /referrals/clicks`).

## Admin audit log

Successful partner CRUD, approve/pause, and content/FAQ publish (or unpublish) writes an `audit_events` row. `GET /admin/audit` (same admin auth as other ops routes) lists them newest first, with optional `action`, `entityType`, `entityId`, `limit`, and `offset` filters. Each event stores the actor (JWT email or `admin_token`), `requestId`, entity id, and a short summary. Reads and failed writes are not recorded.

## Health

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness: `{ status, timestamp }` |
| `GET /health?verbose=true` | Adds `uptimeSeconds`, `database` (`up` / `down` / `skipped`), and a metrics summary (`requestsTotal`, `errorsTotal`, latency percentiles) |

Unknown query parameters return `400 VALIDATION_ERROR`.
