# Nearby categories (MVP)

Product spec for Explore / nearby place filters. Align chips with Stitch [Explore & Nearby Helper](https://stitch.withgoogle.com/projects/10046914594084234943/screens/bf8213ba04a547ff8d45656b9f176b21).

Asana: [Define nearby categories](https://app.asana.com/1/1218080418840809/project/1218661619289569/task/1218665030440339).

Shared contract: `NEARBY_CATEGORIES`, `NEARBY_CATEGORY_CHIPS`, and `NEARBY_QUICK_FILTERS` in `shared/types/index.ts`.

## Screen contract

Horizontal category chips sit under the area picker (e.g. KLCC & Downtown, ≤2 km) and the radar/map strip. They filter the place list. A second **QUICK** row is orthogonal (hours, diet, walk time) — not a category.

| Element | Behavior |
| --- | --- |
| Search | Placeholder “Search food, sights, ATMs, pharmacies…” — free-text over the current chip + area |
| Area | Radius / neighborhood, not a category |
| Category chips | Single-select; default **All**; show result counts when known (Stitch: All 32, Food & Halal 14) |
| QUICK filters | Multi-select: Open Now, Halal Only, ≤ 15 min walk |
| List cards | Food, sights, pharmacy/FX, and cultural sites as in Stitch |
| Footer | Bottom nav; Explore tab active (`#0D7652`) |

SOS in the header is emergency escalation, not a nearby category.

## MVP categories

Chip order matches Stitch (All, Food & Halal, Must-See Sights, then remaining filters in the scroller). Ids are stable for API, analytics, and maps queries.

| Id | Stitch chip | Includes | Example on the Stitch screen |
| --- | --- | --- | --- |
| `all` | All | Union of the rows below; chip only, never stored on a place | Count 32 |
| `food` | Food & Halal | Restaurants, hawker, mamak, cafes; Halal badge when known | Madam Kwan’s (Suria KLCC) |
| `attractions` | Must-See Sights | Landmarks, temples, parks, paid viewpoints | Petronas Twin Towers; Batu Caves |
| `transport` | Transit | Stations, stops, e-hailing pickup, last-mile rail/bus | “Transit Options” on Batu Caves |
| `atm` | ATMs | Bank ATMs, licensed money changers | Guardian card “Best FX Rates” / licensed exchange |
| `pharmacy` | Pharmacy | Pharmacies, chemists; English-speaking when known | Guardian Pharmacy & Money Changer |
| `convenience` | Convenience | 7-Eleven / KK / similar; water, SIM top-up, late-night snacks | Not shown as a hero card; still in MVP search |
| `tourist_services` | Tourist services | Visitor centres, tourism Malaysia desks, luggage / info | Call-desk style help, not SOS |

`all` is omitted from `NEARBY_CATEGORIES` (place type union) and included in `NEARBY_CHIP_IDS`.

## Quick filters (not categories)

| Id | Stitch label | Meaning |
| --- | --- | --- |
| `open_now` | Open Now | Open at query time |
| `halal_only` | Halal Only | Certified or clearly marked Halal food; no-op for non-food chips except hiding them |
| `walk_15` | ≤ 15 min walk | Walking ETA from the current pin / area center |

These compose with a category chip. Halal Only is most useful with `food` or `all`.

## Mapping to `PlaceCategory`

Generic `Place` records still use `PlaceCategory`. Nearby chips are more specific:

| Nearby id | `PlaceCategory` |
| --- | --- |
| `food` | `food` |
| `attractions` | `attraction` |
| `transport` | `transport` |
| `atm` | `other` (until ATM is a first-class place type) |
| `pharmacy` | `safety` |
| `convenience` | `shopping` |
| `tourist_services` | `other` |

Do not overload concierge ids (`nearby_dining`, `food_spice_diet`, `local_transport`). Concierge answers questions; Explore filters a map/list.

## Places providers

`GET /places/nearby` and `GET /places/categories` serve Explore. Results are always normalized to `NearbyPlace` (`nearbyCategory` from this spec, `category` via `PLACE_CATEGORY_BY_NEARBY`).

| `PLACES_PROVIDER` | When used |
| --- | --- |
| unset / `seed` | Malaysia seed in `backend/src/places/malaysia-seed.ts` (JSON copy: `backend/db/malaysia-places.json`) |
| `google` | Google Places API (New) Nearby Search when `GOOGLE_PLACES_API_KEY` is a real key |
| `overpass` | Public Overpass (`OVERPASS_URL`, default `https://overpass-api.de/api/interpreter`) |

If Google is selected but the key is missing, placeholder (`CHANGE_ME_*`), or the live call fails, the API falls back to the Malaysia seed. Default pin is **KLCC & Downtown, 2 km**.

## Out of scope for MVP chips

Lodging, nightlife-only, shopping malls as a top-level chip, clinics/hospitals (direct to SOS or concierge safety), and destinations outside the selected area.
