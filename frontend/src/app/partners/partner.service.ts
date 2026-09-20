import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const REFERRAL_DISCLOSURE =
  'We may earn a commission if you book or buy through this link.';
export const SPONSORED_BADGE_LABEL = 'Sponsored' as const;
export const SPONSORED_BADGE_COLOR = '#D97706' as const;
export const SPONSORED_BADGE_TINT = '#FEF3C7' as const;

export const PARTNER_CATEGORIES = [
  'hotels',
  'transfers',
  'tours',
  'sim',
  'restaurants',
  'tourist_services',
] as const;
export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

export const PARTNER_CATEGORY_CHIPS: Array<{ id: PartnerCategory; label: string }> = [
  { id: 'hotels', label: 'Hotels' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'tours', label: 'Tours' },
  { id: 'sim', label: 'SIM / eSIM' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'tourist_services', label: 'Tourist services' },
];

export const REFERRAL_CHANNELS = [
  'itinerary',
  'arrival',
  'explore',
  'concierge',
  'dashboard',
] as const;
export type ReferralChannel = (typeof REFERRAL_CHANNELS)[number];

export const REFERRAL_STATUSES = ['pending', 'clicked', 'converted', 'expired'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export type ArrivalAirportCode = 'KUL' | 'KLIA2';

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

export interface TouristProvider {
  id: string;
  name: string;
  slug: string;
  category: PartnerCategory;
  isActive: boolean;
  website?: string | null;
  listing?: PartnerListing;
  contactEmail?: string | null;
  commission?: unknown;
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
}

export interface ReferralClickResult {
  referral: Referral;
  created: boolean;
  outboundUrl: string | null;
  redirectPath: string;
}

export interface PartnerListQuery {
  category?: PartnerCategory;
  city?: string;
  airport?: ArrivalAirportCode;
}

export interface FilterPublicPartnersOptions {
  categories?: readonly PartnerCategory[] | null;
  airport?: ArrivalAirportCode | null;
  city?: string | null;
  partnerIds?: readonly string[] | null;
  limit?: number;
}

export const TRIP_PARTNER_CATEGORIES: PartnerCategory[] = ['hotels', 'transfers', 'tours', 'sim'];
export const NEARBY_PARTNER_CATEGORIES: PartnerCategory[] = [
  'restaurants',
  'tours',
  'tourist_services',
];
export const CONCIERGE_PARTNER_CATEGORIES: PartnerCategory[] = [
  'tours',
  'restaurants',
  'transfers',
];

export function partnerCategoryLabel(category: PartnerCategory): string {
  return PARTNER_CATEGORY_CHIPS.find((chip) => chip.id === category)?.label ?? category;
}

export function nearbyPartnerCategories(chip: string): PartnerCategory[] | null {
  switch (chip) {
    case 'all':
      return [...NEARBY_PARTNER_CATEGORIES];
    case 'food':
      return ['restaurants'];
    case 'attractions':
      return ['tours'];
    case 'transport':
      return ['transfers'];
    case 'tourist_services':
      return ['tourist_services'];
    default:
      return [];
  }
}

export function placePartnerCategories(nearbyCategory: string): PartnerCategory[] {
  return nearbyPartnerCategories(nearbyCategory) ?? NEARBY_PARTNER_CATEGORIES;
}

export function partnerCtaLabel(category: PartnerCategory): string {
  switch (category) {
    case 'hotels':
      return 'Book stay';
    case 'transfers':
      return 'Book transfer';
    case 'tours':
      return 'Book tickets';
    case 'sim':
      return 'Get SIM / eSIM';
    case 'restaurants':
      return 'Reserve table';
    default:
      return 'Open partner';
  }
}

export function partnerOutboundUrl(partner: TouristProvider): string | null {
  const listing = partner.listing;
  const candidates = [listing?.bookingUrl, listing?.reservationUrl, partner.website];
  const https = candidates.find((value) => typeof value === 'string' && /^https:\/\//i.test(value));
  return https ?? null;
}

export function partnerDisclosure(partner: TouristProvider): string {
  const text = partner.listing?.disclosure?.trim();
  return text || REFERRAL_DISCLOSURE;
}

export function partnerLocation(partner: TouristProvider): string {
  const listing = partner.listing;
  return [listing?.area, listing?.city].filter((value) => value && value.trim()).join(' · ');
}

export function filterPublicPartners(
  partners: TouristProvider[],
  options: FilterPublicPartnersOptions = {},
): TouristProvider[] {
  if (options.categories && options.categories.length === 0) {
    return [];
  }
  let next = partners.filter((partner) => partner.isActive !== false);
  if (options.categories?.length) {
    next = next.filter((partner) => options.categories!.includes(partner.category));
  }
  if (options.airport) {
    next = next.filter((partner) => {
      const codes = partner.listing?.airportCodes;
      return !codes?.length || codes.includes(options.airport!);
    });
  }
  if (options.city?.trim()) {
    const needle = options.city.trim().toLowerCase();
    next = next.filter((partner) =>
      `${partner.listing?.city ?? ''} ${partner.listing?.area ?? ''}`.toLowerCase().includes(needle),
    );
  }
  if (options.partnerIds?.length) {
    const ids = new Set(options.partnerIds);
    next = next.filter((partner) => ids.has(partner.id));
  }
  next = [...next].sort((a, b) => {
    const sponsoredDelta = Number(Boolean(b.listing?.sponsored)) - Number(Boolean(a.listing?.sponsored));
    if (sponsoredDelta !== 0) {
      return sponsoredDelta;
    }
    return a.name.localeCompare(b.name);
  });
  if (options.limit && options.limit > 0) {
    return next.slice(0, options.limit);
  }
  return next;
}

export function referralStatusLabel(status: ReferralStatus): string {
  switch (status) {
    case 'pending':
      return 'Code ready';
    case 'clicked':
      return 'Opened';
    case 'converted':
      return 'Booked';
    case 'expired':
      return 'Expired';
  }
}

export function openOutbound(url: string): Window | null {
  return window.open(url, '_blank', 'noopener,noreferrer');
}

@Injectable({ providedIn: 'root' })
export class PartnerService {
  private readonly base = `${environment.apiBaseUrl}/partners`;
  private readonly referralsUrl = `${environment.apiBaseUrl}/referrals`;
  private catalog$?: Observable<TouristProvider[]>;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<TouristProvider[]> {
    if (!this.catalog$) {
      this.catalog$ = this.http.get<{ partners: TouristProvider[] }>(this.base).pipe(
        map((body) => body.partners ?? []),
        catchError((error: unknown) => {
          this.catalog$ = undefined;
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.catalog$;
  }

  refresh(): Observable<TouristProvider[]> {
    this.catalog$ = undefined;
    return this.list();
  }

  listReferrals(): Observable<Referral[]> {
    return this.http
      .get<{ referrals: Referral[] }>(this.referralsUrl, { withCredentials: true })
      .pipe(map((body) => body.referrals ?? []));
  }

  trackClick(body: {
    providerId: string;
    channel: ReferralChannel;
    tripId?: string | null;
    placeId?: string | null;
    itineraryItemId?: string | null;
    clickKey?: string;
  }): Observable<ReferralClickResult> {
    return this.http.post<ReferralClickResult>(`${this.referralsUrl}/clicks`, body, {
      withCredentials: true,
    });
  }
}
