# Architecture

Tourist Companion is a modular MVP with an Angular client and a Node.js API backed by PostgreSQL.

## Planned services

- **Frontend**: trip onboarding, dashboard, arrival checklist, concierge chat, nearby, itinerary, safety, public privacy and terms (`/privacy`, `/terms`, tourist footer links), ops login (`/admin/login`, `/admin` with operational counts), content CMS (`/admin/content`), searchable FAQ management (`/admin/faqs`), partner listing management (`/admin/partners`), and an audit log (`/admin/audit`).
- **Backend**: REST API with auth (tourist and admin JWT roles; `ADMIN_TOKEN` still accepted on admin routes), trip context, places, itinerary, public partner listings (`GET /partners`, `GET /partners/:id`), referrals (`POST /referrals/clicks`, `POST /referrals/leads`, `GET /r/:code`), partner admin (`/admin/partners`), referral analytics (`GET /admin/referrals/analytics`), ops dashboard (`GET /admin/dashboard`: user/trip/referral store counts plus in-process concierge, nearby, and error metrics), admin audit (`GET /admin/audit`: partner CRUD, approve/pause, and content/FAQ publish), content admin (`/admin/content`) for arrival guides, FAQs, etiquette, payment guidance, and safety copy, FAQ admin (`/admin/faqs`) plus public `GET /faqs` (published, searchable), a public emergency directory (`GET /emergency`), a searchable embassy/consulate directory (`GET /embassies`), and a tourist safety guide (`GET /safety`). Published CMS FAQs also ground the concierge and `GET /knowledge`.
- **Database**: PostgreSQL (`users` with `role` `tourist|admin`, `tourist_profiles`, `trips`, `places`, `trip_places`, `itineraries`, `itinerary_days`, `itinerary_items`, `providers` with marketplace listing columns, `referrals` with channel tracking, `arrival_checklist_items`, `content_items`, `audit_events`, `concierge_messages`). Migrations live in `backend/migrations/`.
- **Infra**: CI/CD, secrets, observability, and environment isolation. Development/staging/production env examples and GitHub Actions secret injection are in `infra/SECRETS.md`. Railway production runbook (not provisioned yet): `infra/RAILWAY.md`. API request IDs, structured error logs, in-memory metrics, and health probes are documented in `docs/observability.md`.

## Folders

Shared contracts live under `shared/` so frontend and backend can stay aligned without duplicating models.
