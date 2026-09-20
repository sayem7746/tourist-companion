# Stitch design: TripCompanion — Tropical Sanctuary

Source: https://stitch.withgoogle.com/projects/10046914594084234943

## Tokens

- Font: Plus Jakarta Sans
- Canvas: `#F8FAF8`
- Surface: `#FFFFFF`
- Border: `#E2E8F0`
- Text: `#0F172A` / `#475569` / `#94A3B8`
- Primary: `#0D7652` (hover `#059669`)
- Secondary gold: `#D97706` / tint `#FEF3C7` (bookmark, Indoor Safe, **Sponsored** partner badge — `docs/partner-categories.md`)
- SOS rose: `#E11D48`
- Cards: 16px radius, `0 2px 8px rgba(15,23,42,0.04)`, 1px `#E2E8F0`
- Buttons/chips: pill, primary 48px min height
- Bottom nav (5 tabs): Home, Explore, Plan, Concierge, Profile — 68px + safe area, active `#0D7652`
- Content bottom padding 88px

## Screens in Stitch

- Home — Tourist Dashboard (includes **Today's Plan** timeline; Plan is tab 3 in the bottom nav — itinerary model in `docs/itinerary-data-model.md`)
- KLIA Arrival & Transportation Guide
- KLIA Currency & Payment Guide (`screens/a6b6ac0f2aed4cbdb5a9cd9cf428c6d1`)
- AI Malaysia Concierge
- Explore & Nearby Helper
- Place details (`screens/61acea1620b34fedb9c8c39df537ee97`)
- Emergency & SOS Help (`screens/290e8555c0384578ae2a8f06dfe76496`) — route `/emergency`, SOS `#E11D48`, `data-path="emergency-help"`, `tel:` dialers
- Logo
