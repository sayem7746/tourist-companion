# Partner categories (MVP)

Product spec for the referral marketplace: which businesses can appear as partners, what a listing stores, how clicks become referrals, commission fields, and what must be disclosed to travelers.

Asana: [Define partner categories](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218663074686851) (EPIC 07 — Referral Marketplace).

Shared contract: `PARTNER_CATEGORIES`, `PARTNER_CATEGORY_CHIPS`, `Provider`, `PartnerListing`, `PartnerCommission`, `Referral`, and `REFERRAL_DISCLOSURE` in `shared/types/index.ts`.

This document is the category and compliance model. Partner admin listing CRUD lives at `/admin/partners`. Traveler click, lead, and outbound-redirect tracking lives at `/referrals/*` and `GET /r/:code`.

## Screen contract

Align partner surfaces with Stitch [TripCompanion — Tropical Sanctuary](https://stitch.withgoogle.com/projects/10046914594084234943) tokens in `docs/stitch-design.md`. There is not yet a dedicated marketplace screen; partners show as outbound booking chips on Plan / itinerary items, Arrival (SIM and transfers), Explore / place details, Concierge place cards, and the trip dashboard **Referrals** section (`/trips`).

| Surface | Behavior |
| --- | --- |
| Outbound CTA | HTTPS partner or official page; the app never books or charges |
| **Sponsored** | Gold chip when `listing.sponsored` is true — text `#D97706`, fill `#FEF3C7` (same secondary gold as bookmark / Indoor Safe) |
| Disclosure | Always visible next to a referral link, including organic (non-sponsored) partners |
| Plan item | `ItineraryItem.bookingUrl` + `referralPartnerId` (`docs/itinerary-data-model.md`) |
| Dashboard | Later: list of the traveler’s `Referral` rows; placeholder until the API exists |
| SOS | Emergency only (`#E11D48`). Never a partner badge or referral CTA |

Paid placement uses gold, not primary emerald (`#0D7652`). Emerald is for nav, primary actions, and trust — not “this is an ad.”

## MVP categories

Chip / filter order is hotels → transfers → tours → SIM/eSIM → restaurants → tourist services. Ids are stable for API, analytics, and `providers.category`.

| Id | Label | Includes | Typical product surfaces |
| --- | --- | --- | --- |
| `hotels` | Hotels | Hotels, serviced apartments, licensed guesthouses | Trip stay, Plan lodging block, Arrival last-mile |
| `transfers` | Transfers | Airport cars, meet-and-greet, licensed e-hail affiliates | Arrival transport / transfer helper, Plan `travel` |
| `tours` | Tours | Day tours, tickets, guided experiences sold by a partner | Plan `activity`, Concierge “Add to Plan” |
| `sim` | SIM / eSIM | Prepaid SIM and eSIM packs (airport counter or pre-install) | Arrival connectivity |
| `restaurants` | Restaurants | Partner restaurants / groups (not every Explore food POI) | Plan `meal`, Explore food cards with a booking link |
| `tourist_services` | Tourist services | Luggage, licensed desks, visitor help sold as a partner | Explore `tourist_services`, Arrival first steps |

`sim` matches Arrival stage `sim` and connectivity kinds `esim` / `prepaid_sim`. It is not an Explore nearby chip.

### Mapping from nearby places and the current DB check

Explore chips classify **places**. Partner ids classify **providers**. A place can exist with no partner.

| Partner id | Nearby chip / `PlaceCategory` | Current `providers_category_valid` value |
| --- | --- | --- |
| `hotels` | Lodging is out of nearby MVP; `PlaceCategory` `lodging` | `lodging` |
| `transfers` | `transport` | `transport` |
| `tours` | Attraction POIs stay `attractions`; tours are bookable products | `activity` |
| `sim` | Not a nearby chip (Arrival) | `sim` |
| `restaurants` | `food` | none yet (use this id going forward) |
| `tourist_services` | `tourist_services` | none yet |

Legacy DB values `insurance` and `other` are **not** MVP partner types. Do not list travel insurance or catch-all “other” partners in the traveler UI. A later migration should remap `transport` → `transfers`, `lodging` → `hotels`, `activity` → `tours`, and drop or hold insurance/other off-marketplace. Until that migration, seed may still insert `transport` (Grab Malaysia) — treat it as `transfers` in product copy.

Do not overload concierge category ids (`nearby_dining`, `local_transport`, `arrival_ops`). Concierge answers questions; a partner id is for attribution and listings.

## Listing fields

Every active partner has a `Provider` row plus listing copy used on cards. Traveler-facing fields are public; commission and contact email are not.

```ts
interface Provider {
  id: string;
  name: string;
  slug: string;
  category: PartnerCategory;
  isActive: boolean;
  website?: string | null;
  contactEmail?: string | null; // ops only
  listing: PartnerListing;
  commission: PartnerCommission;
}

interface PartnerListing {
  summary: string;
  city?: string | null;
  area?: string | null;
  bookingUrl?: string | null;
  disclosure: string;
  sponsored: boolean;
  licenseName?: string | null;
  licenseId?: string | null;
  typicalMyr?: string | null;
  languages?: string[];
  // category extras (omit when unused)
  hotelClassHint?: string | null;
  vehicleClass?: string | null;
  airportCodes?: ArrivalAirportCode[];
  meetAndGreet?: boolean | null;
  durationHint?: string | null;
  meetingPoint?: string | null;
  connectivityKind?: 'esim' | 'prepaid_sim' | null;
  dataAllowance?: string | null;
  validity?: string | null;
  passportRequired?: boolean | null;
  halal?: boolean | null;
  reservationUrl?: string | null;
  deskHours?: string | null;
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `name` / `slug` | yes | Unique slug; human name on cards |
| `category` | yes | One of the six MVP ids |
| `isActive` | yes | Inactive partners never appear in traveler CTAs |
| `listing.summary` | yes | One or two sentences; no invented ratings |
| `listing.bookingUrl` | no | HTTPS outbound only |
| `listing.disclosure` | yes | Traveler-visible; default `REFERRAL_DISCLOSURE` |
| `listing.sponsored` | yes | True only for paid placement; drives the gold badge |
| `listing.licenseName` / `licenseId` | when legally required | e.g. licensed transfer, money-adjacent desk; omit rather than guess |
| `website` | no | Public site; may differ from `bookingUrl` |
| `contactEmail` | no | Partner ops; never render in the tourist app |
| `commission` | yes on the record | Never sent to the tourist client |

### Per-category extras

| Category | Extra fields | Notes |
| --- | --- | --- |
| `hotels` | `hotelClassHint`, `area`, `typicalMyr` | Class is a hint (e.g. “4-star area”), not a live occupancy feed |
| `transfers` | `vehicleClass`, `airportCodes`, `meetAndGreet`, `typicalMyr` | Align with Arrival transfer modes; Grab-style affiliates are `transfers` |
| `tours` | `durationHint`, `meetingPoint`, `languages`, `typicalMyr` | Cancellation copy belongs in `summary` until a later policy field |
| `sim` | `connectivityKind`, `dataAllowance`, `validity`, `passportRequired` | Same facts as Arrival connectivity options when the partner is the counter brand |
| `restaurants` | `halal`, `area`, `reservationUrl`, `typicalMyr` | `halal` is certified or clearly marked only |
| `tourist_services` | `deskHours`, `languages`, `licenseName` | Official tourism desks vs commercial luggage/help must not be confused |

## Referral model

A `Referral` attributes one traveler (and optional trip/place) to one `Provider`. Itinerary items still store `referralPartnerId` without creating a row; clicks and leads create or update the tracking row.

```ts
type ReferralStatus = 'pending' | 'clicked' | 'converted' | 'expired';

interface Referral {
  id: string;
  userId: string;
  tripId?: string;
  providerId: string;
  placeId?: string;
  referralCode: string;
  status: ReferralStatus;
  channel?: ReferralChannel;
  itineraryItemId?: string | null;
  convertedAt?: string | null;
  metadata?: ReferralMetadata;
}
```

| Status | Meaning |
| --- | --- |
| `pending` | Code issued, no outbound click yet (seed / pre-generated) |
| `clicked` | Traveler opened `bookingUrl` (or equivalent) with this code |
| `converted` | Partner (or later webhook) confirmed a qualifying booking/activation |
| `expired` | Window ended with no conversion |

| Channel | When to set |
| --- | --- |
| `itinerary` | Plan / Home timeline booking chip |
| `arrival` | SIM, transfer, or first-steps CTA |
| `explore` | Place details booking action |
| `concierge` | Card booking / “open partner” |
| `dashboard` | Trip Referrals list |

Rules:

- One click → at most one new `Referral` (idempotent on `referralCode` or click key in `metadata`).
- `referralPartnerId` on an itinerary item does not create a row by itself.
- Conversion is partner-reported (`POST /referrals/bookings`); the app must not mark `converted` from a click or lead alone.
- Traveler UI may show partner name, category, status, and disclosure — not commission rate.

### Tracking API

Authenticated tourist endpoints (JWT or session cookie). `channel` is the source placement.

| Method | Path | Behavior |
| --- | --- | --- |
| `POST` | `/referrals/clicks` | Record an outbound click. Body: `providerId`, `channel`, optional `tripId`, `placeId`, `itineraryItemId`, `referralCode`, `clickKey`. Returns `referral`, `outboundUrl` (HTTPS partner URL with `ref` + UTM), `redirectPath`. `201` on insert, `200` on replay. Status becomes `clicked`. |
| `POST` | `/referrals/leads` | Record a lead (form / booking intent). Identify with `referralId`, `referralCode`, or `providerId` + `channel`. Status stays `clicked` (or is set from `pending`). Does not convert. |
| `GET` | `/referrals` | List the current traveler’s referrals and status |
| `GET` | `/referrals/go/:providerId?channel=` | Cookie/JWT outbound start: record a click and `302` to the tracked partner URL |
| `GET` | `/r/:code` | Public tracked redirect for an issued code (`pending` → `clicked`). `302` only to the stored HTTPS partner URL |
| `POST` | `/referrals/bookings` | Admin (`ADMIN_TOKEN` or `role: admin`): partner-reported booking/activation. Sets `converted` and `convertedAt` |

Inactive partners cannot open new clicks or leads (`404`). Existing codes still redirect. Clicks never set `converted`. Open redirects are rejected: the Location is always the listing `bookingUrl`, else `reservationUrl`, else `website`, and only `https://`.

## Commission fields

Stored on `providers` (today: `commission_rate` 0–1). Traveler APIs omit this object.

```ts
type CommissionBasis = 'booking' | 'click' | 'activation';

interface PartnerCommission {
  rate: number; // 0–1 inclusive
  currency: 'MYR';
  basis: CommissionBasis;
}
```

| Field | Meaning |
| --- | --- |
| `rate` | Fraction of qualifying value (e.g. `0.0500` = 5%). Matches `NUMERIC(5, 4)`. |
| `currency` | Payout accounting in ringgit for MVP |
| `basis` | `booking` hotels/tours/restaurants; `activation` SIM; `click` only if the contract is CPA-click |

Do not infer a rate from `typicalMyr`. Do not show “you save X because we earn Y.”

## Compliance and disclosure

Malaysia-facing MVP rules. Product and copy must follow these even before legal review of specific partner contracts.

### Always disclose

Use `REFERRAL_DISCLOSURE` (or partner-specific equivalent that still states a commercial relationship):

> We may earn a commission if you book or buy through this link.

Show it adjacent to the CTA (not only in a distant footer). Sponsored listings **also** show the gold **Sponsored** badge. Organic affiliates still disclose; they omit the badge.

### Sponsored badge (Stitch gold)

| Token | Value |
| --- | --- |
| Label | `Sponsored` |
| Text / icon | `#D97706` |
| Chip fill | `#FEF3C7` |
| Radius | Pill, same as other chips |

Do not use SOS rose for ads. Do not use the primary emerald fill for Sponsored. Indoor Safe and bookmark gold may share tokens; copy (`Sponsored` vs `Indoor Safe`) distinguishes them.

### Category-specific

| Category | Must | Must not |
| --- | --- | --- |
| `hotels` | Licensed lodging; outbound booking only | Invent availability, star ratings, or “official Tourism Malaysia hotel” unless true |
| `transfers` | Distinguish official rail/bus from affiliate cars; licensed e-hail where claimed | Present illegal touts as partners; replace SOS |
| `tours` | Meeting point and that tickets are external | Guarantee entry or skip queues the partner cannot provide |
| `sim` | Passport / eSIM device limits when known; not immigration advice | Claim a telco brand without an agreement; sell “visa SIMs” |
| `restaurants` | Halal only when certified or clearly marked | Hold tables or process deposits |
| `tourist_services` | Separate official visitor centres from paid luggage/help | Imply government endorsement for commercial desks |

### Data and safety

- `contactEmail` and commission stay off tourist responses (PDPA: partner ops data is not trip content).
- Do not attach referrals to SOS, emergency numbers, or immigration/visa rulings.
- Concierge still cannot book or pay (`docs/concierge-use-cases.md`).
- Licensed photos and place hours stay on `PlaceDetails`; partners do not override POI facts.

## Persistence sketch

Core tables (`backend/migrations/1730000000000_init-core-schema.cjs`) plus marketplace columns (`backend/migrations/1730000008000_partner-marketplace.cjs`):

- `providers` (partner) — `id`, `name`, `slug`, `category` (six MVP ids), `is_active` (status)
- listing / service — `listing_summary`, `booking_url`, `disclosure`, `sponsored`, `license_name`, `license_id`, `typical_myr`, `languages`, `listing_extras` (category extras JSON)
- location — `listing_city`, `listing_area`, plus `airportCodes` in extras
- contact — `website`, `contact_email` (ops only)
- commission — `commission_rate`, `commission_basis`, `commission_currency` (`MYR`)
- `referrals` (tracking) — `user_id`, `trip_id`, `provider_id`, `place_id`, `referral_code`, `status`, `channel`, `itinerary_item_id`, `metadata` (click key + events), `converted_at`. Unique click keys: `backend/migrations/1730000009000_referral-click-key.cjs`.

Admin API (`ADMIN_TOKEN` or JWT `role: admin`): `GET`/`POST /admin/partners`, `GET`/`PATCH`/`DELETE /admin/partners/:id`, `POST /admin/partners/:id/approve` (sets `is_active`), `POST /admin/partners/:id/pause`. Responses use the ops `Provider` view (contact + commission). Delete fails with 409 when referrals still point at the row — pause instead.

Legacy `transport` / `lodging` / `activity` rows remap to `transfers` / `hotels` / `tours`. `insurance` / `other` are deactivated and parked as `tourist_services` (off-marketplace).

## Out of scope

Partner admin **UI**, payout reports, insurance products, in-app checkout, ranking ads in Explore organic results without a Sponsored badge, and destinations outside Malaysia.
