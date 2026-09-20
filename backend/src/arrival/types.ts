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

export const TRANSPORT_MODES = ['ekspres', 'bus', 'e_hail', 'private'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export interface ArrivalTransportOption {
  id: string;
  airportCode: ArrivalAirportCode;
  mode: TransportMode;
  name: string;
  badge: string;
  summary: string;
  cost: string;
  duration: string;
  frequency?: string;
  destination: string;
  bestFor: string;
  boarding: string;
  whenToUse: string;
  sortOrder: number;
}

export interface ArrivalTransferOptionView {
  id: string;
  mode: TransportMode;
  name: string;
  badge: string;
  recommended: boolean;
  reason: string;
  estimatedCost: string;
  estimatedDuration: string;
  frequency?: string;
  lastMile?: string;
  boarding: string;
}

export interface ArrivalTransferRecommendation {
  airportCode: ArrivalAirportCode;
  destination: string;
  destinationLabel: string;
  areaId: string;
  railFriendly: boolean;
  summary: string;
  options: ArrivalTransferOptionView[];
}

export const CONNECTIVITY_KINDS = ['wifi', 'esim', 'prepaid_sim'] as const;
export type ConnectivityKind = (typeof CONNECTIVITY_KINDS)[number];

export interface ArrivalConnectivityOption {
  id: string;
  airportCode: ArrivalAirportCode;
  kind: ConnectivityKind;
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

export interface ArrivalConnectivityTip {
  id: string;
  airportCode: ArrivalAirportCode;
  title: string;
  body: string;
  sortOrder: number;
}

export const PAYMENT_KINDS = ['ringgit', 'atm', 'card', 'cash', 'situation'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export interface ArrivalPaymentOption {
  id: string;
  airportCode: ArrivalAirportCode;
  kind: PaymentKind;
  name: string;
  badge: string;
  summary: string;
  location?: string;
  currencyCode: 'MYR';
  howTo: string;
  whenToUse: string;
  sortOrder: number;
}

export interface ArrivalPaymentTip {
  id: string;
  airportCode: ArrivalAirportCode;
  title: string;
  body: string;
  sortOrder: number;
}
