import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { resolvePlacesProviderKind } from '../src/places/factory.js';
import { getPlaceDetails } from '../src/places/details.js';
import { googlePlaceToDetails, googlePlaceToNearby, nearbyCategoryFromGoogleTypes } from '../src/places/google-provider.js';
import { formatHoursLines, isSeedPlaceOpen } from '../src/places/hours.js';
import { MALAYSIA_PLACES_SEED } from '../src/places/malaysia-seed.js';
import { PLACE_CATEGORY_BY_NEARBY } from '../src/places/types.js';
import {
  buildOverpassQuery,
  nearbyCategoryFromOsmTags,
  overpassElementToNearby,
} from '../src/places/overpass-provider.js';
import { approximateLocation } from '../src/places/geo.js';
import { searchNearbyPlaces } from '../src/places/search.js';
import { NEARBY_CATEGORIES, type PlacesSearchQuery } from '../src/places/types.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const baseQuery: PlacesSearchQuery = {
  latitude: 3.15785,
  longitude: 101.71165,
  radiusMeters: 2000,
  category: 'all',
};

function testConfig(overrides: Record<string, string> = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-only-insecure-jwt-secret',
    ...overrides,
  });
}

describe('Malaysia nearby seed', () => {
  it('JSON seed matches TypeScript seed', () => {
    const jsonPath = path.resolve(dirname, '../db/malaysia-places.json');
    const fromJson = JSON.parse(readFileSync(jsonPath, 'utf8')) as typeof MALAYSIA_PLACES_SEED;
    expect(fromJson).toEqual(MALAYSIA_PLACES_SEED);
  });

  it('covers every MVP nearby category and maps to PlaceCategory', () => {
    const present = new Set(MALAYSIA_PLACES_SEED.places.map((place) => place.nearbyCategory));
    expect([...NEARBY_CATEGORIES].every((category) => present.has(category))).toBe(true);
    for (const place of MALAYSIA_PLACES_SEED.places) {
      expect(PLACE_CATEGORY_BY_NEARBY[place.nearbyCategory]).toBeDefined();
    }
  });

  it('includes Stitch example venues', () => {
    const names = MALAYSIA_PLACES_SEED.places.map((place) => place.name);
    expect(names.some((name) => name.includes('Madam Kwan'))).toBe(true);
    expect(names).toContain('Petronas Twin Towers');
    expect(names).toContain('Batu Caves');
    expect(names.some((name) => name.includes('Guardian Pharmacy'))).toBe(true);
  });
});

describe('hours (Asia/Kuala_Lumpur)', () => {
  const madam = MALAYSIA_PLACES_SEED.places.find((place) => place.id === 'my-food-madam-kwan')!;
  const alor = MALAYSIA_PLACES_SEED.places.find((place) => place.id === 'my-food-jalan-alor')!;
  const pelita = MALAYSIA_PLACES_SEED.places.find((place) => place.id === 'my-food-mamak-klcc')!;

  it('treats mall restaurants as open at noon KL time', () => {
    expect(isSeedPlaceOpen(madam, new Date('2026-09-22T04:00:00.000Z'))).toBe(true);
  });

  it('handles overnight hawker hours', () => {
    expect(isSeedPlaceOpen(alor, new Date('2026-09-22T04:00:00.000Z'))).toBe(false);
    expect(isSeedPlaceOpen(alor, new Date('2026-09-22T10:00:00.000Z'))).toBe(true);
    expect(isSeedPlaceOpen(alor, new Date('2026-09-22T17:30:00.000Z'))).toBe(true);
  });

  it('alwaysOpen venues stay open', () => {
    expect(isSeedPlaceOpen(pelita, new Date('2026-09-22T16:00:00.000Z'))).toBe(true);
  });

  it('formats daily and 24-hour hours for details', () => {
    expect(formatHoursLines(madam)).toEqual(['Daily 10 am – 10 pm']);
    expect(formatHoursLines(pelita)).toEqual(['Open 24 hours']);
  });
});

describe('resolvePlacesProviderKind', () => {
  it('uses Malaysia seed when no Google key is set', () => {
    expect(resolvePlacesProviderKind(testConfig())).toBe('seed');
    expect(resolvePlacesProviderKind(testConfig({ PLACES_PROVIDER: 'google' }))).toBe('seed');
    expect(
      resolvePlacesProviderKind(testConfig({ PLACES_PROVIDER: 'google', GOOGLE_PLACES_API_KEY: 'CHANGE_ME_KEY' })),
    ).toBe('seed');
  });

  it('selects google when a usable key is present', () => {
    expect(
      resolvePlacesProviderKind(testConfig({ GOOGLE_PLACES_API_KEY: 'AIzaSyTestKeyValue' })),
    ).toBe('google');
  });

  it('selects overpass when requested via env', () => {
    expect(resolvePlacesProviderKind(testConfig({ PLACES_PROVIDER: 'overpass' }))).toBe('overpass');
  });
});

