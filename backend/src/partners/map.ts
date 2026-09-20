import {
  COMMISSION_BASES,
  PARTNER_CATEGORIES,
  REFERRAL_CHANNELS,
  REFERRAL_DISCLOSURE,
  REFERRAL_STATUSES,
  type ArrivalAirportCode,
  type CommissionBasis,
  type CreatePartnerInput,
  type PartnerCategory,
  type PartnerListing,
  type Provider,
  type ProviderRow,
  type Referral,
  type ReferralChannel,
  type ReferralRow,
  type ReferralStatus,
  type UpdatePartnerInput,
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

export function slugifyPartnerName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!slug) {
    throw new Error('Unable to derive a slug from name');
  }
  return slug;
}

export function defaultCommissionBasis(category: PartnerCategory): CommissionBasis {
  return category === 'sim' ? 'activation' : 'booking';
}

function extrasFromListing(listing: Partial<PartnerListing>): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  for (const key of LISTING_EXTRA_KEYS) {
    if (!(key in listing) || listing[key] === undefined) continue;
    if (key === 'airportCodes') {
      const codes = listing.airportCodes;
      extras.airportCodes = Array.isArray(codes)
        ? codes.filter((code): code is ArrivalAirportCode => code === 'KUL' || code === 'KLIA2')
        : null;
      continue;
    }
    extras[key] = listing[key];
  }
  return extras;
}

function mergeListingExtras(
  current: Record<string, unknown> | null | undefined,
  listing: Partial<PartnerListing> | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(current ?? {}) };
  if (!listing) return merged;
  const incoming = extrasFromListing(listing);
  for (const [key, value] of Object.entries(incoming)) {
    if (value == null) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export function rowFromCreate(id: string, input: CreatePartnerInput): ProviderRow {
  const listing = input.listing;
  const category = input.category;
  const commission = input.commission;
  return {
    id,
    name: input.name,
    slug: input.slug,
    category,
    isActive: input.isActive ?? false,
    website: optionalText(input.website) ?? null,
    contactEmail: optionalText(input.contactEmail) ?? null,
    commissionRate: commission?.rate ?? 0,
    commissionBasis: commission?.basis ?? defaultCommissionBasis(category),
    commissionCurrency: 'MYR',
    listingSummary: listing.summary,
    listingCity: optionalText(listing.city) ?? null,
    listingArea: optionalText(listing.area) ?? null,
    bookingUrl: optionalText(listing.bookingUrl) ?? null,
    disclosure: listing.disclosure.trim() || REFERRAL_DISCLOSURE,
    sponsored: listing.sponsored,
    licenseName: optionalText(listing.licenseName) ?? null,
    licenseId: optionalText(listing.licenseId) ?? null,
    typicalMyr: optionalText(listing.typicalMyr) ?? null,
    languages: listing.languages ?? [],
    listingExtras: extrasFromListing(listing),
  };
}

export function applyPartnerPatch(row: ProviderRow, patch: UpdatePartnerInput): ProviderRow {
  const listing = patch.listing ?? {};
  const next: ProviderRow = {
    ...row,
    name: patch.name ?? row.name,
    slug: patch.slug ?? row.slug,
    category: patch.category ?? row.category,
    website: patch.website !== undefined ? (optionalText(patch.website) ?? null) : row.website,
    contactEmail:
      patch.contactEmail !== undefined
        ? (optionalText(patch.contactEmail) ?? null)
        : row.contactEmail,
    commissionRate:
      patch.commission?.rate !== undefined ? patch.commission.rate : row.commissionRate,
    commissionBasis: patch.commission?.basis ?? row.commissionBasis,
    listingSummary: listing.summary ?? row.listingSummary,
    listingCity:
      listing.city !== undefined ? (optionalText(listing.city) ?? null) : row.listingCity,
    listingArea:
      listing.area !== undefined ? (optionalText(listing.area) ?? null) : row.listingArea,
    bookingUrl:
      listing.bookingUrl !== undefined
        ? (optionalText(listing.bookingUrl) ?? null)
        : row.bookingUrl,
    disclosure: listing.disclosure !== undefined ? listing.disclosure.trim() : row.disclosure,
    sponsored: listing.sponsored ?? row.sponsored,
    licenseName:
      listing.licenseName !== undefined
        ? (optionalText(listing.licenseName) ?? null)
        : row.licenseName,
    licenseId:
      listing.licenseId !== undefined ? (optionalText(listing.licenseId) ?? null) : row.licenseId,
    typicalMyr:
      listing.typicalMyr !== undefined
        ? (optionalText(listing.typicalMyr) ?? null)
        : row.typicalMyr,
    languages: listing.languages ?? row.languages,
    listingExtras: mergeListingExtras(row.listingExtras, patch.listing),
  };
  if (!next.disclosure) {
    next.disclosure = REFERRAL_DISCLOSURE;
  }
  return next;
}
