import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const MISSION_KINDS = ['embassy', 'high_commission', 'consulate'] as const;
export type MissionKind = (typeof MISSION_KINDS)[number];

export type EmbassyFilterId = 'all' | MissionKind;

export interface EmbassyFilterChip {
  id: EmbassyFilterId;
  label: string;
}

export const EMBASSY_FILTER_CHIPS: EmbassyFilterChip[] = [
  { id: 'all', label: 'All' },
  { id: 'embassy', label: 'Embassy' },
  { id: 'high_commission', label: 'High commission' },
  { id: 'consulate', label: 'Consulate' },
];

export const KIND_LABELS: Record<MissionKind, string> = {
  embassy: 'Embassy',
  high_commission: 'High commission',
  consulate: 'Consulate',
};

export const EMBASSY_LEDE =
  'Search major foreign missions in Kuala Lumpur. Contact links are official websites only.';

export const EMBASSY_SEARCH_PLACEHOLDER = 'Search by country, e.g. Singapore or United States';

export interface ForeignMission {
  id: string;
  name: string;
  sendingCountry: string;
  sendingCountryCode: string;
  kind: MissionKind;
  city: 'Kuala Lumpur';
  area: string;
  address?: string;
  officialWebsite: string;
  summary: string;
  whenToUse: string;
  hours: string;
  tags: string[];
  source: string;
  sourceUrl: string;
  sortOrder: number;
}

export interface EmbassyDirectory {
  country: 'MY';
  destination: 'Malaysia';
  version: string;
  q: string | null;
  kind: MissionKind | null;
  kinds: MissionKind[];
  disclaimer: string;
  missions: ForeignMission[];
}

export function embassyHttpParams(q = '', kind: EmbassyFilterId = 'all'): HttpParams {
  let params = new HttpParams();
  const needle = q.trim();
  if (needle.length >= 2) {
    params = params.set('q', needle);
  }
  if (kind !== 'all') {
    params = params.set('kind', kind);
  }
  return params;
}

export function officialWebsiteHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return '';
    }
    const host = parsed.hostname.toLowerCase();
    const unofficial = [
      'wikipedia.org',
      'facebook.com',
      'instagram.com',
      'tripadvisor',
      'embassypages.com',
      'embassy-finder',
      'yelp.com',
    ];
    if (unofficial.some((marker) => host.includes(marker))) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

@Injectable({ providedIn: 'root' })
export class EmbassyService {
  private readonly url = `${environment.apiBaseUrl}/embassies`;

  constructor(private readonly http: HttpClient) {}

  directory(q = '', kind: EmbassyFilterId = 'all'): Observable<EmbassyDirectory> {
    return this.http.get<EmbassyDirectory>(this.url, { params: embassyHttpParams(q, kind) });
  }
}
