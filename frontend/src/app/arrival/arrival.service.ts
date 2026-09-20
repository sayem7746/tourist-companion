import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

export interface ArrivalChecklistResponse {
  airportCode: ArrivalAirportCode;
  stage: ArrivalStage | null;
  stages: ArrivalStage[];
  items: ArrivalChecklistItem[];
}

export const STAGE_LABELS: Record<ArrivalStage, string> = {
  immigration: 'Immigration',
  baggage: 'Baggage',
  customs: 'Customs',
  sim: 'SIM / eSIM',
  money: 'Money',
  transport: 'Transport',
  first_steps: 'First steps',
};

export const AIRPORT_LABELS: Record<ArrivalAirportCode, string> = {
  KUL: 'KLIA (main)',
  KLIA2: 'KLIA2',
};

export type TransportMode = 'ekspres' | 'bus' | 'e_hail' | 'private';

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

export interface ArrivalTransportResponse {
  airportCode: ArrivalAirportCode;
  options: ArrivalTransportOption[];
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

export interface ArrivalConnectivityResponse {
  airportCode: ArrivalAirportCode;
  options: ArrivalConnectivityOption[];
  tips: ArrivalConnectivityTip[];
}

@Injectable({ providedIn: 'root' })
export class ArrivalService {
  private readonly base = `${environment.apiBaseUrl}/arrival-checklist`;

  constructor(private readonly http: HttpClient) {}

  list(airport: ArrivalAirportCode = DEFAULT_ARRIVAL_AIRPORT, stage?: ArrivalStage | ''): Observable<ArrivalChecklistResponse> {
    let params = new HttpParams().set('airport', airport);
    if (stage) {
      params = params.set('stage', stage);
    }
    return this.http.get<ArrivalChecklistResponse>(this.base, { params });
  }

  listTransport(airport: ArrivalAirportCode = DEFAULT_ARRIVAL_AIRPORT): Observable<ArrivalTransportResponse> {
    const params = new HttpParams().set('airport', airport);
    return this.http.get<ArrivalTransportResponse>(`${environment.apiBaseUrl}/arrival-transport`, { params });
  }

  listConnectivity(airport: ArrivalAirportCode = DEFAULT_ARRIVAL_AIRPORT): Observable<ArrivalConnectivityResponse> {
    const params = new HttpParams().set('airport', airport);
    return this.http.get<ArrivalConnectivityResponse>(`${environment.apiBaseUrl}/arrival-connectivity`, { params });
  }

  recommendTransfer(
    destination: string,
    airport: ArrivalAirportCode = DEFAULT_ARRIVAL_AIRPORT,
  ): Observable<ArrivalTransferRecommendation> {
    const params = new HttpParams().set('airport', airport).set('destination', destination);
    return this.http.get<ArrivalTransferRecommendation>(`${environment.apiBaseUrl}/arrival-transfer`, { params });
  }
}
