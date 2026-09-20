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

## SIM and connectivity guide

Public `GET /arrival-connectivity?airport=` for first-time visitor Wi-Fi, eSIM, and prepaid SIM guidance. Default airport `KUL`. Options are CMS-ready TypeScript seed (`wifi`, `esim`, `prepaid_sim`) plus emerald-stripe tips.

```ts
interface ArrivalConnectivityOption {
  id: string;
  airportCode: string;
  kind: 'wifi' | 'esim' | 'prepaid_sim';
  name: string;
  badge: string;
  summary: string;
  location: string;
  cost?: string;
  dataAllowance?: string;
  validity?: string;
  howTo: string;
  whenToUse: string;
  sortOrder: number;
}
```
