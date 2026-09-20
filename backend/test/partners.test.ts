import { describe, expect, it } from 'vitest';
import {
  isCommissionBasis,
  isPartnerCategory,
  isReferralChannel,
  isReferralStatus,
  parseCommissionRate,
  toOpsProvider,
  toReferral,
  toTouristProvider,
} from '../src/partners/map.js';
import { REFERRAL_DISCLOSURE, type ProviderRow, type ReferralRow } from '../src/partners/types.js';

const grabRow: ProviderRow = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Grab Malaysia',
  slug: 'grab-malaysia',
  category: 'transfers',
  isActive: true,
  website: 'https://www.grab.com/my/',
  contactEmail: 'partners@example.com',
  commissionRate: '0.0500',
  commissionBasis: 'booking',
  commissionCurrency: 'MYR',
  listingSummary: 'Licensed e-hailing rides across Malaysia, including airport pickup at KLIA and KLIA2.',
  listingCity: 'Kuala Lumpur',
  listingArea: 'KLIA / KLIA2',
  bookingUrl: 'https://www.grab.com/my/',
  disclosure: REFERRAL_DISCLOSURE,
  sponsored: false,
  licenseName: null,
  licenseId: null,
  typicalMyr: 'RM 65–85',
  languages: ['en', 'ms'],
  listingExtras: {
    vehicleClass: 'car',
    airportCodes: ['KUL', 'KLIA2', 'ignored'],
    meetAndGreet: false,
  },
};

describe('partner marketplace model', () => {
  it('accepts the six MVP partner categories and rejects legacy ids', () => {
    expect(isPartnerCategory('hotels')).toBe(true);
    expect(isPartnerCategory('transfers')).toBe(true);
    expect(isPartnerCategory('tours')).toBe(true);
    expect(isPartnerCategory('sim')).toBe(true);
    expect(isPartnerCategory('restaurants')).toBe(true);
    expect(isPartnerCategory('tourist_services')).toBe(true);
    expect(isPartnerCategory('transport')).toBe(false);
    expect(isPartnerCategory('lodging')).toBe(false);
    expect(isPartnerCategory('insurance')).toBe(false);
  });

  it('omits ops contact and commission from tourist provider views', () => {
    const tourist = toTouristProvider(grabRow);
    expect(tourist.contactEmail).toBeUndefined();
    expect(tourist.commission).toBeUndefined();
    expect(tourist.listing?.disclosure).toBe(REFERRAL_DISCLOSURE);
    expect(tourist.listing?.sponsored).toBe(false);
    expect(tourist.listing?.city).toBe('Kuala Lumpur');
    expect(tourist.listing?.vehicleClass).toBe('car');
    expect(tourist.listing?.airportCodes).toEqual(['KUL', 'KLIA2']);
    expect(tourist.listing?.meetAndGreet).toBe(false);
    expect(tourist.website).toBe('https://www.grab.com/my/');
  });

  it('includes contact and commission on ops provider views', () => {
    const ops = toOpsProvider(grabRow);
    expect(ops.contactEmail).toBe('partners@example.com');
    expect(ops.commission).toEqual({
      rate: 0.05,
      currency: 'MYR',
      basis: 'booking',
    });
  });

  it('rejects commission rates outside 0–1', () => {
    expect(() => parseCommissionRate(1.01)).toThrow(/commission_rate/);
    expect(() => parseCommissionRate(-0.1)).toThrow(/commission_rate/);
    expect(parseCommissionRate(0)).toBe(0);
    expect(parseCommissionRate(1)).toBe(1);
    expect(isCommissionBasis('activation')).toBe(true);
    expect(isCommissionBasis('cpa')).toBe(false);
  });

  it('maps referral tracking and status fields', () => {
    const row: ReferralRow = {
      id: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      tripId: '44444444-4444-4444-8444-444444444444',
      providerId: grabRow.id,
      placeId: null,
      referralCode: 'DEMO-GRAB-001',
      status: 'clicked',
      channel: 'arrival',
      itineraryItemId: null,
    };
    expect(toReferral(row)).toEqual({
      id: row.id,
      userId: row.userId,
      tripId: row.tripId,
      providerId: grabRow.id,
      placeId: undefined,
      referralCode: 'DEMO-GRAB-001',
      status: 'clicked',
      channel: 'arrival',
      itineraryItemId: null,
    });
    expect(isReferralStatus('pending')).toBe(true);
    expect(isReferralStatus('paid')).toBe(false);
    expect(isReferralChannel('dashboard')).toBe(true);
    expect(isReferralChannel('seed')).toBe(false);
  });
});
