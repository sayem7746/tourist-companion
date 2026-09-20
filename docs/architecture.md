# Architecture

Tourist Companion is a modular MVP with an Angular client and a Node.js API backed by PostgreSQL.

## Planned services

- **Frontend**: trip onboarding, dashboard, arrival checklist, concierge chat, nearby, itinerary, safety.
- **Backend**: REST API with auth, trip context, places, itinerary, referrals, and partner admin (`/admin/partners`).
- **Database**: PostgreSQL (`users`, `tourist_profiles`, `trips`, `places`, `trip_places`, `itineraries`, `itinerary_days`, `itinerary_items`, `providers` with marketplace listing columns, `referrals` with channel tracking, `arrival_checklist_items`, `concierge_messages`). Migrations live in `backend/migrations/`.
- **Infra**: CI/CD, secrets, observability, and environment isolation. Development/staging/production env examples and GitHub Actions secret injection are in `infra/SECRETS.md`. API request IDs, structured error logs, in-memory metrics, and health probes are documented in `docs/observability.md`.

## Folders

Shared contracts live under `shared/` so frontend and backend can stay aligned without duplicating models.
