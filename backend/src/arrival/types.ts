export const ARRIVAL_AIRPORTS = ['KUL', 'KLIA2'] as const;
export const DEFAULT_ARRIVAL_AIRPORT = 'KUL' as const;

export const ARRIVAL_STAGES = [
  'immigration',
  'baggage',
  'customs',
  'sim',
  'money',
  'transport',
  'first_steps',
] as const;

export type ArrivalAirportCode = (typeof ARRIVAL_AIRPORTS)[number];
export type ArrivalStage = (typeof ARRIVAL_STAGES)[number];

export interface ArrivalChecklistItem {
  id: string;
  airportCode: ArrivalAirportCode;
  stage: ArrivalStage;
  title: string;
  body: string;
  sortOrder: number;
  estimatedMinutes?: number;
}

export interface ArrivalChecklistStore {
  list(airportCode: ArrivalAirportCode, stage?: ArrivalStage): Promise<ArrivalChecklistItem[]>;
}
