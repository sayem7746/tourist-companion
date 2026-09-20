# Architecture

Tourist Companion is a modular MVP with an Angular client and a Node.js API backed by PostgreSQL.

## Planned services

- **Frontend**: trip onboarding, dashboard, arrival checklist, concierge chat, nearby, itinerary, safety.
- **Backend**: REST API with auth, trip context, places, itinerary, referrals, and admin.
- **Database**: users, trips, places, partners/providers, referrals.
- **Infra**: CI/CD, secrets, observability, and environment isolation.

## Folders

Shared contracts live under `shared/` so frontend and backend can stay aligned without duplicating models.
