import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { signAccessToken } from '../src/auth/tokens.js';
import {
  collectReferralAnalytics,
  conversionRate,
  referralEventCounts,
} from '../src/partners/analytics.js';
import {
  applyReferralEvent,
  generateReferralCode,
  nextReferralStatus,
  trackedOutboundUrl,
} from '../src/partners/tracking.js';
import type { Provider, ReferralAnalytics, ReferralRow } from '../src/partners/types.js';

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

type ReferralPayload = {
  id: string;
  userId: string;
  providerId: string;
  referralCode: string;
  status: string;
  channel?: string;
  convertedAt?: string | null;
  metadata?: {
    clickKey?: string;
    clickCount?: number;
    leadCount?: number;
    bookingCount?: number;
    events?: Array<{ type: string; channel?: string }>;
  };
};

type TrackResponse = {
  referral: ReferralPayload;
  created: boolean;
  outboundUrl: string | null;
  redirectPath: string;
};

const adminHeaders = { 'x-admin-token': ADMIN_TOKEN };

async function signup(email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: {
      email,
      password: 'password12',
      displayName: 'Traveller',
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json() as { token: string; user: { id: string } };
}

async function createActivePartner(input?: {
  bookingUrl?: string | null;
  website?: string | null;
  name?: string;
  slug?: string;
  category?: 'transfers' | 'sim';
}) {
  const created = await app.inject({
    method: 'POST',
    url: '/admin/partners',
    headers: adminHeaders,
    payload: {
      name: input?.name ?? 'Grab Malaysia',
      slug: input?.slug ?? `grab-${Math.random().toString(36).slice(2, 10)}`,
      category: input?.category ?? 'transfers',
      isActive: true,
      website: input?.website === undefined ? 'https://www.grab.com/my/' : input.website,
      listing: {
        summary: 'Licensed e-hailing rides across Malaysia, including airport pickup.',
        bookingUrl: input?.bookingUrl === undefined ? 'https://www.grab.com/my/' : input.bookingUrl,
      },
    },
  });
  expect(created.statusCode).toBe(201);
  return created.json() as { partner: { id: string; listing?: { bookingUrl?: string } } };
}

describe('referral tracking helpers', () => {
  it('appends https tracking params and never follows http', () => {
    const tracked = trackedOutboundUrl('https://www.grab.com/my/', {
      referralCode: 'TC-ABC123',
      channel: 'arrival',
    });
    expect(tracked).toContain('https://www.grab.com/my/');
    expect(tracked).toContain('ref=TC-ABC123');
    expect(tracked).toContain('utm_medium=arrival');
    expect(tracked).toContain('utm_source=tourist-companion');
    expect(trackedOutboundUrl('http://example.com', { referralCode: 'TC-ABC123' })).toBeNull();
    expect(generateReferralCode()).toMatch(/^TC-[A-F0-9]{12}$/);
  });

  it('promotes pending to clicked, converts only on booking, and leaves expired in place', () => {
    expect(nextReferralStatus('pending', 'click')).toBe('clicked');
    expect(nextReferralStatus('clicked', 'lead')).toBe('clicked');
    expect(nextReferralStatus('clicked', 'booking')).toBe('converted');
    expect(nextReferralStatus('converted', 'click')).toBe('converted');
    expect(nextReferralStatus('expired', 'click')).toBe('expired');
    expect(nextReferralStatus('expired', 'booking')).toBe('converted');

    const row: ReferralRow = {
      id: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      tripId: null,
      providerId: '11111111-1111-4111-8111-111111111111',
      placeId: null,
      referralCode: 'DEMO-GRAB-001',
      status: 'pending',
      channel: 'arrival',
      itineraryItemId: null,
      convertedAt: null,
      metadata: { source: 'seed' },
    };
    const clicked = applyReferralEvent(row, 'click', {
      now: '2026-09-20T08:00:00.000Z',
      channel: 'arrival',
    });
    expect(clicked.status).toBe('clicked');
    expect(clicked.metadata.source).toBe('seed');
    expect(clicked.metadata.clickCount).toBe(1);
    expect(clicked.convertedAt).toBeNull();

    const booked = applyReferralEvent(clicked, 'booking', { now: '2026-09-20T09:00:00.000Z' });
    expect(booked.status).toBe('converted');
    expect(booked.convertedAt).toBe('2026-09-20T09:00:00.000Z');
  });
});

describe('referral analytics helpers', () => {
  const grab: Provider = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Grab Malaysia',
    slug: 'grab-malaysia',
    category: 'transfers',
    isActive: true,
  };
  const airalo: Provider = {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Airalo Malaysia',
    slug: 'airalo-malaysia',
    category: 'sim',
    isActive: true,
  };

  function row(overrides: Partial<ReferralRow> & Pick<ReferralRow, 'id' | 'providerId' | 'status'>): ReferralRow {
    return {
      userId: '33333333-3333-4333-8333-333333333333',
      tripId: null,
      placeId: null,
      referralCode: overrides.referralCode ?? `CODE-${overrides.id.slice(0, 8)}`,
      channel: overrides.channel ?? 'arrival',
      itineraryItemId: null,
      convertedAt: null,
      metadata: {},
      ...overrides,
    };
  }

  it('falls back from status when metadata counts are missing', () => {
    expect(referralEventCounts(row({ id: 'a', providerId: grab.id, status: 'pending' }))).toEqual({
      referrals: 1,
      clicks: 0,
      leads: 0,
      conversions: 0,
    });
    expect(referralEventCounts(row({ id: 'b', providerId: grab.id, status: 'clicked' }))).toEqual({
      referrals: 1,
      clicks: 1,
      leads: 0,
      conversions: 0,
    });
    expect(referralEventCounts(row({ id: 'c', providerId: grab.id, status: 'converted' }))).toEqual({
      referrals: 1,
      clicks: 1,
      leads: 0,
      conversions: 1,
    });
    expect(
      referralEventCounts(
        row({
          id: 'd',
          providerId: grab.id,
          status: 'clicked',
          metadata: { clickCount: 4, leadCount: 2, bookingCount: 0 },
        }),
      ),
    ).toEqual({ referrals: 1, clicks: 4, leads: 2, conversions: 0 });
    expect(
      referralEventCounts(
        row({
          id: 'e',
          providerId: grab.id,
          status: 'clicked',
          metadata: { leadCount: 1 },
        }),
      ),
    ).toEqual({ referrals: 1, clicks: 0, leads: 1, conversions: 0 });
    expect(conversionRate(1, 4)).toBe(0.25);
    expect(conversionRate(1, 0)).toBe(0);
  });

  it('rolls up partner performance and optional filters', () => {
    const referrals: ReferralRow[] = [
      row({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        providerId: grab.id,
        status: 'converted',
        channel: 'arrival',
        metadata: { clickCount: 3, leadCount: 1, bookingCount: 1 },
      }),
      row({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        providerId: airalo.id,
        status: 'clicked',
        channel: 'explore',
        metadata: { clickCount: 1, leadCount: 1 },
      }),
    ];
    const all = collectReferralAnalytics(referrals, [grab, airalo]);
    expect(all.totals).toMatchObject({
      referrals: 2,
      clicks: 4,
      leads: 2,
      conversions: 1,
      pending: 0,
      clicked: 1,
      converted: 1,
      expired: 0,
      conversionRate: 0.25,
    });
    expect(all.partners.map((partner) => partner.slug)).toEqual(['grab-malaysia', 'airalo-malaysia']);
    expect(all.partners[0]).toMatchObject({
      providerId: grab.id,
      clicks: 3,
      leads: 1,
      conversions: 1,
      conversionRate: 0.3333,
    });
    expect(all.channels.map((channel) => channel.channel)).toEqual(['arrival', 'explore']);

    const arrival = collectReferralAnalytics(referrals, [grab, airalo], { channel: 'arrival' });
    expect(arrival.totals.clicks).toBe(3);
    expect(arrival.partners).toHaveLength(1);

    const sims = collectReferralAnalytics(referrals, [grab, airalo], { category: 'sim' });
    expect(sims.partners.map((partner) => partner.slug)).toEqual(['airalo-malaysia']);

    const emptyPartner = collectReferralAnalytics(referrals, [grab, airalo], {
      providerId: airalo.id,
      channel: 'arrival',
    });
    expect(emptyPartner.totals.referrals).toBe(0);
    expect(emptyPartner.partners).toEqual([
      expect.objectContaining({
        providerId: airalo.id,
        referrals: 0,
        clicks: 0,
        leads: 0,
        conversions: 0,
        conversionRate: 0,
      }),
    ]);
  });
});

