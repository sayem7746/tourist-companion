/** Shared domain types for frontend and backend. */

export type UserId = string;
export type TripId = string;
export type PlaceId = string;
export type ProviderId = string;
export type ReferralId = string;

export interface User {
  id: UserId;
  email: string;
  displayName: string;
}

export type DietaryPreference =
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'kosher'
  | 'gluten_free'
  | 'dairy_free'
  | 'nut_free'
  | 'pescatarian';

export type MobilityNeed =
  | 'wheelchair'
  | 'limited_walking'
  | 'visual_impairment'
  | 'hearing_impairment';

export type TravelStyle = 'relaxed' | 'balanced' | 'packed';
export type DailyBudget = 'low' | 'medium' | 'high';
export type TripInterest =
  | 'food'
  | 'nature'
  | 'culture'
  | 'shopping'
  | 'nightlife'
  | 'family'
  | 'adventure'
  | 'wellness';

export interface TouristProfile {
  userId: UserId;
  email: string;
  displayName: string;
  language: string;
  dietaryPreferences: DietaryPreference[];
  mobilityNeeds: MobilityNeed[];
  travelStyle: TravelStyle | null;
}

export interface Trip {
  id: TripId;
  userId: UserId;
  destination: string;
  startDate: string;
  endDate: string;
  adultCount: number;
  childCount: number;
  interests: TripInterest[];
  dailyBudget: DailyBudget | null;
  travelStyle: TravelStyle | null;
  accommodationName: string | null;
  arrivalAirport: string | null;
  arrivalFlight: string | null;
  arrivalAt: string | null;
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
}

export type PlaceCategory =
  | 'airport'
  | 'attraction'
  | 'food'
  | 'lodging'
  | 'transport'
  | 'shopping'
  | 'safety'
  | 'other';

/** MVP Explore / nearby filter ids. `all` is a chip only, not a place type. */
export const NEARBY_CATEGORIES = [
  'food',
  'attractions',
  'transport',
  'atm',
  'pharmacy',
  'convenience',
  'tourist_services',
] as const;

export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number];

export const NEARBY_CHIP_IDS = ['all', ...NEARBY_CATEGORIES] as const;
export type NearbyChipId = (typeof NEARBY_CHIP_IDS)[number];

export interface NearbyCategoryChip {
  id: NearbyChipId;
  /** Stitch Explore chip copy (horizontal scroller). */
  label: string;
  /** Material-style icon name used in the Stitch mock. */
  icon: string;
}

export const NEARBY_CATEGORY_CHIPS: NearbyCategoryChip[] = [
  { id: 'all', label: 'All', icon: '' },
  { id: 'food', label: 'Food & Halal', icon: 'restaurant' },
  { id: 'attractions', label: 'Must-See Sights', icon: 'photo_camera' },
  { id: 'transport', label: 'Transit', icon: 'directions_transit' },
  { id: 'atm', label: 'ATMs', icon: 'atm' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'local_pharmacy' },
  { id: 'convenience', label: 'Convenience', icon: 'local_convenience_store' },
  { id: 'tourist_services', label: 'Tourist services', icon: 'info' },
];

export const NEARBY_QUICK_FILTERS = ['open_now', 'halal_only', 'walk_15'] as const;
export type NearbyQuickFilter = (typeof NEARBY_QUICK_FILTERS)[number];

export const NEARBY_QUICK_FILTER_CHIPS: Array<{ id: NearbyQuickFilter; label: string }> = [
  { id: 'open_now', label: 'Open Now' },
  { id: 'halal_only', label: 'Halal Only' },
  { id: 'walk_15', label: '≤ 15 min walk' },
];

export const PLACE_CATEGORY_BY_NEARBY: Record<NearbyCategory, PlaceCategory> = {
  food: 'food',
  attractions: 'attraction',
  transport: 'transport',
  atm: 'other',
  pharmacy: 'safety',
  convenience: 'shopping',
  tourist_services: 'other',
};

export interface Place {
  id: PlaceId;
  name: string;
  category: PlaceCategory;
  city?: string;
  country?: string;
}

export type ProviderCategory =
  | 'transport'
  | 'lodging'
  | 'activity'
  | 'sim'
  | 'insurance'
  | 'other';

export interface Provider {
  id: ProviderId;
  name: string;
  slug: string;
  category: ProviderCategory;
  isActive: boolean;
}

export type ArrivalAirportCode = 'KUL' | 'KLIA2';

export type ArrivalStage =
  | 'immigration'
  | 'baggage'
  | 'customs'
  | 'sim'
  | 'money'
  | 'transport'
  | 'first_steps';

export interface ArrivalChecklistItem {
  id: string;
  airportCode: ArrivalAirportCode;
  stage: ArrivalStage;
  title: string;
  body: string;
  sortOrder: number;
  estimatedMinutes?: number;
}

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

export type ConnectivityKind = 'wifi' | 'esim' | 'prepaid_sim';

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

export type PaymentKind = 'ringgit' | 'atm' | 'card' | 'cash' | 'situation';

export interface ArrivalPaymentOption {
  id: string;
  airportCode: ArrivalAirportCode;
  kind: PaymentKind;
  name: string;
  badge: string;
  summary: string;
  location?: string;
  currencyCode: 'MYR';
  howTo: string;
  whenToUse: string;
  sortOrder: number;
}

export interface ArrivalPaymentTip {
  id: string;
  airportCode: ArrivalAirportCode;
  title: string;
  body: string;
  sortOrder: number;
}

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

export type KnowledgeEscalation = 'none' | 'handoff' | 'sos' | 'out_of_bounds';

export type ConciergeEscalationLevel = KnowledgeEscalation;
export type ConciergeMode = 'retrieve_and_rank' | 'llm';

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

export interface ConciergeReply {
  text: string;
  placeCards: KnowledgePlaceCard[];
  phraseTips: KnowledgePhraseTip[];
  followUpChips: string[];
  deepLink?: string;
  trustLine: string | null;
  sos: {
    color: '#E11D48';
    path: 'emergency-help';
    numbers: Array<{ code: string; label: string }>;
  } | null;
}

export interface ConciergeRetention {
  maxMessages: number;
  ttlMs: number;
  persistEmergency: false;
}

export interface ConciergeHistoryResponse {
  tripId: string | null;
  conversationId: string | null;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
    expiresAt: string;
  }>;
  retention: ConciergeRetention;
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
  citations: Array<{ articleId: string; title: string; score: number }>;
  analytics: {
    category: ConciergeCategory;
    escalationLevel: ConciergeEscalationLevel;
  };
}

export type ReferralStatus = 'pending' | 'clicked' | 'converted' | 'expired';

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

export type ReferralStatus = 'pending' | 'clicked' | 'converted' | 'expired';

export interface Referral {
  id: ReferralId;
  userId: UserId;
  tripId?: TripId;
  providerId: ProviderId;
  placeId?: PlaceId;
  referralCode: string;
  status: ReferralStatus;
}