describe('provider normalization', () => {
  it('maps Google types into nearby categories and PlaceCategory', () => {
    expect(nearbyCategoryFromGoogleTypes('restaurant', [])).toBe('food');
    expect(nearbyCategoryFromGoogleTypes('atm', ['point_of_interest'])).toBe('atm');
    const place = googlePlaceToNearby(
      {
        id: 'ChIJtest',
        primaryType: 'pharmacy',
        types: ['pharmacy', 'point_of_interest'],
        displayName: { text: 'Guardian Pharmacy' },
        formattedAddress: 'Suria KLCC',
        location: { latitude: 3.15758, longitude: 101.7125 },
        currentOpeningHours: { openNow: true },
      },
      baseQuery,
    );
    expect(place?.nearbyCategory).toBe('pharmacy');
    expect(place?.category).toBe('safety');
    expect(place?.source).toBe('google');
    expect(place?.id).toBe('google:ChIJtest');
    expect(place?.country).toBe('MY');
  });

  it('maps Google Place Details including licensed photos and contact', () => {
    const details = googlePlaceToDetails(
      {
        id: 'ChIJtest',
        primaryType: 'tourist_attraction',
        types: ['tourist_attraction'],
        displayName: { text: 'Petronas Twin Towers' },
        formattedAddress: 'Kuala Lumpur City Centre',
        location: { latitude: 3.15785, longitude: 101.71165 },
        currentOpeningHours: { openNow: true },
        regularOpeningHours: { weekdayDescriptions: ['Monday: 9:00 AM – 9:00 PM'] },
        internationalPhoneNumber: '+60 3-2331 8080',
        websiteUri: 'https://www.petronastwintowers.com.my/',
      },
      {
        origin: { latitude: baseQuery.latitude, longitude: baseQuery.longitude },
        now: new Date('2026-09-22T04:00:00.000Z'),
      },
      [
        {
          url: 'https://example.com/licensed.jpg',
          license: 'Google Places (attribution required)',
          attribution: 'Photo Bot',
        },
      ],
    );
    expect(details?.phone).toBe('+60 3-2331 8080');
    expect(details?.website).toContain('petronastwintowers');
    expect(details?.hoursLines[0]).toContain('Monday');
    expect(details?.photos).toHaveLength(1);
    expect(details?.photos[0]?.attribution).toBe('Photo Bot');
    expect(details?.actions.some((action) => action.kind === 'directions')).toBe(true);
    expect(details?.actions.some((action) => action.kind === 'call')).toBe(true);
  });

  it('maps Overpass tags and infers halal from OSM diet tag', () => {
    expect(nearbyCategoryFromOsmTags({ amenity: 'restaurant' })).toBe('food');
    expect(nearbyCategoryFromOsmTags({ shop: 'convenience' })).toBe('convenience');
    const place = overpassElementToNearby(
      {
        type: 'node',
        id: 42,
        lat: 3.158,
        lon: 101.712,
        tags: { name: 'Restoran Test', amenity: 'restaurant', 'diet:halal': 'yes' },
      },
      baseQuery,
    );
    expect(place?.nearbyCategory).toBe('food');
    expect(place?.category).toBe('food');
    expect(place?.halal).toBe(true);
    expect(place?.source).toBe('overpass');
    expect(buildOverpassQuery(baseQuery)).toContain('amenity');
    expect(buildOverpassQuery({ ...baseQuery, category: 'pharmacy' })).toContain('pharmacy');
  });
});

