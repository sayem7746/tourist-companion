import {
  COMMISSION_BASES,
  PARTNER_CATEGORIES,
  REFERRAL_CHANNELS,
  REFERRAL_DISCLOSURE,
  REFERRAL_STATUSES,
  type ArrivalAirportCode,
  type CommissionBasis,
  type PartnerCategory,
  type PartnerListing,
  type Provider,
  type ProviderRow,
  type Referral,
  type ReferralChannel,
  type ReferralRow,
  type ReferralStatus,
} from './types.js';

const LISTING_EXTRA_KEYS = [
  'hotelClassHint',
  'vehicleClass',
  'airportCodes',
  'meetAndGreet',
  'durationHint',
  'meetingPoint',
  'connectivityKind',
  'dataAllowance',
  'validity',
  'passportRequired',
  'halal',
  'reservationUrl',
  'deskHours',
] as const;

export function isPartnerCategory(value: string): value is PartnerCategory {
  return (PARTNER_CATEGORIES as readonly string[]).includes(value);
}

export function isReferralStatus(value: string): value is ReferralStatus {
  return (REFERRAL_STATUSES as readonly string[]).includes(value);
}

export function isReferralChannel(value: string): value is ReferralChannel {
  return (REFERRAL_CHANNELS as readonly string[]).includes(value);
}

export function isCommissionBasis(value: string): value is CommissionBasis {
  return (COMMISSION_BASES as readonly string[]).includes(value);
}

export function parseCommissionRate(value: string | number): number {
  const rate = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error('commission_rate must be between 0 and 1 inclusive');
  }
  return rate;
}

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function extrasListing(extras: Record<string, unknown> | null | undefined): Partial<PartnerListing> {
  if (!extras) return {};
  const listing: Partial<PartnerListing> = {};
  for (const key of LISTING_EXTRA_KEYS) {
    if (!(key in extras) || extras[key] === undefined) continue;
    if (key === 'airportCodes') {
      const codes = extras[key];
      if (Array.isArray(codes)) {
        listing.airportCodes = codes.filter(
          (code): code is ArrivalAirportCode => code === 'KUL' || code === 'KLIA2',
        );
      }
      continue;
    }
    (listing as Record<string, unknown>)[key] = extras[key];
  }
  return listing;
}

export function toPartnerListing(row: ProviderRow): PartnerListing {
  return {
    summary: row.listingSummary,
    city: optionalText(row.listingCity),
    area: optionalText(row.listingArea),
    bookingUrl: optionalText(row.bookingUrl),
    disclosure: row.disclosure.trim() || REFERRAL_DISCLOSURE,
    sponsored: row.sponsored,
    licenseName: optionalText(row.licenseName),
    licenseId: optionalText(row.licenseId),
    typicalMyr: optionalText(row.typicalMyr),
    languages: row.languages ?? [],
    ...extrasListing(row.listingExtras),
  };
}

export function toTouristProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    isActive: row.isActive,
    website: optionalText(row.website),
    listing: toPartnerListing(row),
  };
}

export function toOpsProvider(row: ProviderRow): Provider {
  return {
    ...toTouristProvider(row),
    contactEmail: optionalText(row.contactEmail),
    commission: {
      rate: parseCommissionRate(row.commissionRate),
      currency: 'MYR',
      basis: row.commissionBasis,
    },
  };
}

export function toReferral(row: ReferralRow): Referral {
  return {
    id: row.id,
    userId: row.userId,
    tripId: row.tripId ?? undefined,
    providerId: row.providerId,
    placeId: row.placeId ?? undefined,
    referralCode: row.referralCode,
    status: row.status,
    channel: row.channel ?? undefined,
    itineraryItemId: row.itineraryItemId,
  };
}
