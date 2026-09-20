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

async function createTrip(
  token: string,
  payload: Record<string, unknown> = {
    destination: 'Kuala Lumpur',
    startDate: '2026-09-21',
    endDate: '2026-09-27',
    adultCount: 2,
    interests: ['food', 'culture'],
  },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/trips',
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { trip: { id: string } }).trip.id;
}

describe('itinerary CRUD endpoints', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    const tripId = '11111111-1111-4111-8111-111111111111';
    const get = await app.inject({ method: 'GET', url: `/trips/${tripId}/itinerary` });
    expect(get.statusCode).toBe(401);
  });

  it('scopes itineraries to the trip owner', async () => {
    const owner = await signup('itin-owner@example.com');
    const other = await signup('itin-other@example.com');
    const tripId = await createTrip(owner);

    const forbidden = await app.inject({
      method: 'GET',
      url: `/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${other}` },
    });
    expect(forbidden.statusCode).toBe(404);
  });

  it('GET creates a 1–7 day skeleton from the trip dates', async () => {
    const token = await signup('itin-get@example.com');
    const headers = { authorization: `Bearer ${token}` };
    const longTrip = await createTrip(token, {
      destination: 'Kuala Lumpur',
      startDate: '2026-10-01',
      endDate: '2026-10-10',
      adultCount: 1,
      interests: ['culture'],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/trips/${longTrip}/itinerary`,
      headers,
    });
    expect(response.statusCode).toBe(200);
    const itinerary = (
      response.json() as {
        itinerary: {
          dayCount: number;
          status: string;
          days: Array<{ dayNumber: number; date: string; items: unknown[]; weather?: { source: string; condition: string; indoorSafe: boolean; disclaimer: string; hint: string } }>;
        };
      }
    ).itinerary;
    expect(itinerary.status).toBe('draft');
    expect(itinerary.dayCount).toBe(7);
    expect(itinerary.days).toHaveLength(7);
    expect(itinerary.days[0]).toMatchObject({
      dayNumber: 1,
      date: '2026-10-01',
      items: [],
      weather: {
        source: 'seed',
        condition: 'haze_season',
        indoorSafe: false,
        disclaimer: 'Planning hint only — not a forecast guarantee. Conditions can change.',
      },
    });
    expect(itinerary.days[0].weather?.hint).toMatch(/not report live air quality/i);
    expect(itinerary.days[6]).toMatchObject({ dayNumber: 7, date: '2026-10-07' });
    expect(itinerary.days.every((day) => day.weather?.disclaimer.includes('not a forecast guarantee'))).toBe(
      true,
    );
  });

  it('creates, updates, reorders, and deletes items', async () => {
    const token = await signup('itin-crud@example.com');
    const headers = { authorization: `Bearer ${token}` };
    const tripId = await createTrip(token);

    const created = await app.inject({
      method: 'PUT',
      url: `/trips/${tripId}/itinerary`,
      headers,
      payload: { status: 'active' },
    });
    expect(created.statusCode).toBe(200);
    expect((created.json() as { itinerary: { status: string } }).itinerary.status).toBe('active');

    const added = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/items`,
      headers,
      payload: {
        dayNumber: 2,
        kind: 'activity',
        startTime: '09:30',
        endTime: '11:00',
        title: 'Petronas Twin Towers',
        bookingUrl: 'https://www.petronastwintowers.com.my/',
        travelTimeMinutes: 0,
      },
    });
    expect(added.statusCode).toBe(201);
    type ItineraryBody = {
      itinerary: {
        days: Array<{
          id: string;
          dayNumber: number;
          items: Array<{ id: string; title: string | null; sortOrder: number }>;
        }>;
      };
    };
    let itinerary = (added.json() as ItineraryBody).itinerary;
    const day2 = itinerary.days.find((day) => day.dayNumber === 2)!;
    expect(day2.items).toHaveLength(1);
    const firstId = day2.items[0].id;

    const meal = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/items`,
      headers,
      payload: {
        dayId: day2.id,
        kind: 'meal',
        startTime: '12:00',
        endTime: '13:00',
        title: "Madam Kwan's",
        travelTimeMinutes: 15,
      },
    });
    expect(meal.statusCode).toBe(201);
    itinerary = (meal.json() as ItineraryBody).itinerary;
    const items = itinerary.days.find((day) => day.dayNumber === 2)!.items;
    expect(items.map((item) => item.title)).toEqual(['Petronas Twin Towers', "Madam Kwan's"]);
    const mealId = items[1].id;

    const patched = await app.inject({
      method: 'PATCH',
      url: `/trips/${tripId}/itinerary/items/${firstId}`,
      headers,
      payload: { locked: true, notes: 'Book observation deck' },
    });
    expect(patched.statusCode).toBe(200);
    expect(
      (patched.json() as { itinerary: { days: Array<{ items: Array<{ id: string; locked: boolean; notes: string | null }> }> } }).itinerary.days
        .flatMap((day) => day.items)
        .find((item) => item.id === firstId),
    ).toMatchObject({ locked: true, notes: 'Book observation deck' });

    const reordered = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/reorder`,
      headers,
      payload: { dayId: day2.id, itemIds: [mealId, firstId] },
    });
    expect(reordered.statusCode).toBe(200);
    const reorderedItems = (
      reordered.json() as {
        itinerary: { days: Array<{ dayNumber: number; items: Array<{ id: string; sortOrder: number }> }> };
      }
    ).itinerary.days.find((day) => day.dayNumber === 2)!.items;
    expect(reorderedItems.find((item) => item.id === mealId)?.sortOrder).toBe(0);
    expect(reorderedItems.find((item) => item.id === firstId)?.sortOrder).toBe(1);
    expect(reorderedItems.map((item) => item.id)).toEqual([firstId, mealId]);

    const replaced = await app.inject({
      method: 'PUT',
      url: `/trips/${tripId}/itinerary`,
      headers,
      payload: {
        days: [
          {
            dayNumber: 2,
            items: [
              {
                kind: 'note',
                startTime: '08:00',
                endTime: '08:30',
                title: 'Hotel breakfast',
              },
            ],
          },
        ],
      },
    });
    expect(replaced.statusCode).toBe(200);
    const afterPut = (
      replaced.json() as { itinerary: { days: Array<{ dayNumber: number; items: Array<{ title: string | null }> }> } }
    ).itinerary.days.find((day) => day.dayNumber === 2)!.items;
    expect(afterPut).toHaveLength(1);
    expect(afterPut[0].title).toBe('Hotel breakfast');

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/trips/${tripId}/itinerary/items/${
        (
          replaced.json() as {
            itinerary: { days: Array<{ dayNumber: number; items: Array<{ id: string }> }> };
          }
        ).itinerary.days.find((day) => day.dayNumber === 2)!.items[0].id
      }`,
      headers,
    });
    expect(deleted.statusCode).toBe(200);
    expect(
      (deleted.json() as { itinerary: { days: Array<{ dayNumber: number; items: unknown[] }> } }).itinerary.days.find(
        (day) => day.dayNumber === 2,
      )!.items,
    ).toHaveLength(0);
  });

  it('validates times, https booking links, overlaps, and unknown trips', async () => {
    const token = await signup('itin-validate@example.com');
    const headers = { authorization: `Bearer ${token}` };
    const tripId = await createTrip(token);

    const badTime = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/items`,
      headers,
      payload: { dayNumber: 1, kind: 'activity', startTime: '11:00', endTime: '10:00', title: 'Backwards' },
    });
    expect(badTime.statusCode).toBe(400);

    const httpBooking = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/items`,
      headers,
      payload: {
        dayNumber: 1,
        kind: 'activity',
        startTime: '09:00',
        endTime: '10:00',
        bookingUrl: 'http://example.com/tickets',
      },
    });
    expect(httpBooking.statusCode).toBe(400);

    const first = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/items`,
      headers,
      payload: { dayNumber: 1, kind: 'activity', startTime: '09:00', endTime: '11:00', title: 'Morning' },
    });
    expect(first.statusCode).toBe(201);

    const overlap = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/items`,
      headers,
      payload: { dayNumber: 1, kind: 'meal', startTime: '10:30', endTime: '12:00', title: 'Too soon' },
    });
    expect(overlap.statusCode).toBe(400);

    const missingTrip = await app.inject({
      method: 'GET',
      url: '/trips/11111111-1111-4111-8111-111111111111/itinerary',
      headers,
    });
    expect(missingTrip.statusCode).toBe(404);
  });

  it('regenerates a draft around locked items and can scope to one day', async () => {
    const token = await signup('itin-regen@example.com');
    const headers = { authorization: `Bearer ${token}` };
    const tripId = await createTrip(token, {
      destination: 'Kuala Lumpur',
      startDate: '2026-09-21',
      endDate: '2026-09-23',
      adultCount: 2,
      interests: ['food', 'culture'],
      dailyBudget: 'medium',
      travelStyle: 'balanced',
    });

    const seeded = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/items`,
      headers,
      payload: { dayNumber: 1, kind: 'note', startTime: '07:00', endTime: '07:15', title: 'Locked later', locked: true },
    });
    expect(seeded.statusCode).toBe(201);

    const noteOnDay2 = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/items`,
      headers,
      payload: { dayNumber: 2, kind: 'note', startTime: '08:00', endTime: '08:20', title: 'Keep day 2' },
    });
    expect(noteOnDay2.statusCode).toBe(201);

    const regenDay1 = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/regenerate`,
      headers,
      payload: { dayNumber: 1 },
    });
    expect(regenDay1.statusCode).toBe(200);
    const day1Body = regenDay1.json() as {
      generation: { implemented: boolean; source: string; daysRegenerated: number[] };
      itinerary: {
        generatedAt: string | null;
        days: Array<{
          dayNumber: number;
          items: Array<{ id: string; title: string | null; kind: string; locked: boolean }>;
        }>;
      };
    };
    expect(day1Body.generation).toMatchObject({
      implemented: true,
      source: 'places-seed',
      weatherSource: 'seed',
      daysRegenerated: [1],
    });
    expect(day1Body.itinerary.generatedAt).toEqual(expect.any(String));
    const day1 = day1Body.itinerary.days.find((day) => day.dayNumber === 1)!;
    const locked = day1.items.find((item) => item.locked);
    expect(locked?.title).toBe('Locked later');
    expect(day1.items.length).toBeGreaterThan(1);
    expect(day1.items.some((item) => item.kind === 'meal' || item.kind === 'activity')).toBe(true);
    expect(
      day1Body.itinerary.days.find((day) => day.dayNumber === 2)!.items.map((item) => item.title),
    ).toEqual(['Keep day 2']);

    const full = await app.inject({
      method: 'POST',
      url: `/trips/${tripId}/itinerary/generate`,
      headers,
      payload: {},
    });
    expect(full.statusCode).toBe(200);
    const fullBody = full.json() as {
      generation: { daysRegenerated: number[] };
      itinerary: { days: Array<{ dayNumber: number; items: Array<{ title: string | null }> }> };
    };
    expect(fullBody.generation.daysRegenerated).toEqual([1, 2, 3]);
    expect(fullBody.itinerary.days.find((day) => day.dayNumber === 1)!.items.some((item) => item.title === 'Locked later')).toBe(
      true,
    );
    expect(fullBody.itinerary.days.find((day) => day.dayNumber === 2)!.items.length).toBeGreaterThan(1);
  });
});
