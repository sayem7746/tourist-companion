import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { signAccessToken } from '../src/auth/tokens.js';
import {
  applyReferralEvent,
  generateReferralCode,
  nextReferralStatus,
  trackedOutboundUrl,
} from '../src/partners/tracking.js';
import type { ReferralRow } from '../src/partners/types.js';

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
}) {
  const created = await app.inject({
    method: 'POST',
    url: '/admin/partners',
    headers: adminHeaders,
    payload: {
      name: input?.name ?? 'Grab Malaysia',
      slug: input?.slug ?? `grab-${Math.random().toString(36).slice(2, 10)}`,
      category: 'transfers',
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
});
