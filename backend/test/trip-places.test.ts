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

async function createTrip(token: string) {
  const created = await app.inject({
    method: 'POST',
    url: '/trips',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      destination: 'Kuala Lumpur',
      startDate: '2026-11-01',
      endDate: '2026-11-08',
      adultCount: 2,
      interests: ['food', 'culture'],
    },
  });
  expect(created.statusCode).toBe(201);
  return (created.json() as { trip: { id: string } }).trip.id;
}

describe('trip place favorites', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    const list = await app.inject({ method: 'GET', url: '/trips/00000000-0000-4000-8000-000000000001/places' });
    expect(list.statusCode).toBe(401);

    const save = await app.inject({
      method: 'POST',
      url: '/trips/00000000-0000-4000-8000-000000000001/places',
      payload: { placeId: 'my-food-madam-kwan' },
    });
    expect(save.statusCode).toBe(401);
  });

  it('saves, lists, and removes a nearby place on the trip', async () => {
    const token = await signup('favorites@example.com');
    const headers = { authorization: `Bearer ${token}` };
    const tripId = await createTrip(token);

    const saved = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/places`,
      headers,
      payload: { placeId: 'my-food-madam-kwan' },
    });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toMatchObject({
      place: {
        tripId,
        placeId: 'my-food-madam-kwan',
        name: 'Madam Kwan’s (Suria KLCC)',
        category: 'food',
      },
    });

    const listed = await app.inject({
      method: 'GET',
      url: `/trips/${tripId}/places`,
      headers,
    });
    expect(listed.statusCode).toBe(200);
    expect((listed.json() as { places: unknown[] }).places).toHaveLength(1);

    const again = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/places`,
      headers,
      payload: { placeId: 'my-food-madam-kwan' },
    });
    expect(again.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/trips/${tripId}/places`, headers })).json()).toMatchObject({
      places: [{ placeId: 'my-food-madam-kwan' }],
    });

    const removed = await app.inject({
      method: 'DELETE',
      url: `/trips/${tripId}/places/my-food-madam-kwan`,
      headers,
    });
    expect(removed.statusCode).toBe(204);

    const empty = await app.inject({
      method: 'GET',
      url: `/trips/${tripId}/places`,
      headers,
    });
    expect((empty.json() as { places: unknown[] }).places).toHaveLength(0);
  });

  it('returns 404 for unknown trips, unknown places, and other users', async () => {
    const tokenA = await signup('fav-owner@example.com');
    const tokenB = await signup('fav-other@example.com');
    const tripId = await createTrip(tokenA);
    const headersA = { authorization: `Bearer ${tokenA}` };
    const missingTrip = '00000000-0000-4000-8000-000000000099';

    const noTrip = await app.inject({
      method: 'POST',
      url: `/trips/${missingTrip}/places`,
      headers: headersA,
      payload: { placeId: 'my-food-madam-kwan' },
    });
    expect(noTrip.statusCode).toBe(404);

    const unknownPlace = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/places`,
      headers: headersA,
      payload: { placeId: 'not-a-real-place' },
    });
    expect(unknownPlace.statusCode).toBe(404);

    const stolen = await app.inject({
      method: 'GET',
      url: `/trips/${tripId}/places`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(stolen.statusCode).toBe(404);
  });
});
