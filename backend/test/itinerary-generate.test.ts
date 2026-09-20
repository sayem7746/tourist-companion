import { describe, expect, it } from 'vitest';
import { MALAYSIA_NEARBY_PLACES } from '../src/places/malaysia-seed.js';
import { assertNoOverlaps } from '../src/itinerary/days.js';
import {
  generateDayItems,
  hopMeters,
  isFarHop,
  isPlaceOpenDuring,
  matchesInterest,
  orderPlacesByTravel,
  pickPlace,
  planItinerary,
  placesForDestination,
  travelMinutesBetween,
} from '../src/itinerary/generate.js';
import type { Itinerary, ItineraryDay } from '../src/itinerary/types.js';
import type { Trip } from '../src/trips/types.js';

const SEED_IDS = new Set(MALAYSIA_NEARBY_PLACES.map((place) => place.id));
const seedPlace = (id: string) => MALAYSIA_NEARBY_PLACES.find((place) => place.id === id)!;

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'user',
    destination: 'Kuala Lumpur',
    startDate: '2026-09-21',
    endDate: '2026-09-23',
    adultCount: 2,
    childCount: 0,
    interests: ['food', 'culture'],
    dailyBudget: 'medium',
    travelStyle: 'balanced',
    accommodationName: null,
    arrivalAirport: null,
    arrivalFlight: null,
    arrivalAt: null,
    status: 'draft',
    ...overrides,
  };
}

function skeleton(dates: string[], itemsByDay: Record<number, ItineraryDay['items']> = {}): Itinerary {
  return {
    id: 'itin',
    tripId: 'trip',
    dayCount: dates.length,
    status: 'draft',
    generatedAt: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    days: dates.map((date, index) => ({
      id: `day-${index + 1}`,
      itineraryId: 'itin',
      dayNumber: index + 1,
      date,
      items: itemsByDay[index + 1] ?? [],
    })),
  };
}

