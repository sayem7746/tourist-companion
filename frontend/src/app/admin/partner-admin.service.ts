import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const PARTNER_CATEGORIES = [
  'hotels',
  'transfers',
  'tours',
  'sim',
  'restaurants',
  'tourist_services',
] as const;

export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

export const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  hotels: 'Hotels',
  transfers: 'Transfers',
  tours: 'Tours',
  sim: 'SIM / eSIM',
  restaurants: 'Restaurants',
  tourist_services: 'Tourist services',
};

export const PARTNER_CATEGORY_CHIPS: { id: PartnerCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  ...PARTNER_CATEGORIES.map((id) => ({ id, label: PARTNER_CATEGORY_LABELS[id] })),
];

export const COMMISSION_BASES = ['booking', 'click', 'activation'] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];

export const COMMISSION_BASIS_LABELS: Record<CommissionBasis, string> = {
  booking: 'Booking',
  click: 'Click',
  activation: 'Activation',
};

export const AIRPORT_CODES = ['KUL', 'KLIA2'] as const;
export type ArrivalAirportCode = (typeof AIRPORT_CODES)[number];

export const CONNECTIVITY_KINDS = ['esim', 'prepaid_sim'] as const;
export type ConnectivityKind = (typeof CONNECTIVITY_KINDS)[number];

export const REFERRAL_DISCLOSURE = 'We may earn a commission if you book or buy through this link.';

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
  connectivityKind?: ConnectivityKind | null;
  dataAllowance?: string | null;
  validity?: string | null;
  passportRequired?: boolean | null;
  halal?: boolean | null;
  reservationUrl?: string | null;
  deskHours?: string | null;
}

export interface OpsPartner {
  id: string;
  name: string;
  slug: string;
  category: PartnerCategory;
  isActive: boolean;
  website?: string | null;
  contactEmail?: string | null;
  listing?: PartnerListing;
  commission?: PartnerCommission;
}

export interface PartnerListingDraft {
  summary?: string;
  city?: string | null;
  area?: string | null;
  bookingUrl?: string | null;
  disclosure?: string;
  sponsored?: boolean;
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
  connectivityKind?: ConnectivityKind | null;
  dataAllowance?: string | null;
  validity?: string | null;
  passportRequired?: boolean | null;
  halal?: boolean | null;
  reservationUrl?: string | null;
  deskHours?: string | null;
}

export interface PartnerDraft {
  name: string;
  slug?: string;
  category: PartnerCategory;
  website?: string | null;
  contactEmail?: string | null;
  listing?: PartnerListingDraft;
  commission?: {
    rate: number;
    basis?: CommissionBasis;
    currency?: 'MYR';
  };
}

export type PartnerActiveFilter = 'all' | 'active' | 'paused';
export type TriState = '' | 'true' | 'false';

export function partnerListParams(
  category: PartnerCategory | 'all' = 'all',
  active: PartnerActiveFilter = 'all',
): HttpParams {
  let params = new HttpParams();
  if (category !== 'all') {
    params = params.set('category', category);
  }
  if (active === 'active') {
    params = params.set('isActive', 'true');
  }
  if (active === 'paused') {
    params = params.set('isActive', 'false');
  }
  return params;
}

