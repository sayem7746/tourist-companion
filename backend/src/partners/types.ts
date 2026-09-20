export const PARTNER_CATEGORIES = [
  'hotels',
  'transfers',
  'tours',
  'sim',
  'restaurants',
  'tourist_services',
] as const;

export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];
export type ProviderCategory = PartnerCategory;

export const REFERRAL_DISCLOSURE =
  'We may earn a commission if you book or buy through this link.';

export const COMMISSION_BASES = ['booking', 'click', 'activation'] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];

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

export type ArrivalAirportCode = 'KUL' | 'KLIA2';

export interface PartnerCommission {
  rate: number;
  currency: 'MYR';
  basis: CommissionBasis;
}

export interface PartnerListing {
  summary: string;
  city?: string | null;
  area?: string | null;
  bookingUrl?: string | null;
  disclosure: string;
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
  id: string;
  name: string;
  slug: string;
  category: ProviderCategory;
  isActive: boolean;
  website?: string | null;
  contactEmail?: string | null;
  listing?: PartnerListing;
  commission?: PartnerCommission;
}

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
  id: string;
  userId: string;
  tripId?: string;
  providerId: string;
  placeId?: string;
  referralCode: string;
  status: ReferralStatus;
  channel?: ReferralChannel;
  itineraryItemId?: string | null;
  convertedAt?: string | null;
  metadata?: ReferralMetadata;
}

/** Row shape for `providers` after the partner marketplace migration. */
export interface ProviderRow {
  id: string;
  name: string;
  slug: string;
  category: ProviderCategory;
  isActive: boolean;
  website: string | null;
  contactEmail: string | null;
  commissionRate: string | number;
  commissionBasis: CommissionBasis;
  commissionCurrency: 'MYR';
  listingSummary: string;
  listingCity: string | null;
  listingArea: string | null;
  bookingUrl: string | null;
  disclosure: string;
  sponsored: boolean;
  licenseName: string | null;
  licenseId: string | null;
  typicalMyr: string | null;
  languages: string[] | null;
  listingExtras: Record<string, unknown> | null;
}

export interface ReferralRow {
  id: string;
  userId: string;
  tripId: string | null;
  providerId: string;
  placeId: string | null;
  referralCode: string;
  status: ReferralStatus;
  channel: ReferralChannel | null;
  itineraryItemId: string | null;
  convertedAt: Date | string | null;
  metadata: ReferralMetadata;
}

export interface PartnerListFilters {
  category?: PartnerCategory;
  isActive?: boolean;
}

export interface CreatePartnerInput {
  name: string;
  slug: string;
  category: PartnerCategory;
  isActive?: boolean;
  website?: string | null;
  contactEmail?: string | null;
  listing: PartnerListing;
  commission?: PartnerCommission;
}

export interface UpdatePartnerInput {
  name?: string;
  slug?: string;
  category?: PartnerCategory;
  website?: string | null;
  contactEmail?: string | null;
  listing?: Partial<PartnerListing>;
  commission?: Partial<Pick<PartnerCommission, 'rate' | 'basis'>>;
}

export interface TrackClickInput {
  userId: string;
  providerId: string;
  channel: ReferralChannel;
  tripId?: string | null;
  placeId?: string | null;
  itineraryItemId?: string | null;
  referralCode?: string;
  clickKey?: string;
}

export interface TrackLeadInput {
  userId: string;
  providerId?: string;
  channel?: ReferralChannel;
  referralId?: string;
  referralCode?: string;
  tripId?: string | null;
  placeId?: string | null;
  itineraryItemId?: string | null;
  clickKey?: string;
}

export interface TrackBookingInput {
  referralId?: string;
  referralCode?: string;
}

export interface ReferralTrackResult {
  referral: Referral;
  created: boolean;
  outboundUrl: string | null;
  redirectPath: string;
}

export interface OutboundRedirect {
  referral: Referral;
  url: string;
}

export interface ReferralPersistence {
  getProvider(id: string): Promise<Provider | undefined>;
  findReferralById(id: string): Promise<ReferralRow | undefined>;
  findReferralByCode(code: string): Promise<ReferralRow | undefined>;
  findReferralByClickKey(userId: string, clickKey: string): Promise<ReferralRow | undefined>;
  insertReferral(row: ReferralRow): Promise<ReferralRow>;
  updateReferral(row: ReferralRow): Promise<ReferralRow>;
}

export interface PartnerStore {
  list(filters?: PartnerListFilters): Promise<Provider[]>;
  get(id: string): Promise<Provider | undefined>;
  create(input: CreatePartnerInput): Promise<Provider>;
  update(id: string, patch: UpdatePartnerInput): Promise<Provider | undefined>;
  setActive(id: string, isActive: boolean): Promise<Provider | undefined>;
  delete(id: string): Promise<boolean>;
  trackClick(input: TrackClickInput): Promise<ReferralTrackResult>;
  trackLead(input: TrackLeadInput): Promise<ReferralTrackResult>;
  trackBooking(input: TrackBookingInput): Promise<Referral | undefined>;
  listReferrals(userId: string): Promise<Referral[]>;
  redirectByCode(code: string): Promise<OutboundRedirect | undefined>;
}
