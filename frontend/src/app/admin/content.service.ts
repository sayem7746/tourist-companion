import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const CONTENT_KINDS = ['arrival_guide', 'faq', 'etiquette', 'payment', 'safety'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_AIRPORTS = ['KUL', 'KLIA2'] as const;
export type ContentAirportCode = (typeof CONTENT_AIRPORTS)[number];

export const CONTENT_ARRIVAL_STAGES = [
  'immigration',
  'baggage',
  'customs',
  'sim',
  'money',
  'transport',
  'first_steps',
] as const;

export const CONTENT_PAYMENT_TOPICS = ['ringgit', 'atm', 'card', 'cash', 'situation'] as const;

export const CONTENT_SAFETY_TOPICS = [
  'lost_items',
  'scams',
  'transport_disputes',
  'document_loss',
] as const;

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  arrival_guide: 'Arrival guide',
  faq: 'FAQ',
  etiquette: 'Etiquette',
  payment: 'Payment',
  safety: 'Safety',
};

export const CONTENT_KIND_CHIPS: Array<{ id: ContentKind | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'arrival_guide', label: 'Arrival' },
  { id: 'faq', label: 'FAQs' },
  { id: 'etiquette', label: 'Etiquette' },
  { id: 'payment', label: 'Payments' },
  { id: 'safety', label: 'Safety' },
];

export interface ContentItem {
  id: string;
  slug: string;
  kind: ContentKind;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  area: string | null;
  airportCode: ContentAirportCode | null;
  topic: string | null;
  whenToUse: string | null;
  icon: string | null;
  steps: string[];
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentList {
  kinds: ContentKind[];
  kind: ContentKind | null;
  published: boolean | null;
  q: string | null;
  items: ContentItem[];
}

export interface ContentDraft {
  title: string;
  slug?: string;
  kind: ContentKind;
  summary?: string;
  body: string;
  tags?: string[];
  area?: string | null;
  airportCode?: ContentAirportCode | null;
  topic?: string | null;
  whenToUse?: string | null;
  icon?: string | null;
  steps?: string[];
  sortOrder?: number;
  published?: boolean;
}

export type ContentPublishedFilter = 'all' | 'published' | 'draft';

export function contentListParams(
  kind: ContentKind | 'all' = 'all',
  published: ContentPublishedFilter = 'all',
  q = '',
): HttpParams {
  let params = new HttpParams();
  if (kind !== 'all') {
    params = params.set('kind', kind);
  }
  if (published === 'published') {
    params = params.set('published', 'true');
  }
  if (published === 'draft') {
    params = params.set('published', 'false');
  }
  const needle = q.trim();
  if (needle.length >= 2) {
    params = params.set('q', needle.slice(0, 80));
  }
  return params;
}

export function topicOptionsForKind(kind: ContentKind): Array<{ id: string; label: string }> {
  switch (kind) {
    case 'arrival_guide':
      return CONTENT_ARRIVAL_STAGES.map((id) => ({ id, label: id.replaceAll('_', ' ') }));
    case 'payment':
      return CONTENT_PAYMENT_TOPICS.map((id) => ({ id, label: id }));
    case 'safety':
      return CONTENT_SAFETY_TOPICS.map((id) => ({ id, label: id.replaceAll('_', ' ') }));
    default:
      return [];
  }
}

export function showsAirport(kind: ContentKind): boolean {
  return kind === 'arrival_guide' || kind === 'payment';
}

export function showsSteps(kind: ContentKind): boolean {
  return kind === 'safety';
}

export function showsArea(kind: ContentKind): boolean {
  return kind === 'etiquette';
}

export function splitLines(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/content`;

  list(
    kind: ContentKind | 'all' = 'all',
    published: ContentPublishedFilter = 'all',
    q = '',
  ): Observable<ContentList> {
    return this.http.get<ContentList>(this.url, {
      params: contentListParams(kind, published, q),
      withCredentials: true,
    });
  }

  get(id: string): Observable<{ item: ContentItem }> {
    return this.http.get<{ item: ContentItem }>(`${this.url}/${id}`, { withCredentials: true });
  }

  create(body: ContentDraft): Observable<{ item: ContentItem }> {
    return this.http.post<{ item: ContentItem }>(this.url, body, { withCredentials: true });
  }

  update(id: string, body: Partial<ContentDraft>): Observable<{ item: ContentItem }> {
    return this.http.patch<{ item: ContentItem }>(`${this.url}/${id}`, body, {
      withCredentials: true,
    });
  }

  publish(id: string): Observable<{ item: ContentItem }> {
    return this.http.post<{ item: ContentItem }>(
      `${this.url}/${id}/publish`,
      {},
      { withCredentials: true },
    );
  }

  unpublish(id: string): Observable<{ item: ContentItem }> {
    return this.http.post<{ item: ContentItem }>(
      `${this.url}/${id}/unpublish`,
      {},
      { withCredentials: true },
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { withCredentials: true });
  }
}
