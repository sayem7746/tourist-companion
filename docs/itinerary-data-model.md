# Itinerary data model (MVP)

Product spec for a **1–7 day** trip plan: calendar days, timed blocks, places, travel, meals, notes, and booking/referral links.

Asana: [Define itinerary data model](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218660706637518) (EPIC 06 — Smart Itinerary Planner).

Shared contract: `Itinerary`, `ItineraryDay`, `ItineraryItem`, `ITINERARY_ITEM_KINDS`, and `ITINERARY_MIN_DAYS` / `ITINERARY_MAX_DAYS` in `shared/types/index.ts`.

Timezone for dates and wall-clock times: **`Asia/Kuala_Lumpur`**.

This document is the model only. CRUD, generation, editing, and regeneration are later EPIC 06 tasks.

## Screen contract (Tropical Sanctuary)

Align with Stitch [TripCompanion — Tropical Sanctuary](https://stitch.withgoogle.com/projects/10046914594084234943) tokens and bottom nav in `docs/stitch-design.md`. There is not yet a dedicated Plan screen in the Stitch project; the **Plan** tab is the third of five (Home, Explore, **Plan**, Concierge, Profile). In the app that tab is `/trips`. Home — Tourist Dashboard already shows the in-trip preview this model must feed.

| Surface | Stitch / product | Data |
| --- | --- | --- |
| Bottom nav | Plan tab active `#0D7652`; content padding 88px | Full itinerary for the featured trip |
| Home | Eyebrow **Day 2 of 7**; destination + date range | `dayNumber`, `dayCount`, trip dates |
| Home | **Today's Plan** — weekday date • “N highlights” | Selected `ItineraryDay.date`; highlight count = `activity` + `meal` items |
| Timeline | `09:30 AM` / `04:00 PM` on a white card | `startTime` (and `endTime` for duration); 12h display, 24h storage |
| Connector | commute **15 min travel time** + Directions | `travelTimeMinutes`; `kind: travel` and/or inbound minutes on the next block; Directions from `placeId` |
| Meal | restaurant chip / food stop | `kind: meal` |
| Notes | practical-tip card (emerald stripe) | `kind: note` + `notes` |
| Booking | outbound ticket/table link (app does not book) | `bookingUrl`; optional `referralPartnerId` |
| Cards | 16px radius, `#FFFFFF`, `1px #E2E8F0` | Item cards, not a data field |

SOS stays emergency-only. Weather badges on Home (Indoor Safe) are a later weather-notes task, not stored on this model.

Saved Explore places (`SavedTripPlace`) are a wishlist. An itinerary item may point at the same `placeId` after the traveler (or generator) adds it to a day.

## Length and days

One itinerary per trip.

| Rule | Meaning |
| --- | --- |
| Span | Inclusive days from `Trip.startDate` through `Trip.endDate` |
| Clip | `dayCount` is `clamp(inclusiveDays, 1, 7)` |
| Longer trips | Days 8+ are out of MVP; do not emit extra `ItineraryDay` rows |
| Shorter trips | A 1-day trip has a single day (`dayNumber` 1) |
| Order | `days` sorted by `date` / `dayNumber` ascending |
| Identity | `dayNumber` is 1-based and stable for that itinerary version; `date` is the source of truth if dates shift |

```ts
interface Itinerary {
  id: string;
  tripId: string;
  dayCount: number; // 1–7
  status: 'draft' | 'active' | 'archived';
  days: ItineraryDay[];
  generatedAt?: string;
  updatedAt?: string;
}

interface ItineraryDay {
  id: string;
  itineraryId: string;
  dayNumber: number; // 1 … dayCount
  date: string; // YYYY-MM-DD
  items: ItineraryItem[];
}
```

`status`: `draft` after generation, `active` once the traveler is using it, `archived` if replaced. Regeneration of a day (later task) keeps `locked` items.

## Items (time blocks)

Items on a day are a timeline, ordered by `startTime` then `sortOrder`. Same-day only: `endTime` is on `ItineraryDay.date` and must be after `startTime`.

```ts
type ItineraryItemKind = 'activity' | 'meal' | 'travel' | 'note';

interface ItineraryItem {
  id: string;
  dayId: string;
  sortOrder: number;
  kind: ItineraryItemKind;
  startTime: string; // HH:mm 24h
  endTime: string; // HH:mm 24h
  placeId?: string | null;
  travelTimeMinutes?: number | null;
  notes?: string | null;
  bookingUrl?: string | null;
  referralPartnerId?: string | null;
  locked: boolean;
  title?: string | null;
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `kind` | yes | `activity` \| `meal` \| `travel` \| `note` |
| `startTime` / `endTime` | yes | `HH:mm`, 24h, `endTime` > `startTime` |
| `placeId` | no | Catalog / nearby / saved place id; omit for free-text notes and some travel legs |
| `travelTimeMinutes` | no | Integer ≥ 0; inbound commute to this block, or the leg duration when `kind` is `travel` |
| `notes` | no | Traveler or generator copy (hours, dress code, “Indoor Safe” later) |
| `bookingUrl` | no | HTTPS outbound only; never implies in-app checkout |
| `referralPartnerId` | no | `Provider.id`; use with or without `bookingUrl` |
| `locked` | yes | Default `false`. Locked items survive day/activity regen |
| `title` | no | Label when `placeId` is missing, or denormalized place name for the Plan list |
| `sortOrder` | yes | Integer; CRUD reorder uses this |

### Kinds

| `kind` | Plan tab / Home | Typical `placeId` | Travel minutes |
| --- | --- | --- | --- |
| `activity` | Sight, park, mosque visit, paid viewpoint | Attraction / other nearby place | Inbound from previous block |
| `meal` | Meal stop (hawker, restaurant, hotel breakfast) | Food place | Inbound; Halal/diet copy in `notes` |
| `travel` | Explicit transfer (KLIA Ekspres, Grab, walk) | Optional station / lodging | Duration of this leg |
| `note` | Free-text block (rest, prayer time, packing) | Usually none | Usually none |

Do not invent overlapping blocks. A commute shown **between** two cards is either:

1. a `travel` item, or
2. `travelTimeMinutes` on the **following** `activity` / `meal` (matches Stitch “15 min travel time” under a completed morning stop).

Prefer (2) for short walks; use (1) when the transfer is the highlight (airport rail, long Grab).

### Booking and referrals

- `bookingUrl` is the same idea as `PlaceDetails.bookingUrl`: official tickets or partner page. Concierge still cannot hold tables or charge cards.
- `referralPartnerId` points at `providers` (`ProviderId`). Creating a `Referral` row from a click is a later referrals task; this field only records which partner the block is attributed to.
- Either field may appear alone. Neither is required for a valid item.

### Locked flag

Regeneration (later) may replace unlocked items on a day. Locked items keep `id`, times, place, notes, and links. Generators must fill gaps around locked blocks without moving them unless the traveler unlocks first.

## Persistence sketch (not migrated yet)

Suggested tables when CRUD lands. No migration in this task.

- `itineraries` — `id`, `trip_id` unique, `day_count`, `status`, timestamps
- `itinerary_days` — `id`, `itinerary_id`, `day_number`, `date` unique per itinerary
- `itinerary_items` — `id`, `day_id`, `sort_order`, `kind`, `start_time`, `end_time`, `place_id` nullable, `travel_time_minutes` nullable, `notes`, `booking_url`, `referral_partner_id` nullable FK `providers`, `locked`, `title`

`trip_places` stays the bookmark list. Linking a saved place into a day copies `placeId` onto an item; it does not remove the bookmark.

## Example (Home “Today's Plan”, Day 2 of 7)

Trip 21–27 Sep 2026, Kuala Lumpur. Selected day Thursday 22 Sep.

| kind | start–end | title / place | extras |
| --- | --- | --- | --- |
| `activity` | 09:30–11:00 | Petronas Twin Towers | `placeId` seed attraction; `bookingUrl` tickets; `locked` false |
| `travel` omitted; next row has inbound minutes | | | |
| `meal` | 12:00–13:00 | Madam Kwan’s | `travelTimeMinutes: 15`; food `placeId` |
| `activity` | 16:00–17:30 | Suria KLCC (indoor) | `notes` for weather; gold “Indoor Safe” is display-only until weather notes |

## Out of scope

API routes, generator heuristics, drag-reorder UI, weather overlay, multi-city days, overlapping concurrent options, and in-app payments. Concierge **Add to Plan** should create an `activity` or `meal` item once CRUD exists; until then it only deep-links to `/trips`.
