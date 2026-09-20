import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/auth/password.js';
import { loadConfig } from '../src/config.js';

const FRONTEND_ORIGIN = 'http://localhost:4200';
const UNKNOWN_ORIGIN = 'https://evil.example';
const ADMIN_TOKEN = 'test-only-admin-token';

const config = loadConfig({
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3000',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'test-only-insecure-jwt-secret',
  ADMIN_TOKEN,
  FRONTEND_ORIGIN,
  CONCIERGE_RATE_LIMIT_MAX: '200',
});
const app = buildApp(config);

const validTrip = {
  destination: 'Kuala Lumpur',
  startDate: '2026-09-21',
  endDate: '2026-09-24',
  adultCount: 2,
  childCount: 0,
  interests: ['food', 'culture'],
  status: 'active',
};

function setCookieHeader(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  const first = Array.isArray(raw) ? raw[0] : raw;
  expect(first).toBeTruthy();
  return String(first);
}

function sessionCookie(response: { headers: Record<string, unknown> }): string {
  const cookie = setCookieHeader(response);
  expect(cookie).toContain('tc_access=');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Path=/');
  expect(cookie).toContain('SameSite=Lax');
  expect(cookie).not.toMatch(/;\s*Secure\b/i);
  return cookie.split(';')[0]!;
}

function originHeaders(origin: string, extra: Record<string, string> = {}) {
  return { origin, ...extra };
}

describe('CORS and cookie credentials', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reflects FRONTEND_ORIGIN with credentials and rejects unknown origins', async () => {
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/auth/login',
      headers: originHeaders(FRONTEND_ORIGIN, {
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      }),
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
    expect(String(preflight.headers['access-control-allow-methods'])).toMatch(/POST/);
    expect(String(preflight.headers['access-control-allow-headers'])).toMatch(/Content-Type/i);
    expect(String(preflight.headers['access-control-allow-headers'])).toMatch(/Authorization/i);
    expect(preflight.headers['access-control-expose-headers']).toBe('X-Request-Id');

    const nearby = await app.inject({
      method: 'GET',
      url: '/places/nearby?category=food',
      headers: originHeaders(FRONTEND_ORIGIN),
    });
    expect(nearby.statusCode).toBe(200);
    expect(nearby.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN);
    expect(nearby.headers['access-control-allow-credentials']).toBe('true');
    expect((nearby.json() as { places: unknown[] }).places.length).toBeGreaterThan(0);

    const unknown = await app.inject({
      method: 'OPTIONS',
      url: '/trips',
      headers: originHeaders(UNKNOWN_ORIGIN, {
        'access-control-request-method': 'GET',
      }),
    });
    expect(unknown.statusCode).toBe(204);
    expect(unknown.headers['access-control-allow-origin']).toBeUndefined();
    expect(unknown.headers['access-control-allow-credentials']).toBeUndefined();

    const unknownGet = await app.inject({
      method: 'GET',
      url: '/places/nearby',
      headers: originHeaders(UNKNOWN_ORIGIN),
    });
    expect(unknownGet.statusCode).toBe(200);
    expect(unknownGet.headers['access-control-allow-origin']).toBeUndefined();
    expect(unknownGet.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('authenticates traveler APIs with the SPA session cookie, not Bearer', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: originHeaders(FRONTEND_ORIGIN),
      payload: {
        email: 'cookie-traveller@example.com',
        password: 'password12',
        displayName: 'Cookie Traveller',
      },
    });
    expect(signup.statusCode).toBe(201);
    expect(signup.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN);
    const cookie = sessionCookie(signup);
    const credentials = originHeaders(FRONTEND_ORIGIN, { cookie });

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: credentials,
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      user: { email: 'cookie-traveller@example.com', role: 'tourist' },
    });

    const createdTrip = await app.inject({
      method: 'POST',
      url: '/trips',
      headers: credentials,
      payload: validTrip,
    });
    expect(createdTrip.statusCode).toBe(201);
    const tripId = (createdTrip.json() as { trip: { id: string } }).trip.id;

    const listed = await app.inject({
      method: 'GET',
      url: '/trips',
      headers: credentials,
    });
    expect(listed.statusCode).toBe(200);
    expect((listed.json() as { trips: Array<{ id: string }> }).trips.some((trip) => trip.id === tripId)).toBe(
      true,
    );

    const generated = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/generate`,
      headers: credentials,
      payload: {},
    });
    expect(generated.statusCode).toBe(200);
    expect(
      (generated.json() as { itinerary: { days: unknown[] } }).itinerary.days.length,
    ).toBeGreaterThan(0);

    const bookmark = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/places`,
      headers: credentials,
      payload: { placeId: 'my-food-madam-kwan' },
    });
    expect(bookmark.statusCode).toBe(201);

    const chat = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers: credentials,
      payload: { message: 'How to ride the LRT?', tripId },
    });
    expect(chat.statusCode).toBe(200);
    expect((chat.json() as { persisted: boolean }).persisted).toBe(true);

    const history = await app.inject({
      method: 'GET',
      url: `/concierge/history?tripId=${tripId}`,
      headers: credentials,
    });
    expect(history.statusCode).toBe(200);
    expect((history.json() as { messages: unknown[] }).messages.length).toBeGreaterThan(0);

    const adminStore = app.getAuthStore();
    expect(adminStore).toBeDefined();
    await adminStore!.createUser({
      email: 'cookie-ops@example.com',
      displayName: 'Cookie Ops',
      passwordHash: await hashPassword('password12', 'test'),
      role: 'admin',
    });
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/admin/login',
      headers: originHeaders(FRONTEND_ORIGIN),
      payload: { email: 'cookie-ops@example.com', password: 'password12' },
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminCookie = sessionCookie(adminLogin);
    const adminCredentials = originHeaders(FRONTEND_ORIGIN, { cookie: adminCookie });

    const partner = await app.inject({
      method: 'POST',
      url: '/admin/partners',
      headers: adminCredentials,
      payload: {
        name: 'Cookie Grab',
        category: 'transfers',
        isActive: true,
        website: 'https://www.grab.com/my/',
        listing: {
          summary: 'Airport rides for cookie-session tests.',
          bookingUrl: 'https://www.grab.com/my/',
        },
      },
    });
    expect(partner.statusCode).toBe(201);
    const partnerId = (partner.json() as { partner: { id: string } }).partner.id;

    const click = await app.inject({
      method: 'POST',
      url: '/referrals/clicks',
      headers: credentials,
      payload: { providerId: partnerId, channel: 'explore' },
    });
    expect(click.statusCode).toBe(201);
    expect((click.json() as { referral: { status: string } }).referral.status).toBe('clicked');

    const dashboard = await app.inject({
      method: 'GET',
      url: '/admin/dashboard',
      headers: adminCredentials,
    });
    expect(dashboard.statusCode).toBe(200);
    expect((dashboard.json() as { dashboard: { users: number } }).dashboard.users).toBeGreaterThanOrEqual(2);

    const touristAdmin = await app.inject({
      method: 'GET',
      url: '/admin/dashboard',
      headers: credentials,
    });
    expect(touristAdmin.statusCode).toBe(403);

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: credentials,
    });
    expect(logout.statusCode).toBe(200);
    expect(setCookieHeader(logout)).toContain('Max-Age=0');

    const afterLogout = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: originHeaders(FRONTEND_ORIGIN),
    });
    expect(afterLogout.statusCode).toBe(401);
  });
});