describe('itinerary generation', () => {
  it('builds 1–7 day drafts with meals, activities, and seed places', () => {
    const planned = planItinerary(
      trip({ travelStyle: 'balanced', interests: ['food', 'culture'] }),
      skeleton(['2026-09-21', '2026-09-22', '2026-09-23']),
    );
    expect(planned).toHaveLength(3);
    for (const day of planned) {
      assertNoOverlaps(day.items);
      expect(day.items.some((item) => item.kind === 'meal')).toBe(true);
      expect(day.items.some((item) => item.kind === 'activity')).toBe(true);
      const placeIds = day.items.map((item) => item.placeId).filter((id): id is string => id != null);
      expect(placeIds.length).toBeGreaterThan(0);
      expect(placeIds.every((id) => SEED_IDS.has(id))).toBe(true);
    }
  });

  it('clips generation to the itinerary skeleton length', () => {
    const one = planItinerary(
      trip({ startDate: '2026-10-01', endDate: '2026-10-01' }),
      skeleton(['2026-10-01']),
    );
    expect(one).toHaveLength(1);
    const week = planItinerary(
      trip({ startDate: '2026-10-01', endDate: '2026-10-10' }),
      skeleton([
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
      ]),
    );
    expect(week).toHaveLength(7);
  });

  it('fills gaps around locked items instead of overlapping them', () => {
    const lockedStart = '11:00';
    const lockedEnd = '13:30';
    const items = generateDayItems({
      trip: trip(),
      day: {
        id: 'day-1',
        itineraryId: 'itin',
        dayNumber: 1,
        date: '2026-09-21',
        items: [],
      },
      lockedItems: [
        {
          id: 'locked',
          dayId: 'day-1',
          sortOrder: 0,
          kind: 'activity',
          startTime: lockedStart,
          endTime: lockedEnd,
          placeId: 'my-attr-petronas',
          travelTimeMinutes: null,
          notes: 'Already booked',
          bookingUrl: null,
          referralPartnerId: null,
          locked: true,
          title: 'Petronas Twin Towers',
        },
      ],
    });
    assertNoOverlaps([{ startTime: lockedStart, endTime: lockedEnd }, ...items]);
    expect(items.some((item) => item.startTime < lockedEnd && item.endTime > lockedStart)).toBe(false);
  });

  it('prefers cheaper food on a low budget and Madam Kwan on a high budget', () => {
    const low = generateDayItems({
      trip: trip({ dailyBudget: 'low', interests: ['food'] }),
      day: skeleton(['2026-09-21']).days[0],
    });
    const high = generateDayItems({
      trip: trip({ dailyBudget: 'high', interests: ['food'] }),
      day: skeleton(['2026-09-21']).days[0],
    });
    const lowMeals = low.filter((item) => item.kind === 'meal').map((item) => item.placeId);
    const highMeals = high.filter((item) => item.kind === 'meal').map((item) => item.placeId);
    expect(lowMeals).toContain('my-food-suria-court');
    expect(highMeals).toContain('my-food-madam-kwan');
  });

  it('schedules more activities when travel style is packed than relaxed', () => {
    const relaxed = generateDayItems({
      trip: trip({ travelStyle: 'relaxed', interests: ['culture'] }),
      day: skeleton(['2026-09-21']).days[0],
    });
    const packed = generateDayItems({
      trip: trip({ travelStyle: 'packed', interests: ['culture'] }),
      day: skeleton(['2026-09-21']).days[0],
    });
    const count = (items: typeof relaxed) => items.filter((item) => item.kind === 'activity').length;
    expect(count(packed)).toBeGreaterThan(count(relaxed));
    expect(relaxed.some((item) => item.kind === 'note')).toBe(true);
  });

  it('adds a long-distance travel block for nature / Batu Caves days', () => {
    const items = generateDayItems({
      trip: trip({
        interests: ['nature', 'adventure'],
        travelStyle: 'packed',
        destination: 'Kuala Lumpur',
      }),
      day: skeleton(['2026-09-21']).days[0],
    });
    expect(items.some((item) => item.placeId === 'my-attr-batu-caves' || item.kind === 'travel')).toBe(
      true,
    );
  });

  it('reorders clustered seed places and skips a second far hop', () => {
    const petronas = seedPlace('my-attr-petronas');
    const park = seedPlace('my-attr-klcc-park');
    const caves = seedPlace('my-attr-batu-caves');
    expect(isFarHop(petronas, caves)).toBe(true);
    expect(isFarHop(petronas, park)).toBe(false);
    expect(hopMeters(petronas, caves)).toBeGreaterThan(hopMeters(petronas, park));
    expect(travelMinutesBetween(petronas, caves)).toBeGreaterThan(travelMinutesBetween(petronas, park));

    const ordered = orderPlacesByTravel([caves, park, petronas]);
    const parkIdx = ordered.findIndex((place) => place.id === park.id);
    const petronasIdx = ordered.findIndex((place) => place.id === petronas.id);
    expect(Math.abs(parkIdx - petronasIdx)).toBe(1);

    const nearby = pickPlace({
      places: MALAYSIA_NEARBY_PLACES,
      trip: trip({ interests: ['culture'], destination: 'Kuala Lumpur' }),
      date: '2026-09-21',
      startMinutes: 10 * 60,
      endMinutes: 12 * 60,
      kind: 'activity',
      theme: 'culture',
      usedIds: new Set(),
      origin: petronas,
      allowFarHop: false,
    });
    expect(nearby?.id).not.toBe('my-attr-batu-caves');
    expect(nearby && isFarHop(petronas, nearby)).toBe(false);

    const skipped = pickPlace({
      places: MALAYSIA_NEARBY_PLACES,
      trip: trip({ interests: ['culture'] }),
      date: '2026-09-21',
      startMinutes: 14 * 60,
      endMinutes: 16 * 60,
      kind: 'activity',
      theme: 'culture',
      usedIds: new Set([
        'my-attr-petronas',
        'my-attr-klcc-park',
        'my-attr-merdeka',
        'my-attr-batu-caves',
      ]),
      origin: caves,
      allowFarHop: false,
    });
    expect(skipped).toBeUndefined();
  });

  it('does not zig-zag KLCC and Batu Caves on a culture day', () => {
    const items = generateDayItems({
      trip: trip({ interests: ['culture'], travelStyle: 'packed', destination: 'Kuala Lumpur' }),
      day: skeleton(['2026-09-21']).days[0],
    });
    const stops = items
      .filter((item) => item.kind === 'activity' || item.kind === 'meal')
      .map((item) => (item.placeId ? seedPlace(item.placeId) : undefined))
      .filter((place): place is NonNullable<typeof place> => place != null);
    let farHops = 0;
    for (let index = 1; index < stops.length; index += 1) {
      if (isFarHop(stops[index - 1], stops[index])) farHops += 1;
    }
    expect(farHops).toBeLessThanOrEqual(1);
    expect(items.filter((item) => item.placeId === 'my-attr-batu-caves')).toHaveLength(0);
  });

  it('keeps Jalan Alor in evening hours', () => {
    expect(isPlaceOpenDuring(MALAYSIA_NEARBY_PLACES.find((p) => p.id === 'my-food-jalan-alor')!, '2026-09-21', 12 * 60, 13 * 60)).toBe(
      false,
    );
    expect(isPlaceOpenDuring(MALAYSIA_NEARBY_PLACES.find((p) => p.id === 'my-food-jalan-alor')!, '2026-09-21', 18 * 60, 19 * 60)).toBe(
      true,
    );
    const items = generateDayItems({
      trip: trip({ interests: ['nightlife', 'food'], travelStyle: 'packed' }),
      day: skeleton(['2026-09-21']).days[0],
    });
    const alor = items.find((item) => item.placeId === 'my-food-jalan-alor');
    if (alor) {
      expect(alor.startTime >= '17:00').toBe(true);
    }
  });

  it('scores Bukit Bintang places higher for that destination', () => {
    const picked = pickPlace({
      places: placesForDestination('Bukit Bintang'),
      trip: trip({ destination: 'Bukit Bintang', interests: ['food'] }),
      date: '2026-09-21',
      startMinutes: 18 * 60,
      endMinutes: 19 * 60 + 30,
      kind: 'meal',
      theme: 'food',
      usedIds: new Set(),
    });
    expect(picked?.area).toBe('Bukit Bintang');
    expect(matchesInterest(MALAYSIA_NEARBY_PLACES.find((p) => p.id === 'my-food-jalan-alor')!, 'nightlife')).toBe(
      true,
    );
  });

  it('starts day 1 after an arrival transfer when a flight is set', () => {
    const items = generateDayItems({
      trip: trip({
        arrivalAirport: 'KLIA',
        arrivalAt: '2026-09-21T02:00:00.000Z',
        accommodationName: 'Hotel Maya',
      }),
      day: skeleton(['2026-09-21']).days[0],
    });
    expect(items[0]).toMatchObject({
      kind: 'travel',
      title: 'Transfer from KLIA',
    });
  });
});
