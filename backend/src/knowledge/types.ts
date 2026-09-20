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

export const KNOWLEDGE_TOPICS = [
  'transport',
  'etiquette',
  'weather',
  'payments',
  'food',
  'attractions',
  'faq',
] as const;

export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

export const KNOWLEDGE_ESCALATIONS = ['none', 'handoff', 'sos', 'out_of_bounds'] as const;
export type KnowledgeEscalation = (typeof KNOWLEDGE_ESCALATIONS)[number];

export const DEFAULT_KNOWLEDGE_COUNTRY = 'MY' as const;

export interface KnowledgePhraseTip {
  phrase: string;
  pronunciation?: string;
  meaning: string;
}

export interface KnowledgePlaceCard {
  name: string;
  area: string;
  badge?: string;
  distanceHint?: string;
  priceBandMyr?: string;
  why: string;
}

export interface KnowledgePromptChip {
  id: string;
  label: string;
  category: ConciergeCategory;
  articleId?: string;
}

export interface KnowledgeArticle {
  id: string;
  topic: KnowledgeTopic;
  category: ConciergeCategory;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  area?: string;
  typicalMyr?: string;
  phraseTips?: KnowledgePhraseTip[];
  followUpChips?: string[];
  placeCards?: KnowledgePlaceCard[];
  deepLink?: string;
  trustLineEligible?: boolean;
  escalation: KnowledgeEscalation;
  sortOrder: number;
}

export interface MalaysiaKnowledgeSeed {
  country: typeof DEFAULT_KNOWLEDGE_COUNTRY;
  destination: 'Malaysia';
  version: string;
  chips: KnowledgePromptChip[];
  articles: KnowledgeArticle[];
}
