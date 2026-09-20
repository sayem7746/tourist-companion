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

## Nearby search API

Public `GET /places/nearby` applies category, radius, open-now, text, and approximate location filters. `GET /places/categories` returns chip, quick-filter, and area catalogs for Explore.

| Query | Required | Meaning |
| --- | --- | --- |
| `category` | no | Chip id (`all`, `food`, `attractions`, `transport`, `atm`, `pharmacy`, `convenience`, `tourist_services`). Default `all`. |
| `radius` | no | Integer meters, 100–20 000. Default is the named area radius, or 2000 m for a GPS pin. |
| `openNow` | no | `true` / `false`. When true, keep venues known to be open at query time. |
| `q` | no | Free-text over name, description, address, area, and badges (2–80 characters). Google uses Places Text Search; seed and Overpass filter locally. |
| `lat`, `lng` | together | Approximate GPS. Values are coarsened to 3 decimal places (~100 m) before search or provider calls. |
| `area` | no | Named neighborhood pin when GPS is unavailable: `klcc`, `bukit_bintang`, `batu_caves`. |
| `halalOnly` | no | `true` / `false`. Keep clearly Halal food; other chips yield an empty list. |
| `walk15` | no | `true` / `false`. Keep places within 1200 m of the pin. |

Unknown query keys are rejected (`400`). Send `lat` and `lng` together. When both `area` and coordinates are present, coordinates set the origin and `area` still labels the neighborhood if it matches a known id.

The JSON body includes `origin`, `radiusMeters`, `category`, `q`, `quickFilters`, chip `counts`, and normalized `places`.

## Out of scope for MVP chips

Lodging, nightlife-only, shopping malls as a top-level chip, clinics/hospitals (direct to SOS or concierge safety), and destinations outside the selected area.
