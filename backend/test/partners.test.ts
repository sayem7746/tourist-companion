import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { signAccessToken } from '../src/auth/tokens.js';
import {
  applyPartnerPatch,
  defaultCommissionBasis,
  isCommissionBasis,
  isPartnerCategory,
  isReferralChannel,
  isReferralStatus,
  parseCommissionRate,
  slugifyPartnerName,
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
      convertedAt: null,
      metadata: { source: 'seed', clickCount: 1 },
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
      convertedAt: null,
      metadata: { source: 'seed', clickCount: 1 },
    });
    expect(isReferralStatus('pending')).toBe(true);
    expect(isReferralStatus('paid')).toBe(false);
    expect(isReferralChannel('dashboard')).toBe(true);
    expect(isReferralChannel('seed')).toBe(false);
  });

  it('slugifies names and defaults SIM commission basis', () => {
    expect(slugifyPartnerName('AirAsia Move KL')).toBe('airasia-move-kl');
    expect(defaultCommissionBasis('sim')).toBe('activation');
    expect(defaultCommissionBasis('hotels')).toBe('booking');
    const recategorized = applyPartnerPatch(grabRow, { category: 'tours' });
    expect(recategorized.category).toBe('tours');
  });
});

const ADMIN_TOKEN = 'test-only-admin-token';
const config = loadConfig({
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3000',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'test-only-insecure-jwt-secret',
  ADMIN_TOKEN,
});
const app = buildApp(config);

describe('partner admin CRUD', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const adminHeaders = { 'x-admin-token': ADMIN_TOKEN };

  it('rejects anonymous and tourist sessions', async () => {
    const missing = await app.inject({ method: 'GET', url: '/admin/partners' });
    expect(missing.statusCode).toBe(401);

    const tourist = signAccessToken(
      { id: '00000000-0000-4000-8000-000000000001', email: 'ada@example.com', displayName: 'Ada' },
      config,
    );
    const forbidden = await app.inject({
      method: 'GET',
      url: '/admin/partners',
      headers: { authorization: `Bearer ${tourist}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('creates, edits, categorizes, approves, pauses, and lists partners', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/admin/partners',
      headers: adminHeaders,
      payload: {
        name: 'CelcomDigi eSIM',
        category: 'tourist_services',
        website: 'https://www.celcomdigi.com/',
        contactEmail: 'partners@celcomdigi.example',
        listing: {
          summary: 'Airport prepaid SIM and eSIM packs after KLIA customs.',
          city: 'Sepang',
          connectivityKind: 'esim',
          passportRequired: true,
        },
        commission: { rate: 0.08 },
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as {
      partner: {
        id: string;
        slug: string;
        category: string;
        isActive: boolean;
        contactEmail?: string;
        commission?: { rate: number; basis: string; currency: string };
        listing?: { summary: string; connectivityKind?: string };
      };
    };
    expect(body.partner.slug).toBe('celcomdigi-esim');
    expect(body.partner.isActive).toBe(false);
    expect(body.partner.contactEmail).toBe('partners@celcomdigi.example');
    expect(body.partner.commission).toEqual({ rate: 0.08, basis: 'booking', currency: 'MYR' });
    expect(body.partner.listing?.connectivityKind).toBe('esim');

    const categorized = await app.inject({
      method: 'PATCH',
      url: `/admin/partners/${body.partner.id}`,
      headers: adminHeaders,
      payload: {
        category: 'sim',
        listing: { dataAllowance: '10 GB', validity: '10 days' },
        commission: { rate: 0.08, basis: 'activation' },
      },
    });
    expect(categorized.statusCode).toBe(200);
    expect(categorized.json()).toMatchObject({
      partner: {
        category: 'sim',
        commission: { basis: 'activation', rate: 0.08 },
        listing: { dataAllowance: '10 GB', connectivityKind: 'esim' },
      },
    });

    const approved = await app.inject({
      method: 'POST',
      url: `/admin/partners/${body.partner.id}/approve`,
      headers: adminHeaders,
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ partner: { isActive: true } });

    const listed = await app.inject({
      method: 'GET',
      url: '/admin/partners?category=sim&isActive=true',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(listed.statusCode).toBe(200);
    const listedBody = listed.json() as { partners: Array<{ id: string }> };
    expect(listedBody.partners.some((partner) => partner.id === body.partner.id)).toBe(true);

    const paused = await app.inject({
      method: 'POST',
      url: `/admin/partners/${body.partner.id}/pause`,
      headers: adminHeaders,
    });
    expect(paused.statusCode).toBe(200);
    expect(paused.json()).toMatchObject({ partner: { isActive: false } });

    const adminJwt = signAccessToken(
      {
        id: '00000000-0000-4000-8000-000000000099',
        email: 'ops@example.com',
        displayName: 'Ops',
        role: 'admin',
      },
      config,
    );
    const fetched = await app.inject({
      method: 'GET',
      url: `/admin/partners/${body.partner.id}`,
      headers: { authorization: `Bearer ${adminJwt}` },
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({ partner: { id: body.partner.id, isActive: false } });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/admin/partners',
      headers: adminHeaders,
      payload: { name: 'Other', slug: 'celcomdigi-esim', category: 'sim' },
    });
    expect(duplicate.statusCode).toBe(409);

    const httpUrl = await app.inject({
      method: 'POST',
      url: '/admin/partners',
      headers: adminHeaders,
      payload: { name: 'Bad Link', category: 'tours', website: 'http://example.com' },
    });
    expect(httpUrl.statusCode).toBe(400);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/admin/partners/${body.partner.id}`,
      headers: adminHeaders,
    });
    expect(removed.statusCode).toBe(204);
  });
});

