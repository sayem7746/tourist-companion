import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/auth/password.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { loadConfig } from '../src/config.js';
import { buildOpsDashboard } from '../src/dashboard/snapshot.js';
import { createMetricsCollector } from '../src/observability/metrics.js';

const ADMIN_TOKEN = 'test-only-admin-token';
const config = loadConfig({
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3000',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'test-only-insecure-jwt-secret',
  ADMIN_TOKEN,
  CONCIERGE_RATE_LIMIT_MAX: '200',
});
const app = buildApp(config);

type DashboardBody = {
  dashboard: {
    users: number;
    trips: number;
    conciergeUsage: number;
    nearbySearches: number;
    referrals: number;
    errors: number;
    sources: {
      users: 'store' | 'metrics';
      trips: 'store' | 'metrics';
      conciergeUsage: 'store' | 'metrics';
      nearbySearches: 'store' | 'metrics';
      referrals: 'store' | 'metrics';
      errors: 'store' | 'metrics';
    };
  };
};

const validTrip = {
  destination: 'Penang',
  startDate: '2026-11-01',
  endDate: '2026-11-05',
  adultCount: 2,
  childCount: 0,
  interests: ['food'],
};

describe('ops dashboard snapshot', () => {
  it('prefers store counts and approximates the rest from in-process metrics', () => {
    const metrics = createMetricsCollector();
    metrics.record('POST', '/auth/signup', 201, 12);
    metrics.record('POST', '/trips', 201, 18);
    metrics.record('POST', '/concierge/chat', 200, 40);
    metrics.record('POST', '/concierge/chat', 200, 22);
    metrics.record('GET', '/places/nearby?category=food', 200, 30);
    metrics.record('POST', '/referrals/clicks', 201, 9);
    metrics.record('GET', '/missing', 404, 4);

    const approximated = buildOpsDashboard({ metrics: metrics.snapshot() });
    expect(approximated).toMatchObject({
      users: 1,
      trips: 1,
      conciergeUsage: 2,
      nearbySearches: 1,
      referrals: 1,
      errors: 1,
      sources: {
        users: 'metrics',
        trips: 'metrics',
        conciergeUsage: 'metrics',
        nearbySearches: 'metrics',
        referrals: 'metrics',
        errors: 'metrics',
      },
    });

    const stored = buildOpsDashboard({
      users: 8,
      trips: 0,
      referrals: 3,
      metrics: metrics.snapshot(),
    });
    expect(stored.users).toBe(8);
    expect(stored.trips).toBe(0);
    expect(stored.referrals).toBe(3);
    expect(stored.conciergeUsage).toBe(2);
    expect(stored.sources.users).toBe('store');
    expect(stored.sources.trips).toBe('store');
    expect(stored.sources.referrals).toBe('store');
  });
});

describe('GET /admin/dashboard', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous and tourist sessions', async () => {
    const missing = await app.inject({ method: 'GET', url: '/admin/dashboard' });
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
      url: '/admin/dashboard',
      headers: { authorization: `Bearer ${tourist}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('issues counts for an admin JWT and still accepts ADMIN_TOKEN', async () => {
    const isolated = buildApp(config);
    await isolated.ready();
    try {
      const store = isolated.getAuthStore();
      expect(store).toBeDefined();
      const passwordHash = await hashPassword('password12', 'test');
      await store!.createUser({
        email: 'ops-dashboard@example.com',
        displayName: 'Ops',
        passwordHash,
        role: 'admin',
      });

      const adminLogin = await isolated.inject({
        method: 'POST',
        url: '/auth/admin/login',
        payload: { email: 'ops-dashboard@example.com', password: 'password12' },
      });
      expect(adminLogin.statusCode).toBe(200);
      const { token } = adminLogin.json() as { token: string };

      const signup = await isolated.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          email: 'dash-traveller@example.com',
          password: 'password12',
          displayName: 'Traveller',
        },
      });
      expect(signup.statusCode).toBe(201);
      const touristToken = (signup.json() as { token: string }).token;
      const touristHeaders = { authorization: `Bearer ${touristToken}` };

      const trip = await isolated.inject({
        method: 'POST',
        url: '/trips',
        headers: touristHeaders,
        payload: validTrip,
      });
      expect(trip.statusCode).toBe(201);

      const chat = await isolated.inject({
        method: 'POST',
        url: '/concierge/chat',
        payload: { message: 'Where can I eat near KLCC?' },
      });
      expect(chat.statusCode).toBe(200);

      const nearby = await isolated.inject({
        method: 'GET',
        url: '/places/nearby?category=food',
      });
      expect(nearby.statusCode).toBe(200);

      const partner = await isolated.inject({
        method: 'POST',
        url: '/admin/partners',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Dashboard Grab',
          category: 'transfers',
          isActive: true,
          website: 'https://example.com/grab',
          listing: {
            summary: 'Airport rides for dashboard tests.',
            bookingUrl: 'https://example.com/book',
          },
        },
      });
      expect(partner.statusCode).toBe(201);
      const partnerId = (partner.json() as { partner: { id: string } }).partner.id;

      const click = await isolated.inject({
        method: 'POST',
        url: '/referrals/clicks',
        headers: touristHeaders,
        payload: { providerId: partnerId, channel: 'dashboard' },
      });
      expect(click.statusCode).toBe(201);

      const missing = await isolated.inject({ method: 'GET', url: '/no-such-ops-route' });
      expect(missing.statusCode).toBe(404);

      const viaJwt = await isolated.inject({
        method: 'GET',
        url: '/admin/dashboard',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(viaJwt.statusCode).toBe(200);
      const body = viaJwt.json() as DashboardBody;
      expect(body.dashboard.users).toBe(2);
      expect(body.dashboard.trips).toBe(1);
      expect(body.dashboard.conciergeUsage).toBe(1);
      expect(body.dashboard.nearbySearches).toBe(1);
      expect(body.dashboard.referrals).toBe(1);
      expect(body.dashboard.errors).toBeGreaterThanOrEqual(1);
      expect(body.dashboard.sources).toEqual({
        users: 'store',
        trips: 'store',
        conciergeUsage: 'metrics',
        nearbySearches: 'metrics',
        referrals: 'store',
        errors: 'metrics',
      });

      const viaHeader = await isolated.inject({
        method: 'GET',
        url: '/admin/dashboard',
        headers: { 'x-admin-token': ADMIN_TOKEN },
      });
      expect(viaHeader.statusCode).toBe(200);
      expect((viaHeader.json() as DashboardBody).dashboard.users).toBe(2);
    } finally {
      await isolated.close();
    }
  });
});