describe('referral tracking API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous clicks, leads, and listing', async () => {
    const click = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      payload: { providerId: '11111111-1111-4111-8111-111111111111', channel: 'arrival' },
    });
    expect(click.statusCode).toBe(401);

    const lead = await app.inject({
      method: 'POST',
      url: '/referrals/leads',
      payload: { providerId: '11111111-1111-4111-8111-111111111111', channel: 'arrival' },
    });
    expect(lead.statusCode).toBe(401);

    const list = await app.inject({ method: 'GET', url: '/referrals' });
    expect(list.statusCode).toBe(401);

    const go = await app.inject({
      method: 'GET',
      url: '/referrals/go/11111111-1111-4111-8111-111111111111?channel=arrival',
    });
    expect(go.statusCode).toBe(401);
  });

  it('records clicks with source placement, stays idempotent, and never self-converts', async () => {
    const session = await signup('referral-click@example.com');
    const headers = { authorization: `Bearer ${session.token}` };
    const { partner } = await createActivePartner();

    const missing = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: { providerId: '00000000-0000-4000-8000-000000000099', channel: 'arrival' },
    });
    expect(missing.statusCode).toBe(404);

    const invalidChannel = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: { providerId: partner.id, channel: 'seed' },
    });
    expect(invalidChannel.statusCode).toBe(400);

    const clicked = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: {
        providerId: partner.id,
        channel: 'arrival',
        clickKey: 'arrival-grab-klia',
      },
    });
    expect(clicked.statusCode).toBe(201);
    const first = clicked.json() as TrackResponse;
    expect(first.created).toBe(true);
    expect(first.referral.status).toBe('clicked');
    expect(first.referral.channel).toBe('arrival');
    expect(first.referral.userId).toBe(session.user.id);
    expect(first.referral.convertedAt).toBeNull();
    expect(first.referral.metadata?.clickKey).toBe('arrival-grab-klia');
    expect(first.referral.metadata?.clickCount).toBe(1);
    expect(first.outboundUrl).toMatch(/^https:\/\/www\.grab\.com\/my\//);
    expect(first.outboundUrl).toContain(`ref=${first.referral.referralCode}`);
    expect(first.outboundUrl).toContain('utm_medium=arrival');
    expect(first.redirectPath).toBe(`/r/${first.referral.referralCode}`);

    const replay = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: {
        providerId: partner.id,
        channel: 'arrival',
        clickKey: 'arrival-grab-klia',
      },
    });
    expect(replay.statusCode).toBe(200);
    const second = replay.json() as TrackResponse;
    expect(second.created).toBe(false);
    expect(second.referral.id).toBe(first.referral.id);
    expect(second.referral.status).toBe('clicked');
    expect(second.referral.metadata?.clickCount).toBe(2);

    const otherSurface = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: {
        providerId: partner.id,
        channel: 'itinerary',
        clickKey: 'plan-item-1',
      },
    });
    expect(otherSurface.statusCode).toBe(201);
    expect((otherSurface.json() as TrackResponse).referral.id).not.toBe(first.referral.id);
  });

  it('records leads against a click and can open a lead without a prior click', async () => {
    const session = await signup('referral-lead@example.com');
    const headers = { authorization: `Bearer ${session.token}` };
    const { partner } = await createActivePartner({ slug: `lead-${Math.random().toString(36).slice(2, 8)}` });

    const clicked = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: { providerId: partner.id, channel: 'explore' },
    });
    const clickBody = clicked.json() as TrackResponse;

    const lead = await app.inject({
      method: 'POST',
      url: '/referrals/leads',
      headers,
      payload: { referralId: clickBody.referral.id, channel: 'explore' },
    });
    expect(lead.statusCode).toBe(200);
    const leadBody = lead.json() as TrackResponse;
    expect(leadBody.referral.id).toBe(clickBody.referral.id);
    expect(leadBody.referral.status).toBe('clicked');
    expect(leadBody.referral.metadata?.leadCount).toBe(1);
    expect(leadBody.referral.metadata?.events?.some((event) => event.type === 'lead')).toBe(true);

    const opened = await app.inject({
      method: 'POST',
      url: '/referrals/leads',
      headers,
      payload: { providerId: partner.id, channel: 'concierge' },
    });
    expect(opened.statusCode).toBe(201);
    const openedBody = opened.json() as TrackResponse;
    expect(openedBody.referral.status).toBe('clicked');
    expect(openedBody.referral.channel).toBe('concierge');
    expect(openedBody.referral.metadata?.leadCount).toBe(1);
  });

  it('redirects outbound codes with tracking and records the click', async () => {
    const session = await signup('referral-redirect@example.com');
    const headers = { authorization: `Bearer ${session.token}` };
    const { partner } = await createActivePartner({
      slug: `go-${Math.random().toString(36).slice(2, 8)}`,
    });

    const created = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: { providerId: partner.id, channel: 'dashboard' },
    });
    const body = created.json() as TrackResponse;

    const redirected = await app.inject({
      method: 'GET',
      url: body.redirectPath,
    });
    expect(redirected.statusCode).toBe(302);
    expect(redirected.headers.location).toMatch(/^https:\/\/www\.grab\.com\/my\//);
    expect(String(redirected.headers.location)).toContain(`ref=${body.referral.referralCode}`);
    expect(String(redirected.headers.location)).toContain('utm_medium=dashboard');

    const missing = await app.inject({ method: 'GET', url: '/r/NOT-A-REAL-CODE' });
    expect(missing.statusCode).toBe(404);

    const go = await app.inject({
      method: 'GET',
      url: `/referrals/go/${partner.id}?channel=arrival&clickKey=go-arrival`,
      headers,
    });
    expect(go.statusCode).toBe(302);
    expect(String(go.headers.location)).toContain('utm_medium=arrival');
    expect(String(go.headers.location)).toMatch(/^https:\/\/www\.grab\.com\/my\//);
  });

  it('lets admins record partner-reported bookings and lists traveler referral status', async () => {
    const session = await signup('referral-booking@example.com');
    const headers = { authorization: `Bearer ${session.token}` };
    const { partner } = await createActivePartner({
      slug: `book-${Math.random().toString(36).slice(2, 8)}`,
    });

    const clicked = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: { providerId: partner.id, channel: 'itinerary' },
    });
    const clickBody = clicked.json() as TrackResponse;

    const touristBooking = await app.inject({
      method: 'POST',
      url: '/referrals/bookings',
      headers,
      payload: { referralId: clickBody.referral.id },
    });
    expect(touristBooking.statusCode).toBe(403);

    const converted = await app.inject({
      method: 'POST',
      url: '/referrals/bookings',
      headers: adminHeaders,
      payload: { referralCode: clickBody.referral.referralCode },
    });
    expect(converted.statusCode).toBe(200);
    const booking = converted.json() as { referral: ReferralPayload };
    expect(booking.referral.status).toBe('converted');
    expect(booking.referral.convertedAt).toMatch(/T/);
    expect(booking.referral.metadata?.bookingCount).toBe(1);

    const listed = await app.inject({ method: 'GET', url: '/referrals', headers });
    expect(listed.statusCode).toBe(200);
    const listBody = listed.json() as { referrals: ReferralPayload[] };
    expect(listBody.referrals.some((row) => row.id === clickBody.referral.id && row.status === 'converted')).toBe(
      true,
    );

    const other = await signup('referral-other@example.com');
    const otherList = await app.inject({
      method: 'GET',
      url: '/referrals',
      headers: { authorization: `Bearer ${other.token}` },
    });
    expect(
      (otherList.json() as { referrals: ReferralPayload[] }).referrals.some((row) => row.id === clickBody.referral.id),
    ).toBe(false);

    const paused = await app.inject({
      method: 'POST',
      url: `/admin/partners/${partner.id}/pause`,
      headers: adminHeaders,
    });
    expect(paused.statusCode).toBe(200);
    const afterPause = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: { providerId: partner.id, channel: 'itinerary', clickKey: 'after-pause' },
    });
    expect(afterPause.statusCode).toBe(404);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/admin/partners/${partner.id}`,
      headers: adminHeaders,
    });
    expect(removed.statusCode).toBe(409);

    const adminJwt = signAccessToken(
      {
        id: '00000000-0000-4000-8000-000000000099',
        email: 'ops@example.com',
        displayName: 'Ops',
        role: 'admin',
      },
      config,
    );
    const replayBooking = await app.inject({
      method: 'POST',
      url: '/referrals/bookings',
      headers: { authorization: `Bearer ${adminJwt}` },
      payload: { referralId: clickBody.referral.id },
    });
    expect(replayBooking.statusCode).toBe(200);
    expect((replayBooking.json() as { referral: ReferralPayload }).referral.status).toBe('converted');
  });

  it('records a click even when the partner has no outbound URL', async () => {
    const session = await signup('referral-nourl@example.com');
    const { partner } = await createActivePartner({
      slug: `plain-${Math.random().toString(36).slice(2, 8)}`,
      bookingUrl: null,
      website: null,
      name: 'Desk only',
    });

    const clicked = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers: { authorization: `Bearer ${session.token}` },
      payload: { providerId: partner.id, channel: 'arrival' },
    });
    expect(clicked.statusCode).toBe(201);
    const body = clicked.json() as TrackResponse;
    expect(body.outboundUrl).toBeNull();
    expect(body.referral.status).toBe('clicked');

    const redirected = await app.inject({ method: 'GET', url: body.redirectPath });
    expect(redirected.statusCode).toBe(404);

    const go = await app.inject({
      method: 'GET',
      url: `/referrals/go/${partner.id}?channel=arrival`,
      headers: { authorization: `Bearer ${session.token}` },
    });
    expect(go.statusCode).toBe(400);
  });

  it('rejects non-admin referral analytics', async () => {
    const missing = await app.inject({ method: 'GET', url: '/admin/referrals/analytics' });
    expect(missing.statusCode).toBe(401);

    const session = await signup('analytics-tourist@example.com');
    const tourist = await app.inject({
      method: 'GET',
      url: '/admin/referrals/analytics',
      headers: { authorization: `Bearer ${session.token}` },
    });
    expect(tourist.statusCode).toBe(403);

    const invalid = await app.inject({
      method: 'GET',
      url: '/admin/referrals/analytics?category=transport',
      headers: adminHeaders,
    });
    expect(invalid.statusCode).toBe(400);
  });

  it('reports clicks, leads, and partner performance for admins', async () => {
    const session = await signup('analytics-ops@example.com');
    const headers = { authorization: `Bearer ${session.token}` };
    const suffix = Math.random().toString(36).slice(2, 8);
    const { partner: grab } = await createActivePartner({
      name: 'Analytics Grab',
      slug: `analytics-grab-${suffix}`,
    });
    const { partner: airalo } = await createActivePartner({
      name: 'Analytics Airalo',
      slug: `analytics-airalo-${suffix}`,
      category: 'sim',
      website: 'https://www.airalo.com/',
      bookingUrl: 'https://www.airalo.com/',
    });
    const { partner: idle } = await createActivePartner({
      name: 'Analytics Idle',
      slug: `analytics-idle-${suffix}`,
    });

    const clicked = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: { providerId: grab.id, channel: 'arrival', clickKey: `analytics-grab-${suffix}` },
    });
    expect(clicked.statusCode).toBe(201);
    const clickBody = clicked.json() as TrackResponse;

    const replay = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: { providerId: grab.id, channel: 'arrival', clickKey: `analytics-grab-${suffix}` },
    });
    expect(replay.statusCode).toBe(200);

    const lead = await app.inject({
      method: 'POST',
      url: '/referrals/leads',
      headers,
      payload: { referralId: clickBody.referral.id, channel: 'arrival' },
    });
    expect(lead.statusCode).toBe(200);

    const booked = await app.inject({
      method: 'POST',
      url: '/referrals/bookings',
      headers: adminHeaders,
      payload: { referralId: clickBody.referral.id },
    });
    expect(booked.statusCode).toBe(200);

    const exploreClick = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers,
      payload: { providerId: airalo.id, channel: 'explore', clickKey: `analytics-airalo-${suffix}` },
    });
    expect(exploreClick.statusCode).toBe(201);

    const openedLead = await app.inject({
      method: 'POST',
      url: '/referrals/leads',
      headers,
      payload: { providerId: airalo.id, channel: 'concierge' },
    });
    expect(openedLead.statusCode).toBe(201);

    const grabReport = await app.inject({
      method: 'GET',
      url: `/admin/referrals/analytics?providerId=${grab.id}`,
      headers: adminHeaders,
    });
    expect(grabReport.statusCode).toBe(200);
    const grabAnalytics = (grabReport.json() as { analytics: ReferralAnalytics }).analytics;
    expect(grabAnalytics.totals).toMatchObject({
      referrals: 1,
      clicks: 2,
      leads: 1,
      conversions: 1,
      converted: 1,
      conversionRate: 0.5,
    });
    expect(grabAnalytics.partners).toEqual([
      expect.objectContaining({
        providerId: grab.id,
        name: 'Analytics Grab',
        slug: `analytics-grab-${suffix}`,
        category: 'transfers',
        clicks: 2,
        leads: 1,
        conversions: 1,
        conversionRate: 0.5,
      }),
    ]);
    expect(grabAnalytics.channels).toEqual([
      expect.objectContaining({ channel: 'arrival', clicks: 2, leads: 1, conversions: 1 }),
    ]);

    const simReport = await app.inject({
      method: 'GET',
      url: `/admin/referrals/analytics?category=sim&providerId=${airalo.id}`,
      headers: adminHeaders,
    });
    const simAnalytics = (simReport.json() as { analytics: ReferralAnalytics }).analytics;
    expect(simAnalytics.totals).toMatchObject({
      referrals: 2,
      clicks: 1,
      leads: 1,
      conversions: 0,
      clicked: 2,
      conversionRate: 0,
    });
    expect(simAnalytics.partners).toHaveLength(1);
    expect(simAnalytics.partners[0]).toMatchObject({
      providerId: airalo.id,
      category: 'sim',
      clicks: 1,
      leads: 1,
      conversions: 0,
    });

    const arrivalOnly = await app.inject({
      method: 'GET',
      url: `/admin/referrals/analytics?providerId=${grab.id}&channel=arrival`,
      headers: adminHeaders,
    });
    expect((arrivalOnly.json() as { analytics: ReferralAnalytics }).analytics.totals.clicks).toBe(2);

    const exploreOnly = await app.inject({
      method: 'GET',
      url: `/admin/referrals/analytics?providerId=${grab.id}&channel=explore`,
      headers: adminHeaders,
    });
    expect((exploreOnly.json() as { analytics: ReferralAnalytics }).analytics.totals.clicks).toBe(0);

    const idleReport = await app.inject({
      method: 'GET',
      url: `/admin/referrals/analytics?providerId=${idle.id}`,
      headers: adminHeaders,
    });
    const idleAnalytics = (idleReport.json() as { analytics: ReferralAnalytics }).analytics;
    expect(idleAnalytics.totals.referrals).toBe(0);
    expect(idleAnalytics.partners).toEqual([
      expect.objectContaining({ providerId: idle.id, clicks: 0, leads: 0, conversions: 0 }),
    ]);

    const adminJwt = signAccessToken(
      {
        id: '00000000-0000-4000-8000-000000000098',
        email: 'analytics-admin@example.com',
        displayName: 'Ops',
        role: 'admin',
      },
      config,
    );
    const viaJwt = await app.inject({
      method: 'GET',
      url: `/admin/referrals/analytics?providerId=${grab.id}`,
      headers: { authorization: `Bearer ${adminJwt}` },
    });
    expect(viaJwt.statusCode).toBe(200);
    expect((viaJwt.json() as { analytics: ReferralAnalytics }).analytics.totals.conversions).toBe(1);
  });
});
