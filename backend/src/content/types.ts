export const CONTENT_KINDS = [
  'arrival_guide',
  'faq',
  'etiquette',
  'payment',
  'safety',
] as const;

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
export type ContentArrivalStage = (typeof CONTENT_ARRIVAL_STAGES)[number];

export const CONTENT_PAYMENT_TOPICS = ['ringgit', 'atm', 'card', 'cash', 'situation'] as const;
export type ContentPaymentTopic = (typeof CONTENT_PAYMENT_TOPICS)[number];

export const CONTENT_SAFETY_TOPICS = [
  'lost_items',
  'scams',
  'transport_disputes',
  'document_loss',
] as const;
export type ContentSafetyTopic = (typeof CONTENT_SAFETY_TOPICS)[number];

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

export interface ContentListFilters {
  kind?: ContentKind;
  published?: boolean;
  q?: string;
}

export interface CreateContentInput {
  slug: string;
  kind: ContentKind;
  title: string;
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

export interface UpdateContentInput {
  slug?: string;
  kind?: ContentKind;
  title?: string;
  summary?: string;
  body?: string;
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

export interface ContentStore {
  list(filters?: ContentListFilters): Promise<ContentItem[]>;
  get(id: string): Promise<ContentItem | undefined>;
  create(input: CreateContentInput): Promise<ContentItem>;
  update(id: string, patch: UpdateContentInput): Promise<ContentItem | undefined>;
  setPublished(id: string, published: boolean): Promise<ContentItem | undefined>;
  delete(id: string): Promise<boolean>;
}
