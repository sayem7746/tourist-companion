import { MALAYSIA_SOS_CARD } from '../emergency/content.js';
import type { ConciergeCategory, KnowledgePhraseTip, KnowledgePlaceCard } from '../knowledge/types.js';

export const CONCIERGE_ESCALATION_LEVELS = ['none', 'handoff', 'sos', 'out_of_bounds'] as const;
export type ConciergeEscalationLevel = (typeof CONCIERGE_ESCALATION_LEVELS)[number];

export const CONCIERGE_MODES = ['retrieve_and_rank', 'llm'] as const;
export type ConciergeMode = (typeof CONCIERGE_MODES)[number];

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
  tripId?: string;
  history?: ConciergeHistoryTurn[];
  context?: ConciergeLiveContext;
  categoryHint?: ConciergeCategory;
}

export interface ConciergeSosCard {
  color: '#E11D48';
  path: 'emergency-help';
  numbers: Array<{ code: string; label: string }>;
}

export interface ConciergeCitation {
  articleId: string;
  title: string;
  score: number;
}

export interface ConciergeReply {
  text: string;
  placeCards: KnowledgePlaceCard[];
  phraseTips: KnowledgePhraseTip[];
  followUpChips: string[];
  deepLink?: string;
  trustLine: string | null;
  sos: ConciergeSosCard | null;
}

export interface ConciergeChatResponse {
  conversationId: string;
  tripId?: string;
  persisted?: boolean;
  category: ConciergeCategory;
  escalationLevel: ConciergeEscalationLevel;
  mode: ConciergeMode;
  fallbackReason?: 'llm_error' | 'llm_invalid';
  reply: ConciergeReply;
  citations: ConciergeCitation[];
  analytics: {
    category: ConciergeCategory;
    escalationLevel: ConciergeEscalationLevel;
  };
}

export const TRUST_LINE = 'Verified cultural etiquette & local transport safety checked';

/** Same numbers as GET /emergency `sos` (Malaysia seed). */
export const SOS_CARD: ConciergeSosCard = MALAYSIA_SOS_CARD;
