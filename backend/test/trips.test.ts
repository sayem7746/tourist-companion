import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const app = buildApp(
  loadConfig({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-only-insecure-jwt-secret',
  }),
);

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
  return (response.json() as { token: string }).token;
}

const validTrip = {
  destination: 'Penang',
  startDate: '2026-11-01',
  endDate: '2026-11-05',
  adultCount: 2,
  childCount: 1,
  interests: ['food', 'culture'],
  dailyBudget: 'medium',
  travelStyle: 'balanced',
  accommodationName: 'Georgetown Inn',
  arrivalAirport: 'PEN',
  arrivalFlight: 'MH123',
  arrivalAt: '2026-11-01T08:30:00.000Z',
};

describe('trip endpoints', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    const list = await app.inject({ method: 'GET', url: '/trips' });
    expect(list.statusCode).toBe(401);

    const create = await app.inject({
      method: 'POST',
      url: '/trips',
      payload: validTrip,
    });
    expect(create.statusCode).toBe(401);
  });

  it('creates, lists, reads, updates, and deletes a trip', async () => {
    const token = await signup('trips@example.com');
    const headers = { authorization: `Bearer ${token}` };

    const created = await app.inject({
      method: 'POST',
      url: '/trips',
      headers,
      payload: validTrip,
    });
    expect(created.statusCode).toBe(201);
    const trip = (created.json() as { trip: { id: string; childCount: number; status: string } })
      .trip;
    expect(trip.status).toBe('draft');
    expect(trip.childCount).toBe(1);
    expect(created.json()).toMatchObject({
      trip: {
        destination: 'Penang',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        adultCount: 2,
        interests: ['food', 'culture'],
        dailyBudget: 'medium',
        travelStyle: 'balanced',
        accommodationName: 'Georgetown Inn',
        arrivalAirport: 'PEN',
        arrivalFlight: 'MH123',
        arrivalAt: '2026-11-01T08:30:00.000Z',
      },
    });

    const listed = await app.inject({ method: 'GET', url: '/trips', headers });
    expect(listed.statusCode).toBe(200);
    expect((listed.json() as { trips: unknown[] }).trips).toHaveLength(1);

    const fetched = await app.inject({
      method: 'GET',
      url: `/trips/${trip.id}`,
      headers,
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({ trip: { id: trip.id, destination: 'Penang' } });

    const patched = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}`,
      headers,
      payload: { destination: 'Langkawi', dailyBudget: 'high', childCount: 0 },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      trip: { destination: 'Langkawi', dailyBudget: 'high', childCount: 0, adultCount: 2 },
    });

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/trips/${trip.id}`,
      headers,
    });
    expect(deleted.statusCode).toBe(204);

    const missing = await app.inject({
      method: 'GET',
      url: `/trips/${trip.id}`,
      headers,
    });
    expect(missing.statusCode).toBe(404);
  });

  it('defaults childCount to 0 and isolates trips per user', async () => {
    const tokenA = await signup('owner@example.com');
    const tokenB = await signup('other@example.com');

    const created = await app.inject({
      method: 'POST',
      url: '/trips',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        destination: 'Malacca',
        startDate: '2026-12-01',
        endDate: '2026-12-04',
        adultCount: 1,
        interests: ['history' as never],
      },
    });
    expect(created.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'POST',
      url: '/trips',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        destination: 'Malacca',
        startDate: '2026-12-01',
        endDate: '2026-12-04',
        adultCount: 1,
        interests: ['culture'],
      },
    });
    expect(ok.statusCode).toBe(201);
    const trip = (ok.json() as { trip: { id: string; childCount: number } }).trip;
    expect(trip.childCount).toBe(0);

    const otherList = await app.inject({
      method: 'GET',
      url: '/trips',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect((otherList.json() as { trips: unknown[] }).trips).toHaveLength(0);

    const stolen = await app.inject({
      method: 'GET',
      url: `/trips/${trip.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(stolen.statusCode).toBe(404);
  });

  it('rejects invalid dates, empty interests, and empty patches', async () => {
    const token = await signup('invalid-trip@example.com');
    const headers = { authorization: `Bearer ${token}` };

    const dates = await app.inject({
      method: 'POST',
      url: '/trips',
      headers,
      payload: { ...validTrip, endDate: '2026-11-01' },
    });
    expect(dates.statusCode).toBe(400);

    const interests = await app.inject({
      method: 'POST',
      url: '/trips',
      headers,
      payload: { ...validTrip, interests: [] },
    });
    expect(interests.statusCode).toBe(400);

    const created = await app.inject({
      method: 'POST',
      url: '/trips',
      headers,
      payload: validTrip,
    });
    const tripId = (created.json() as { trip: { id: string } }).trip.id;

    const emptyPatch = await app.inject({
      method: 'PATCH',
      url: `/trips/${tripId}`,
      headers,
      payload: {},
    });
    expect(emptyPatch.statusCode).toBe(400);

    const datePatch = await app.inject({
      method: 'PATCH',
      url: `/trips/${tripId}`,
      headers,
      payload: { endDate: '2026-10-01' },
    });
    expect(datePatch.statusCode).toBe(400);
  });
});
