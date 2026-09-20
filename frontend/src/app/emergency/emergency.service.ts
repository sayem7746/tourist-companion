import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const EMERGENCY_CATEGORIES = ['police', 'ambulance', 'fire', 'tourist_assistance'] as const;
export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];

export const EMERGENCY_URGENCIES = ['sos', 'assistance'] as const;
export type EmergencyUrgency = (typeof EMERGENCY_URGENCIES)[number];

export const SOS_COLOR = '#E11D48';
export const SOS_PATH = 'emergency-help';

export const FALLBACK_SOS: EmergencySosCard = {
  color: '#E11D48',
  path: 'emergency-help',
  numbers: [
    { code: '999', label: 'Police, fire, ambulance' },
    { code: '112', label: 'Mobile networks' },
  ],
};

export const EMERGENCY_LEDE = 'Stay safe. Call now and share your location if you can.';
export const EMERGENCY_CONTEXT_AREA = 'Bukit Bintang, Kuala Lumpur';

export type EmergencyFilterId = 'all' | EmergencyUrgency | EmergencyCategory;

export interface EmergencyFilterChip {
  id: EmergencyFilterId;
  label: string;
}

export const EMERGENCY_FILTER_CHIPS: EmergencyFilterChip[] = [
  { id: 'all', label: 'All' },
  { id: 'sos', label: 'SOS' },
  { id: 'assistance', label: 'Assistance' },
  { id: 'police', label: 'Police' },
  { id: 'ambulance', label: 'Ambulance' },
  { id: 'fire', label: 'Fire' },
  { id: 'tourist_assistance', label: 'Tourist help' },
];

export const CATEGORY_LABELS: Record<EmergencyCategory, string> = {
  police: 'Police',
  ambulance: 'Ambulance',
  fire: 'Fire',
  tourist_assistance: 'Tourist assistance',
};

export const URGENCY_LABELS: Record<EmergencyUrgency, string> = {
  sos: 'SOS',
  assistance: 'Assistance',
};

export interface EmergencyNumber {
  code: string;
  label: string;
  display?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  category: EmergencyCategory;
  urgency: EmergencyUrgency;
  numbers: EmergencyNumber[];
  summary: string;
  whenToUse: string;
  area: string;
  hours: string;
  englishSpoken?: boolean;
  source: string;
  sourceUrl?: string;
  sortOrder: number;
}

export interface EmergencySosCard {
  color: '#E11D48';
  path: 'emergency-help';
  numbers: Array<{ code: string; label: string }>;
}

export interface EmergencyDirectory {
  country: 'MY';
  destination: 'Malaysia';
  version: string;
  category: EmergencyCategory | null;
  urgency: EmergencyUrgency | null;
  categories: EmergencyCategory[];
  disclaimer: string;
  sos: EmergencySosCard;
  contacts: EmergencyContact[];
}

export function emergencyHttpParams(filter: EmergencyFilterId = 'all'): HttpParams {
  if (filter === 'all') {
    return new HttpParams();
  }
  if (filter === 'sos' || filter === 'assistance') {
    return new HttpParams().set('urgency', filter);
  }
  return new HttpParams().set('category', filter);
}

export function telHref(code: string): string {
  return `tel:${code}`;
}

export function numberDisplay(number: Pick<EmergencyNumber, 'code' | 'display'>): string {
  return number.display ?? number.code;
}

@Injectable({ providedIn: 'root' })
export class EmergencyService {
  private readonly url = `${environment.apiBaseUrl}/emergency`;

  constructor(private readonly http: HttpClient) {}

  directory(filter: EmergencyFilterId = 'all'): Observable<EmergencyDirectory> {
    return this.http.get<EmergencyDirectory>(this.url, { params: emergencyHttpParams(filter) });
  }
}
