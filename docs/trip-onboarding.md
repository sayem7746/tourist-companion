# Trip onboarding (mobile-first)

Goal: a visitor creates a trip in under two minutes on a phone.

## Steps

1. **Destination** — pick a Malaysia region or type a city.
2. **Dates** — arrival and departure (departure after arrival).
3. **Travelers** — adult/child counts.
4. **Interests** — multi-select chips.
5. **Budget & style** — daily budget band + travel style.
6. **Review** — confirm and create trip.

## Default destinations

Kuala Lumpur, Penang, Langkawi, Malacca, Kota Kinabalu, Johor Bahru, Cameron Highlands, Other (free text).

## Fields and validation

| Field | Required | Rules |
| --- | --- | --- |
| destination | yes | enum or non-empty string |
| startDate | yes | ISO date |
| endDate | yes | after startDate |
| adultCount | yes | integer ≥ 1 |
| childCount | no | integer ≥ 0 |
| interests | yes | at least one |
| dailyBudget | no | `low` / `medium` / `high` |
| travelStyle | no | `relaxed` / `balanced` / `packed` |

Interests: food, nature, culture, shopping, nightlife, family, adventure, wellness.

## Navigation

Linear wizard with Back / Next. Progress bar (step n of 6). Auth required; unauthenticated users go to login then return here.
