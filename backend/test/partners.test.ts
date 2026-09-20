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
  toPublicPartnerList,
  toPublicProvider,
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

  it('strips ops fields on public partner lists and ranks sponsored first', () => {
    const sponsored: ProviderRow = {
      ...grabRow,
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Klook Malaysia',
      slug: 'klook-malaysia',
      category: 'tours',
      sponsored: true,
      listingCity: 'Kuala Lumpur',
      listingArea: 'KLCC',
      listingExtras: { durationHint: 'Half day' },
    };
    const publicGrab = toPublicProvider(toOpsProvider(grabRow));
    expect(publicGrab.contactEmail).toBeUndefined();
    expect(publicGrab.commission).toBeUndefined();
    expect(publicGrab.listing?.sponsored).toBe(false);

    const ranked = toPublicPartnerList([toOpsProvider(grabRow), toOpsProvider(sponsored)]);
    expect(ranked.map((partner) => partner.slug)).toEqual(['klook-malaysia', 'grab-malaysia']);

    const city = toPublicPartnerList([toOpsProvider(grabRow)], { city: 'Kuala' });
    expect(city).toHaveLength(1);
    const airport = toPublicPartnerList([toOpsProvider(grabRow)], { airport: 'KUL' });
    expect(airport).toHaveLength(1);
    const otherCity = toPublicPartnerList([toOpsProvider(grabRow)], { city: 'Penang' });
    expect(otherCity).toHaveLength(0);
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

describe('partner admin CRUD and public listing', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const adminHeaders = { 'x-admin-token': ADMIN_TOKEN };

  async function createListedPartner(input: {
    name: string;
    slug: string;
    category: 'hotels' | 'transfers' | 'tours' | 'sim' | 'restaurants' | 'tourist_services';
    isActive?: boolean;
    sponsored?: boolean;
    city?: string;
    area?: string;
    airportCodes?: Array<'KUL' | 'KLIA2'>;
  }) {
    const created = await app.inject({
      method: 'POST',
      url: '/admin/partners',
      headers: adminHeaders,
      payload: {
        name: input.name,
        slug: input.slug,
        category: input.category,
        isActive: input.isActive ?? true,
        website: 'https://example.com/partner',
        contactEmail: 'ops@example.com',
        listing: {
          summary: `${input.name} listing for travelers.`,
          city: input.city ?? 'Kuala Lumpur',
          area: input.area,
          bookingUrl: 'https://example.com/book',
          sponsored: input.sponsored ?? false,
          airportCodes: input.airportCodes,
        },
        commission: { rate: 0.1 },
      },
    });
    expect(created.statusCode).toBe(201);
    return created.json() as {
      partner: { id: string; slug: string; contactEmail?: string; commission?: unknown };
    };
  }

  it('rejects anonymous and tourist sessions', async () => {
    const missing = await app.inject({ method: 'GET', url: '/admin/partners' });
    expect(missing.statusCode).toBe(401);

    const tourist = signAccessToken(
      {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'ada@example.com',
        displayName: 'Ada',
        role: 'tourist',
      },
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

  it('lists active tourist partners without contact or commission', async () => {
    const slug = `public-${Math.random().toString(36).slice(2, 8)}`;
    const { partner } = await createListedPartner({
      name: 'Klook Malaysia',
      slug,
      category: 'tours',
      sponsored: true,
      city: 'Kuala Lumpur',
      area: 'KLCC',
    });
    const pausedSlug = `paused-${Math.random().toString(36).slice(2, 8)}`;
    await createListedPartner({
      name: 'Paused Desk',
      slug: pausedSlug,
      category: 'tourist_services',
      isActive: false,
    });

    const listed = await app.inject({ method: 'GET', url: '/partners' });
    expect(listed.statusCode).toBe(200);
    const body = listed.json() as {
      partners: Array<{
        id: string;
        slug: string;
        contactEmail?: string;
        commission?: unknown;
        listing?: { sponsored?: boolean; disclosure?: string };
      }>;
    };
    const found = body.partners.find((row) => row.id === partner.id);
    expect(found).toBeTruthy();
    expect(found?.listing?.sponsored).toBe(true);
    expect(found?.listing?.disclosure).toBe(REFERRAL_DISCLOSURE);
    expect(found?.contactEmail).toBeUndefined();
    expect(found?.commission).toBeUndefined();
    expect(body.partners.some((row) => row.slug === pausedSlug)).toBe(false);
    expect(JSON.stringify(body)).not.toContain('ops@example.com');
    expect(JSON.stringify(body)).not.toContain('"rate"');

    const filtered = await app.inject({ method: 'GET', url: '/partners?category=tours&city=Kuala' });
    expect(filtered.statusCode).toBe(200);
    const filteredBody = filtered.json() as { partners: Array<{ id: string }> };
    expect(filteredBody.partners.some((row) => row.id === partner.id)).toBe(true);

    const fetched = await app.inject({ method: 'GET', url: `/partners/${partner.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({
      partner: { id: partner.id, slug, listing: { sponsored: true } },
    });
    expect(fetched.json().partner.contactEmail).toBeUndefined();
    expect(fetched.json().partner.commission).toBeUndefined();
  });

  it('filters airport-coded partners and hides paused rows on GET /partners/:id', async () => {
    const slug = `air-${Math.random().toString(36).slice(2, 8)}`;
    const { partner } = await createListedPartner({
      name: 'Grab Airport',
      slug,
      category: 'transfers',
      airportCodes: ['KUL'],
      area: 'KLIA / KLIA2',
    });

    const kul = await app.inject({ method: 'GET', url: '/partners?category=transfers&airport=KUL' });
    expect(kul.statusCode).toBe(200);
    expect(kul.json().partners.some((row: { id: string }) => row.id === partner.id)).toBe(true);

    await app.inject({
      method: 'POST',
      url: `/admin/partners/${partner.id}/pause`,
      headers: adminHeaders,
    });
    const hidden = await app.inject({ method: 'GET', url: `/partners/${partner.id}` });
    expect(hidden.statusCode).toBe(404);
  });
});

