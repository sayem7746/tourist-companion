import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const FAQ_TOPICS = [
  'food_spice_diet',
  'local_transport',
  'nearby_dining',
  'money_payments',
  'culture_etiquette',
  'arrival_ops',
  'itinerary_plan',
  'safety_non_emergency',
  'emergency',
] as const;

export type FaqTopic = (typeof FAQ_TOPICS)[number];

export const FAQ_TOPIC_LABELS: Record<FaqTopic, string> = {
  food_spice_diet: 'Food & diet',
  local_transport: 'Transport',
  nearby_dining: 'Dining',
  money_payments: 'Payments',
  culture_etiquette: 'Etiquette',
  arrival_ops: 'Arrival',
  itinerary_plan: 'Plan',
  safety_non_emergency: 'Safety',
  emergency: 'Emergency',
};

export const FAQ_TOPIC_CHIPS: Array<{ id: FaqTopic | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  ...FAQ_TOPICS.map((id) => ({ id, label: FAQ_TOPIC_LABELS[id] })),
];

export interface FaqItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  topic: FaqTopic | null;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FaqList {
  topics: FaqTopic[];
  published: boolean | null;
  topic: FaqTopic | null;
  q: string | null;
  items: FaqItem[];
}

export interface FaqDraft {
  title: string;
  slug?: string;
  summary?: string;
  body: string;
  tags?: string[];
  topic?: FaqTopic | null;
  sortOrder?: number;
  published?: boolean;
}

export type FaqPublishedFilter = 'all' | 'published' | 'draft';

export function faqListParams(
  topic: FaqTopic | 'all' = 'all',
  published: FaqPublishedFilter = 'all',
  q = '',
): HttpParams {
  let params = new HttpParams();
  if (topic !== 'all') {
    params = params.set('topic', topic);
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

export function splitFaqLines(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

@Injectable({ providedIn: 'root' })
export class FaqService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/faqs`;

  list(
    topic: FaqTopic | 'all' = 'all',
    published: FaqPublishedFilter = 'all',
    q = '',
  ): Observable<FaqList> {
    return this.http.get<FaqList>(this.url, {
      params: faqListParams(topic, published, q),
      withCredentials: true,
    });
  }

  get(id: string): Observable<{ item: FaqItem }> {
    return this.http.get<{ item: FaqItem }>(`${this.url}/${id}`, { withCredentials: true });
  }

  create(body: FaqDraft): Observable<{ item: FaqItem }> {
    return this.http.post<{ item: FaqItem }>(this.url, body, { withCredentials: true });
  }

  update(id: string, body: Partial<FaqDraft>): Observable<{ item: FaqItem }> {
    return this.http.patch<{ item: FaqItem }>(`${this.url}/${id}`, body, {
      withCredentials: true,
    });
  }

  publish(id: string): Observable<{ item: FaqItem }> {
    return this.http.post<{ item: FaqItem }>(`${this.url}/${id}/publish`, {}, { withCredentials: true });
  }

  unpublish(id: string): Observable<{ item: FaqItem }> {
    return this.http.post<{ item: FaqItem }>(
      `${this.url}/${id}/unpublish`,
      {},
      { withCredentials: true },
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { withCredentials: true });
  }
}