describe('searchNearbyPlaces (seed)', () => {
  const config = testConfig();
  const noonKl = new Date('2026-09-22T04:00:00.000Z');

  it('defaults to KLCC & Downtown within 2 km and excludes Batu Caves', async () => {
    const result = await searchNearbyPlaces(config, { now: noonKl });
    expect(result.provider).toBe('seed');
    expect(result.fallback).toBe(false);
    expect(result.areaId).toBe('klcc');
    expect(result.areaLabel).toBe('KLCC & Downtown');
    expect(result.radiusMeters).toBe(2000);
    expect(result.places.some((place) => place.name === 'Petronas Twin Towers')).toBe(true);
    expect(result.places.some((place) => place.name === 'Batu Caves')).toBe(false);
    expect(result.counts.all).toBe(result.places.length);
    expect(result.counts.food).toBeGreaterThan(0);
    expect(result.counts.attractions).toBeGreaterThan(0);
    expect(result.counts.pharmacy).toBeGreaterThan(0);
  });

  it('filters Food & Halal and Halal Only', async () => {
    const food = await searchNearbyPlaces(config, { category: 'food', now: noonKl });
    expect(food.places.every((place) => place.nearbyCategory === 'food')).toBe(true);
    expect(food.places.every((place) => place.category === 'food')).toBe(true);

    const halal = await searchNearbyPlaces(config, { halalOnly: true, now: noonKl });
    expect(halal.places.every((place) => place.nearbyCategory === 'food' && place.halal === true)).toBe(true);
    expect(halal.counts.pharmacy).toBe(0);

    const pharmacyHalal = await searchNearbyPlaces(config, {
      category: 'pharmacy',
      halalOnly: true,
      now: noonKl,
    });
    expect(pharmacyHalal.places).toEqual([]);
  });

  it('applies walk_15, open_now, and free-text search', async () => {
    const walk = await searchNearbyPlaces(config, { walk15: true, now: noonKl });
    expect(walk.places.every((place) => (place.distanceMeters ?? 0) <= 1200)).toBe(true);
    expect(walk.quickFilters).toContain('walk_15');

    const open = await searchNearbyPlaces(config, { openNow: true, now: noonKl });
    expect(open.places.every((place) => place.openNow === true)).toBe(true);
    expect(open.places.some((place) => place.name.includes('Jalan Alor'))).toBe(false);

    const search = await searchNearbyPlaces(config, { q: 'ATM', now: noonKl });
    expect(search.places.some((place) => /atm|maybank/i.test(place.name))).toBe(true);
  });

  it('uses the Batu Caves area pin', async () => {
    const result = await searchNearbyPlaces(config, { areaId: 'batu_caves', now: noonKl });
    expect(result.places.some((place) => place.name === 'Batu Caves')).toBe(true);
    expect(result.areaLabel).toBe('Batu Caves');
  });

  it('coarsens GPS pins to ~100 m and respects radius', async () => {
    const pin = { latitude: 3.15785123, longitude: 101.71165987 };
    const result = await searchNearbyPlaces(config, { ...pin, radiusMeters: 400, now: noonKl });
    expect(result.origin).toEqual(approximateLocation(pin));
    expect(result.areaId).toBeNull();
    expect(result.radiusMeters).toBe(400);
    expect(result.places.some((place) => place.name === 'Petronas Twin Towers')).toBe(true);
    expect(result.places.some((place) => place.name === 'Jalan Alor')).toBe(false);
    expect(result.places.some((place) => place.name === 'Batu Caves')).toBe(false);
  });

  it('falls back to seed when Google errors', async () => {
    const googleConfig = testConfig({
      PLACES_PROVIDER: 'google',
      GOOGLE_PLACES_API_KEY: 'AIzaSyTestKeyValue',
    });
    const result = await searchNearbyPlaces(
      googleConfig,
      { now: noonKl },
      {
        fetchImpl: async () =>
          new Response('nope', { status: 500, headers: { 'Content-Type': 'application/json' } }),
      },
    );
    expect(result.fallback).toBe(true);
    expect(result.provider).toBe('seed');
    expect(result.places.length).toBeGreaterThan(0);
  });

  it('normalizes Google Nearby Search payloads', async () => {
    const googleConfig = testConfig({
      PLACES_PROVIDER: 'google',
      GOOGLE_PLACES_API_KEY: 'AIzaSyTestKeyValue',
    });
    const result = await searchNearbyPlaces(
      googleConfig,
      { category: 'food', now: noonKl },
      {
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              places: [
                {
                  id: 'ChIJ1',
                  primaryType: 'restaurant',
                  types: ['restaurant'],
                  displayName: { text: 'Halal Dummy Cafe' },
                  location: { latitude: 3.1579, longitude: 101.7117 },
                  currentOpeningHours: { openNow: true },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      },
    );
    expect(result.provider).toBe('google');
    expect(result.fallback).toBe(false);
    expect(result.places).toHaveLength(1);
    expect(result.places[0]?.halal).toBe(true);
    expect(result.places[0]?.nearbyCategory).toBe('food');
  });

  it('uses Google Text Search for free-text queries', async () => {
    const googleConfig = testConfig({
      PLACES_PROVIDER: 'google',
      GOOGLE_PLACES_API_KEY: 'AIzaSyTestKeyValue',
    });
    let calledUrl = '';
    let calledBody = '';
    const result = await searchNearbyPlaces(
      googleConfig,
      { q: 'Guardian', category: 'pharmacy', openNow: true, now: noonKl },
      {
        fetchImpl: async (input, init) => {
          calledUrl = String(input);
          calledBody = String(init?.body ?? '');
          return new Response(
            JSON.stringify({
              places: [
                {
                  id: 'ChIJ2',
                  primaryType: 'pharmacy',
                  types: ['pharmacy'],
                  displayName: { text: 'Guardian Pharmacy' },
                  location: { latitude: 3.1579, longitude: 101.7117 },
                  currentOpeningHours: { openNow: true },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        },
      },
    );
    expect(calledUrl).toContain('/v1/places:searchText');
    expect(JSON.parse(calledBody)).toMatchObject({
      textQuery: 'Guardian',
      includedType: 'pharmacy',
      openNow: true,
    });
    expect(result.provider).toBe('google');
    expect(result.places[0]?.name).toBe('Guardian Pharmacy');
  });
});

describe('GET /places', () => {
  const app = buildApp(testConfig());

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns category chips and areas', async () => {
    const response = await app.inject({ method: 'GET', url: '/places/categories' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { chips: Array<{ id: string }>; areas: Array<{ id: string }> };
    expect(body.chips.map((chip) => chip.id)).toEqual([
      'all',
      'food',
      'attractions',
      'transport',
      'atm',
      'pharmacy',
      'convenience',
      'tourist_services',
    ]);
    expect(body.areas.some((area) => area.id === 'klcc')).toBe(true);
  });

  it('returns normalized Malaysia seed nearby places', async () => {
    const response = await app.inject({ method: 'GET', url: '/places/nearby' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      provider: string;
      places: Array<{ nearbyCategory: string; category: string; country: string }>;
    };
    expect(body.provider).toBe('seed');
    expect(body.places.length).toBeGreaterThan(5);
    expect(body.places.every((place) => place.country === 'MY')).toBe(true);
  });

  it('rejects unknown query parameters', async () => {
    const response = await app.inject({ method: 'GET', url: '/places/nearby?foo=1' });
    expect(response.statusCode).toBe(400);
  });

  it('applies category, radius, open-now, text, and approximate location filters', async () => {
    const category = await app.inject({ method: 'GET', url: '/places/nearby?category=food' });
    expect(category.statusCode).toBe(200);
    const food = category.json() as { places: Array<{ nearbyCategory: string }> };
    expect(food.places.length).toBeGreaterThan(0);
    expect(food.places.every((place) => place.nearbyCategory === 'food')).toBe(true);

    const radius = await app.inject({ method: 'GET', url: '/places/nearby?radius=400' });
    expect(radius.statusCode).toBe(200);
    const nearby = radius.json() as {
      radiusMeters: number;
      places: Array<{ name: string; distanceMeters?: number }>;
    };
    expect(nearby.radiusMeters).toBe(400);
    expect(nearby.places.every((place) => (place.distanceMeters ?? 0) <= 400)).toBe(true);
    expect(nearby.places.some((place) => place.name === 'Batu Caves')).toBe(false);

    const openNow = await app.inject({ method: 'GET', url: '/places/nearby?openNow=true' });
    expect(openNow.statusCode).toBe(200);
    const open = openNow.json() as { places: Array<{ openNow?: boolean | null }>; quickFilters: string[] };
    expect(open.quickFilters).toContain('open_now');
    expect(open.places.every((place) => place.openNow === true)).toBe(true);

    const text = await app.inject({ method: 'GET', url: '/places/nearby?q=ATM' });
    expect(text.statusCode).toBe(200);
    const searched = text.json() as { q: string | null; places: Array<{ name: string }> };
    expect(searched.q).toBe('ATM');
    expect(searched.places.some((place) => /atm|maybank/i.test(place.name))).toBe(true);

    const gps = await app.inject({
      method: 'GET',
      url: '/places/nearby?lat=3.23791234&lng=101.68405678&radius=800',
    });
    expect(gps.statusCode).toBe(200);
    const pin = gps.json() as {
      origin: { latitude: number; longitude: number };
      areaId: string | null;
      places: Array<{ name: string }>;
    };
    expect(pin.origin).toEqual({ latitude: 3.238, longitude: 101.684 });
    expect(pin.areaId).toBeNull();
    expect(pin.places.some((place) => place.name === 'Batu Caves')).toBe(true);

    const area = await app.inject({ method: 'GET', url: '/places/nearby?area=bukit_bintang' });
    expect(area.statusCode).toBe(200);
    const named = area.json() as { areaId: string; places: Array<{ name: string }> };
    expect(named.areaId).toBe('bukit_bintang');
    expect(named.places.some((place) => place.name === 'Jalan Alor')).toBe(true);
  });

  it('rejects incomplete or invalid nearby filters', async () => {
    const missingLng = await app.inject({ method: 'GET', url: '/places/nearby?lat=3.15' });
    expect(missingLng.statusCode).toBe(400);

    const shortText = await app.inject({ method: 'GET', url: '/places/nearby?q=A' });
    expect(shortText.statusCode).toBe(400);

    const tinyRadius = await app.inject({ method: 'GET', url: '/places/nearby?radius=50' });
    expect(tinyRadius.statusCode).toBe(400);
  });

  it('returns seed place details with address, hours, licensed photos, and actions', async () => {
    const response = await app.inject({ method: 'GET', url: '/places/my-attr-petronas' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      id: string;
      address?: string;
      phone?: string;
      website?: string;
      hoursLines: string[];
      photos: Array<{ license: string; attribution: string }>;
      actions: Array<{ kind: string; label: string; href: string }>;
    };
    expect(body.id).toBe('my-attr-petronas');
    expect(body.address).toContain('Kuala Lumpur City Centre');
    expect(body.phone).toContain('2331');
    expect(body.website).toContain('petronastwintowers');
    expect(body.hoursLines[0]).toMatch(/Daily 9 am/);
    expect(body.photos.length).toBeGreaterThan(0);
    expect(body.photos[0]?.license).toMatch(/CC BY-SA/);
    expect(body.photos[0]?.attribution).toContain('Wikimedia');
    expect(body.actions.map((action) => action.kind)).toEqual(
      expect.arrayContaining(['directions', 'call', 'website', 'booking']),
    );
    expect(body.actions.find((action) => action.kind === 'booking')?.label).toBe('Book tickets');
  });

  it('omits photos that are not licensed and still returns contact when present', async () => {
    const response = await app.inject({ method: 'GET', url: '/places/my-food-madam-kwan' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { photos: unknown[]; website?: string; hoursLines: string[] };
    expect(body.photos).toEqual([]);
    expect(body.website).toContain('madamkwans');
    expect(body.hoursLines[0]).toMatch(/Daily/);
  });

  it('returns 404 for an unknown place id', async () => {
    const response = await app.inject({ method: 'GET', url: '/places/not-a-real-place' });
    expect(response.statusCode).toBe(404);
  });
});

describe('getPlaceDetails (google)', () => {
  it('loads Google Place Details and resolves photo URIs', async () => {
    const googleConfig = testConfig({
      PLACES_PROVIDER: 'google',
      GOOGLE_PLACES_API_KEY: 'AIzaSyTestKeyValue',
    });
    const details = await getPlaceDetails(
      googleConfig,
      { id: 'google:ChIJ1', now: new Date('2026-09-22T04:00:00.000Z') },
      {
        fetchImpl: async (input) => {
          const url = String(input);
          if (url.includes('/media')) {
            return new Response(JSON.stringify({ photoUri: 'https://example.com/p.jpg' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(
            JSON.stringify({
              id: 'ChIJ1',
              primaryType: 'restaurant',
              types: ['restaurant'],
              displayName: { text: 'Halal Dummy Cafe' },
              formattedAddress: 'Suria KLCC',
              location: { latitude: 3.1579, longitude: 101.7117 },
              currentOpeningHours: { openNow: true },
              internationalPhoneNumber: '+60 3-1111 1111',
              websiteUri: 'https://example.com',
              photos: [{ name: 'places/ChIJ1/photos/abc', authorAttributions: [{ displayName: 'Owner' }] }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        },
      },
    );
    expect(details.source).toBe('google');
    expect(details.phone).toBe('+60 3-1111 1111');
    expect(details.photos[0]?.url).toBe('https://example.com/p.jpg');
    expect(details.photos[0]?.attribution).toBe('Owner');
    expect(details.actions.some((action) => action.kind === 'website')).toBe(true);
  });
});
