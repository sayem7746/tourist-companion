/** Shared domain types for frontend and backend. */

export type UserId = string;
export type TripId = string;
export type PlaceId = string;
export type ProviderId = string;
export type ReferralId = string;
export type ItineraryId = string;
export type ItineraryDayId = string;
export type ItineraryItemId = string;

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

export type PlacesProviderKind = 'seed' | 'google' | 'overpass';

export interface NearbyArea {
  id: string;
  label: string;
  radiusMeters: number;
  latitude: number;
  longitude: number;
}

/** Default Explore pin is KLCC & Downtown, ≤2 km (Stitch). */
export const NEARBY_AREAS: NearbyArea[] = [
  {
    id: 'klcc',
    label: 'KLCC & Downtown',
    radiusMeters: 2000,
    latitude: 3.15785,
    longitude: 101.71165,
  },
  {
    id: 'bukit_bintang',
    label: 'Bukit Bintang',
    radiusMeters: 1500,
    latitude: 3.1466,
    longitude: 101.711,
  },
  {
    id: 'batu_caves',
    label: 'Batu Caves',
    radiusMeters: 2500,
    latitude: 3.2379,
    longitude: 101.684,
  },
];

export const DEFAULT_NEARBY_AREA_ID = 'klcc' as const;

export interface Place {
  id: PlaceId;
  name: string;
  category: PlaceCategory;
  city?: string;
  country?: string;
}

export interface SavedTripPlace {
  tripId: TripId;
  placeId: PlaceId;
  catalogId: PlaceId;
  name: string;
  category: PlaceCategory;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  sortOrder: number;
}

/** MVP itinerary length (EPIC 06). Inclusive trip days are clipped to this range. */
export const ITINERARY_MIN_DAYS = 1;
export const ITINERARY_MAX_DAYS = 7;

export const ITINERARY_ITEM_KINDS = ['activity', 'meal', 'travel', 'note'] as const;
export type ItineraryItemKind = (typeof ITINERARY_ITEM_KINDS)[number];

export const ITINERARY_STATUSES = ['draft', 'active', 'archived'] as const;
export type ItineraryStatus = (typeof ITINERARY_STATUSES)[number];

/** One generated plan per trip. Day count is 1–7. */
export interface Itinerary {
  id: ItineraryId;
  tripId: TripId;
  /** Inclusive days covered, 1–7. */
  dayCount: number;
  status: ItineraryStatus;
  days: ItineraryDay[];
  generatedAt?: string;
  updatedAt?: string;
}

export const WEATHER_DISCLAIMER =
  'Planning hint only — not a forecast guarantee. Conditions can change.';

export const WEATHER_SOURCES = ['open-meteo', 'seed'] as const;
export type WeatherSource = (typeof WEATHER_SOURCES)[number];

export const WEATHER_CONDITIONS = ['storm', 'rain', 'heat', 'haze_season', 'typical'] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

/** Day-level planning hint. Live Open-Meteo when available; otherwise climate seed. */
export interface DayWeatherHint {
  source: WeatherSource;
  condition: WeatherCondition;
  summary: string;
  hint: string;
  indoorSafe: boolean;
  disclaimer: string;
}

/** Calendar day in the Plan tab / Home “Today's Plan” timeline. */
export interface ItineraryDay {
  id: ItineraryDayId;
  itineraryId: ItineraryId;
  /** 1-based index (Stitch “Day 2 of 7”). */
  dayNumber: number;
  /** ISO calendar date `YYYY-MM-DD` in `Asia/Kuala_Lumpur`. */
  date: string;
  items: ItineraryItem[];
  /** Read-time weather overlay; not persisted on the itinerary. */
  weather?: DayWeatherHint | null;
}

/**
 * Timed block on a day. Stitch shows start as `09:30 AM`, inbound commute as
 * “15 min travel time”, meals as restaurant chips, and booking as an outbound link.
 */
export interface ItineraryItem {
  id: ItineraryItemId;
  dayId: ItineraryDayId;
  sortOrder: number;
  kind: ItineraryItemKind;
  /** Local 24h `HH:mm` in `Asia/Kuala_Lumpur`. */
  startTime: string;
  /** Local 24h `HH:mm`; same calendar day as `ItineraryDay.date`. */
  endTime: string;
  placeId?: PlaceId | null;
  /** Minutes to reach this block (Stitch commute connector) or duration when `kind` is `travel`. */
  travelTimeMinutes?: number | null;
  notes?: string | null;
  bookingUrl?: string | null;
  /** Partner `Provider.id` for referral attribution; omit when there is no partner. */
  referralPartnerId?: ProviderId | null;
  /** When true, regeneration must keep this item. */
  locked: boolean;
  /** Display title when there is no place, or a denormalized place name. */
  title?: string | null;
}

/** Normalized Explore / nearby POI (provider-agnostic). */
export interface NearbyPlace extends Place {
  nearbyCategory: NearbyCategory;
  area?: string;
  address?: string;
  description?: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  walkMinutes?: number;
  openNow?: boolean | null;
  halal?: boolean | null;
  englishSpoken?: boolean | null;
  badges: string[];
  priceBandMyr?: string;
  source: PlacesProviderKind;
  externalId?: string;
}

/** Photo shown only when a reuse license and attribution are known. */
export interface LicensedPlacePhoto {
  url: string;
  license: string;
  attribution: string;
  sourceUrl?: string;
}

