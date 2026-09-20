import { toPlaceDetails } from './place-view.js';
import { distanceMeters, walkMinutesFromMeters } from './geo.js';
import { formatHoursLines, isSeedPlaceOpen } from './hours.js';
import { MALAYSIA_NEARBY_PLACES } from './malaysia-seed.js';
import { normalizePlace } from './normalize.js';
import type {
  GeoPoint,
  MalaysiaPlaceSeedRecord,
  NearbyPlace,
  PlaceDetails,
  PlaceDetailsQuery,
  PlacesProvider,
  PlacesSearchQuery,
} from './types.js';

export function malaysiaSeedRecordToNearby(
  record: MalaysiaPlaceSeedRecord,
  now: Date,
  origin: GeoPoint,
): NearbyPlace {
  const meters = distanceMeters(origin, record);
  return normalizePlace({
    id: record.id,
    name: record.name,
    nearbyCategory: record.nearbyCategory,
    city: record.city,
    country: record.country,
    area: record.area,
    address: record.address,
    description: record.description,
    latitude: record.latitude,
    longitude: record.longitude,
    distanceMeters: Math.round(meters),
    walkMinutes: walkMinutesFromMeters(meters),
    openNow: isSeedPlaceOpen(record, now),
    halal: record.halal ?? null,
    englishSpoken: record.englishSpoken ?? null,
    badges: record.badges,
    priceBandMyr: record.priceBandMyr,
    source: 'seed',
    externalId: record.id,
  });
}

export function malaysiaSeedToPlaces(now: Date, origin: PlacesSearchQuery): NearbyPlace[] {
  return MALAYSIA_NEARBY_PLACES.map((record) => malaysiaSeedRecordToNearby(record, now, origin));
}

export function seedRecordToDetails(
  record: MalaysiaPlaceSeedRecord,
  query: PlaceDetailsQuery,
): PlaceDetails {
  return toPlaceDetails(malaysiaSeedRecordToNearby(record, query.now, query.origin), {
    phone: record.phone,
    website: record.website,
    bookingUrl: record.bookingUrl,
    bookingLabel: record.bookingLabel,
    hoursLines: formatHoursLines(record),
    photos: record.photos,
  });
}

export function findMalaysiaSeedRecord(id: string): MalaysiaPlaceSeedRecord | undefined {
  const lookup = id.startsWith('seed:') ? id.slice('seed:'.length) : id;
  return MALAYSIA_NEARBY_PLACES.find((place) => place.id === lookup || place.id === id);
}

export function createSeedPlacesProvider(): PlacesProvider {
  return {
    kind: 'seed',
    async search(query) {
      const now = query.now ?? new Date();
      return malaysiaSeedToPlaces(now, query).filter(
        (place) => (place.distanceMeters ?? Number.POSITIVE_INFINITY) <= query.radiusMeters,
      );
    },
    async get(id, query) {
      const record = findMalaysiaSeedRecord(id);
      return record ? seedRecordToDetails(record, query) : null;
    },
  };
}