export function splitPartnerLines(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function partnerLanguageCodes(value: string): string[] {
  return splitPartnerLines(value)
    .map((part) => part.toLowerCase())
    .filter((part) => part.length >= 2 && part.length <= 8)
    .slice(0, 12);
}

export function emptyText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function hasHttpsOutbound(partner: {
  website?: string | null;
  listing?: Pick<PartnerListingDraft, 'bookingUrl' | 'reservationUrl'> | null;
}): boolean {
  return [partner.listing?.bookingUrl, partner.listing?.reservationUrl, partner.website].some(
    (value) => !!value && /^https:\/\//i.test(value.trim()),
  );
}

export function defaultCommissionBasis(category: PartnerCategory): CommissionBasis {
  return category === 'sim' ? 'activation' : 'booking';
}

export function fromTriState(value: TriState): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function toTriState(value: boolean | null | undefined): TriState {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
}

export function selectedAirportCodes(kul: boolean, klia2: boolean): ArrivalAirportCode[] {
  const codes: ArrivalAirportCode[] = [];
  if (kul) codes.push('KUL');
  if (klia2) codes.push('KLIA2');
  return codes;
}

export function filterListedPartners(partners: OpsPartner[], q: string): OpsPartner[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) {
    return partners;
  }
  return partners.filter((partner) => {
    const haystack = [
      partner.name,
      partner.slug,
      partner.contactEmail ?? '',
      partner.listing?.city ?? '',
      partner.listing?.area ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function partnerApprovalBlockers(partner: {
  contactEmail?: string | null;
  website?: string | null;
  listing?: PartnerListingDraft | null;
  commission?: { rate?: number | null } | null;
}): string[] {
  const blockers: string[] = [];
  if (!partner.listing?.summary?.trim()) {
    blockers.push('Add a verified listing summary');
  }
  if (!partner.contactEmail?.trim()) {
    blockers.push('Add an ops contact email');
  }
  if (!hasHttpsOutbound(partner)) {
    blockers.push('Add an HTTPS booking, reservation, or website URL');
  }
  if (partner.commission?.rate == null || !Number.isFinite(Number(partner.commission.rate))) {
    blockers.push('Set a commission rate (0–1)');
  }
  return blockers;
}

export function buildPartnerListingDraft(input: {
  category: PartnerCategory;
  summary: string;
  city: string;
  area: string;
  bookingUrl: string;
  reservationUrl: string;
  disclosure: string;
  sponsored: boolean;
  licenseName: string;
  licenseId: string;
  typicalMyr: string;
  languagesText: string;
  hotelClassHint: string;
  vehicleClass: string;
  kul: boolean;
  klia2: boolean;
  meetAndGreet: TriState;
  durationHint: string;
  meetingPoint: string;
  connectivityKind: ConnectivityKind | '';
  dataAllowance: string;
  validity: string;
  passportRequired: TriState;
  halal: TriState;
  deskHours: string;
}): PartnerListingDraft {
  const listing: PartnerListingDraft = {
    summary: input.summary.trim() || undefined,
    city: emptyText(input.city),
    area: emptyText(input.area),
    bookingUrl: emptyText(input.bookingUrl),
    reservationUrl: emptyText(input.reservationUrl),
    disclosure: input.disclosure.trim() || undefined,
    sponsored: input.sponsored,
    licenseName: emptyText(input.licenseName),
    licenseId: emptyText(input.licenseId),
    typicalMyr: emptyText(input.typicalMyr),
    languages: partnerLanguageCodes(input.languagesText),
  };
  if (input.category === 'hotels') {
    listing.hotelClassHint = emptyText(input.hotelClassHint);
  }
  if (input.category === 'transfers') {
    listing.vehicleClass = emptyText(input.vehicleClass);
    listing.airportCodes = selectedAirportCodes(input.kul, input.klia2);
    listing.meetAndGreet = fromTriState(input.meetAndGreet);
  }
  if (input.category === 'tours') {
    listing.durationHint = emptyText(input.durationHint);
    listing.meetingPoint = emptyText(input.meetingPoint);
  }
  if (input.category === 'sim') {
    listing.connectivityKind = input.connectivityKind || null;
    listing.dataAllowance = emptyText(input.dataAllowance);
    listing.validity = emptyText(input.validity);
    listing.passportRequired = fromTriState(input.passportRequired);
  }
  if (input.category === 'restaurants') {
    listing.halal = fromTriState(input.halal);
  }
  if (input.category === 'tourist_services') {
    listing.deskHours = emptyText(input.deskHours);
  }
  return listing;
}

export function partnerSaveError(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status === 409) {
    return 'A partner with this slug already exists.';
  }
  if (err instanceof HttpErrorResponse && err.status === 400) {
    return 'Check HTTPS URLs, email, and required listing fields.';
  }
  return 'Could not save this partner.';
}

export function partnerActionError(err: unknown, action: 'approve' | 'pause' | 'delete'): string {
  if (err instanceof HttpErrorResponse && err.status === 409 && action === 'delete') {
    return 'This partner has referrals. Pause the listing instead of deleting.';
  }
  if (err instanceof HttpErrorResponse && err.status === 400 && action === 'approve') {
    return 'Active partners require a listing summary.';
  }
  return `Could not ${action} this partner.`;
}

@Injectable({ providedIn: 'root' })
export class PartnerAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/partners`;

  list(
    category: PartnerCategory | 'all' = 'all',
    active: PartnerActiveFilter = 'all',
  ): Observable<{ partners: OpsPartner[] }> {
    return this.http.get<{ partners: OpsPartner[] }>(this.url, {
      params: partnerListParams(category, active),
      withCredentials: true,
    });
  }

  get(id: string): Observable<{ partner: OpsPartner }> {
    return this.http.get<{ partner: OpsPartner }>(`${this.url}/${id}`, { withCredentials: true });
  }

  create(body: PartnerDraft): Observable<{ partner: OpsPartner }> {
    return this.http.post<{ partner: OpsPartner }>(this.url, body, { withCredentials: true });
  }

  update(id: string, body: Partial<PartnerDraft>): Observable<{ partner: OpsPartner }> {
    return this.http.patch<{ partner: OpsPartner }>(`${this.url}/${id}`, body, {
      withCredentials: true,
    });
  }

  approve(id: string): Observable<{ partner: OpsPartner }> {
    return this.http.post<{ partner: OpsPartner }>(
      `${this.url}/${id}/approve`,
      {},
      {
        withCredentials: true,
      },
    );
  }

  pause(id: string): Observable<{ partner: OpsPartner }> {
    return this.http.post<{ partner: OpsPartner }>(
      `${this.url}/${id}/pause`,
      {},
      {
        withCredentials: true,
      },
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { withCredentials: true });
  }
}
