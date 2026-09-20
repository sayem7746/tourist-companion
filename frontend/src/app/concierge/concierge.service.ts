import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const CONCIERGE_CATEGORIES = [
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

export type ConciergeCategory = (typeof CONCIERGE_CATEGORIES)[number];

export interface ConciergeLiveContext {
  area?: string;
  tripMode?: string;
  firstName?: string;
  dietaryPreferences?: string[];
  mobilityNeeds?: string[];
  travelStyle?: string;
  destination?: string;
  tripStartDate?: string;
  tripEndDate?: string;
  itinerary?: string[];
  accommodationName?: string;
  interests?: string[];
}

export interface ConciergeHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConciergeChatRequest {
  message: string;
  conversationId?: string;
  history?: ConciergeHistoryTurn[];
  context?: ConciergeLiveContext;
  categoryHint?: ConciergeCategory;
}

export interface ConciergePlaceCard {
  name: string;
  area: string;
  badge?: string;
  distanceHint?: string;
  priceBandMyr?: string;
  why: string;
}

export interface ConciergePhraseTip {
  phrase: string;
  pronunciation?: string;
  meaning: string;
}

export interface ConciergeSosCard {
  color: '#E11D48';
  path: 'emergency-help';
  numbers: Array<{ code: string; label: string }>;
}

export interface ConciergeReply {
  text: string;
  placeCards: ConciergePlaceCard[];
  phraseTips: ConciergePhraseTip[];
  followUpChips: string[];
  deepLink?: string;
  trustLine: string | null;
  sos: ConciergeSosCard | null;
}

export interface ConciergeChatResponse {
  conversationId: string;
  category: ConciergeCategory;
  escalationLevel: 'none' | 'handoff' | 'sos' | 'out_of_bounds';
  mode: 'retrieve_and_rank' | 'llm';
  fallbackReason?: 'llm_error' | 'llm_invalid';
  reply: ConciergeReply;
  citations: Array<{ articleId: string; title: string; score: number }>;
  analytics: {
    category: ConciergeCategory;
    escalationLevel: 'none' | 'handoff' | 'sos' | 'out_of_bounds';
  };
}

export interface SuggestedChip {
  label: string;
  emoji: string;
  categoryHint: ConciergeCategory;
}

/** Stitch prompt chips from AI Malaysia Concierge. */
export const SUGGESTED_CHIPS: SuggestedChip[] = [
  { label: 'Is this food spicy?', emoji: '🌶️', categoryHint: 'food_spice_diet' },
  { label: 'How to ride the LRT?', emoji: '🚆', categoryHint: 'local_transport' },
  { label: 'Best dinner near KLCC?', emoji: '🍲', categoryHint: 'nearby_dining' },
  { label: 'Do I need cash for night market?', emoji: '💵', categoryHint: 'money_payments' },
  { label: 'Dress code for Batu Caves?', emoji: '🛕', categoryHint: 'culture_etiquette' },
];

export const DEFAULT_LIVE_CONTEXT: ConciergeLiveContext = {
  area: 'Bukit Bintang',
  destination: 'Kuala Lumpur',
  tripMode: 'family',
};

export const DEFAULT_LIVE_CONTEXT_LABEL = 'Bukit Bintang, KL • Family trip';

export const SOS_COLOR = '#E11D48';

@Injectable({ providedIn: 'root' })
export class ConciergeService {
  private readonly url = `${environment.apiBaseUrl}/concierge/chat`;

  constructor(private readonly http: HttpClient) {}

  chat(body: ConciergeChatRequest): Observable<ConciergeChatResponse> {
    return this.http.post<ConciergeChatResponse>(this.url, body, { withCredentials: true });
  }
}
