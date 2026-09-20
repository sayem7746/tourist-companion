import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const SAFETY_TOPICS = [
  'lost_items',
  'scams',
  'transport_disputes',
  'document_loss',
] as const;
export type SafetyTopic = (typeof SAFETY_TOPICS)[number];

export const SAFETY_GUIDE_PATHS = ['/emergency', '/embassies'] as const;
export type SafetyGuidePath = (typeof SAFETY_GUIDE_PATHS)[number];

export const SAFETY_ACCENT = '#0D7652';

export const SAFETY_LEDE =
  'Concise steps for lost items, scams, transport disputes, and a lost passport — not a substitute for 999.';

export type SafetyFilterId = 'all' | SafetyTopic;

export interface SafetyFilterChip {
  id: SafetyFilterId;
  label: string;
}

export const SAFETY_FILTER_CHIPS: SafetyFilterChip[] = [
  { id: 'all', label: 'All' },
  { id: 'lost_items', label: 'Lost items' },
  { id: 'scams', label: 'Scams' },
  { id: 'transport_disputes', label: 'Transport' },
  { id: 'document_loss', label: 'Documents' },
];

export const TOPIC_LABELS: Record<SafetyTopic, string> = {
  lost_items: 'Lost items',
  scams: 'Scams',
  transport_disputes: 'Transport',
  document_loss: 'Documents',
};

export interface SafetyGuideLink {
  label: string;
  path: SafetyGuidePath;
}

export interface SafetyTip {
  id: string;
  topic: SafetyTopic;
  title: string;
  summary: string;
  steps: string[];
  whenToUse: string;
  icon: string;
  links: SafetyGuideLink[];
  sortOrder: number;
}

export interface SafetyGuide {
  country: 'MY';
  destination: 'Malaysia';
  version: string;
  topic: SafetyTopic | null;
  topics: SafetyTopic[];
  disclaimer: string;
  accent: '#0D7652';
  emergencyPath: '/emergency';
  embassyPath: '/embassies';
  tips: SafetyTip[];
}

export function safetyHttpParams(topic: SafetyFilterId = 'all'): HttpParams {
  if (topic === 'all') {
    return new HttpParams();
  }
  return new HttpParams().set('topic', topic);
}

export function isSafetyGuidePath(path: string): path is SafetyGuidePath {
  return (SAFETY_GUIDE_PATHS as readonly string[]).includes(path);
}

@Injectable({ providedIn: 'root' })
export class SafetyService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/safety`;

  guide(topic: SafetyFilterId = 'all'): Observable<SafetyGuide> {
    return this.http.get<SafetyGuide>(this.url, { params: safetyHttpParams(topic) });
  }
}
