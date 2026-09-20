# KLIA arrival content model

Structured checklist content for first-time arrivals at Kuala Lumpur International Airport (KLIA / KLIA2).

## Airports

- `KUL` — KLIA (main)
- `KLIA2` — low-cost terminal
- Default: `KUL`

## Stages

Ordered traveler stages:

1. `immigration` — passport control / MDAC if required
2. `baggage` — carousel / lost luggage
3. `customs` — goods declaration
4. `sim` — SIM / eSIM
5. `money` — ATM / cash / cards
6. `transport` — KLIA Ekspres, bus, Grab, taxi
7. `first_steps` — hotel, water, mobile data, emergency numbers

## Item shape

```ts
interface ArrivalChecklistItem {
  id: string;
  airportCode: string;
  stage: ArrivalStage;
  title: string;
  body: string;
  sortOrder: number;
  estimatedMinutes?: number;
}
```

Content is CMS-ready JSON/SQL seed, not hard-coded only in UI.