export const PLACE_ACTION_KINDS = ['directions', 'call', 'website', 'booking'] as const;
export type PlaceActionKind = (typeof PLACE_ACTION_KINDS)[number];

export interface PlaceExternalAction {
  kind: PlaceActionKind;
  label: string;
  href: string;
}

export interface PlaceDetails extends NearbyPlace {
  phone?: string;
  website?: string;
  bookingUrl?: string;
  bookingLabel?: string;
  hoursSummary?: string | null;
  hoursLines: string[];
  photos: LicensedPlacePhoto[];
  actions: PlaceExternalAction[];
}

export type ArrivalAirportCode = 'KUL' | 'KLIA2';

/** MVP referral-marketplace partner types (EPIC 07). */
export const PARTNER_CATEGORIES = [
  'hotels',
  'transfers',
  'tours',
  'sim',
  'restaurants',
  'tourist_services',
] as const;

export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

/** Alias for `providers.category` / partner listings. */
export type ProviderCategory = PartnerCategory;

export interface PartnerCategoryChip {
  id: PartnerCategory;
  label: string;
}

export const PARTNER_CATEGORY_CHIPS: PartnerCategoryChip[] = [
  { id: 'hotels', label: 'Hotels' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'tours', label: 'Tours' },
  { id: 'sim', label: 'SIM / eSIM' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'tourist_services', label: 'Tourist services' },
];

/** Shown next to every referral CTA (organic and sponsored). */
export const REFERRAL_DISCLOSURE =
  'We may earn a commission if you book or buy through this link.';

export const SPONSORED_BADGE_LABEL = 'Sponsored' as const;

/** Stitch secondary gold — Sponsored chip (see `docs/stitch-design.md`). */
export const SPONSORED_BADGE_COLOR = '#D97706' as const;
export const SPONSORED_BADGE_TINT = '#FEF3C7' as const;

export const COMMISSION_BASES = ['booking', 'click', 'activation'] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];

/** Ops-only; omit from tourist API responses. */
export interface PartnerCommission {
  /** Fraction 0–1 inclusive (`providers.commission_rate`). */
  rate: number;
  currency: 'MYR';
  basis: CommissionBasis;
}

export interface PartnerListing {
  summary: string;
  city?: string | null;
  area?: string | null;
  bookingUrl?: string | null;
  /** Traveler-visible; default `REFERRAL_DISCLOSURE`. */
  disclosure: string;
  /** Paid placement → gold Sponsored badge. */
  sponsored: boolean;
  licenseName?: string | null;
  licenseId?: string | null;
  typicalMyr?: string | null;
  languages?: string[];
  hotelClassHint?: string | null;
  vehicleClass?: string | null;
  airportCodes?: ArrivalAirportCode[];
  meetAndGreet?: boolean | null;
  durationHint?: string | null;
  meetingPoint?: string | null;
  connectivityKind?: 'esim' | 'prepaid_sim' | null;
  dataAllowance?: string | null;
  validity?: string | null;
  passportRequired?: boolean | null;
  halal?: boolean | null;
  reservationUrl?: string | null;
  deskHours?: string | null;
}

export interface Provider {
  id: ProviderId;
  name: string;
  slug: string;
  category: ProviderCategory;
  isActive: boolean;
  website?: string | null;
  /** Partner ops; never render in the tourist app. */
  contactEmail?: string | null;
  listing?: PartnerListing;
  /** Omit on tourist responses. */
  commission?: PartnerCommission;
}

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

export const REFERRAL_STATUSES = ['pending', 'clicked', 'converted', 'expired'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REFERRAL_CHANNELS = [
  'itinerary',
  'arrival',
  'explore',
  'concierge',
  'dashboard',
] as const;
export type ReferralChannel = (typeof REFERRAL_CHANNELS)[number];

export const REFERRAL_EVENT_TYPES = ['click', 'lead', 'booking'] as const;
export type ReferralEventType = (typeof REFERRAL_EVENT_TYPES)[number];

export interface ReferralEvent {
  type: ReferralEventType;
  at: string;
  channel?: ReferralChannel;
}

export interface ReferralMetadata {
  clickKey?: string;
  clickCount?: number;
  leadCount?: number;
  bookingCount?: number;
  events?: ReferralEvent[];
  source?: string;
  [key: string]: unknown;
}

export interface Referral {
  id: ReferralId;
  userId: UserId;
  tripId?: TripId;
  providerId: ProviderId;
  placeId?: PlaceId;
  referralCode: string;
  status: ReferralStatus;
  channel?: ReferralChannel;
  itineraryItemId?: ItineraryItemId | null;
  convertedAt?: string | null;
  metadata?: ReferralMetadata;
}

export interface ReferralAnalyticsCounts {
  referrals: number;
  clicks: number;
  leads: number;
  conversions: number;
}

export interface ReferralAnalyticsTotals extends ReferralAnalyticsCounts {
  pending: number;
  clicked: number;
  converted: number;
  expired: number;
  conversionRate: number;
}

export interface PartnerPerformance extends ReferralAnalyticsCounts {
  providerId: ProviderId;
  name: string;
  slug: string;
  category: PartnerCategory;
  isActive: boolean;
  conversionRate: number;
}

export interface ReferralChannelPerformance extends ReferralAnalyticsCounts {
  channel: ReferralChannel | null;
}

export interface ReferralAnalytics {
  totals: ReferralAnalyticsTotals;
  partners: PartnerPerformance[];
  channels: ReferralChannelPerformance[];
}
