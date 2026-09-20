import { distanceMeters, walkMinutesFromMeters } from './geo.js';
import { isSeedPlaceOpen } from './hours.js';
import { MALAYSIA_NEARBY_PLACES } from './malaysia-seed.js';
import { normalizePlace } from './normalize.js';
import type { NearbyPlace, PlacesProvider, PlacesSearchQuery } from './types.js';

export function malaysiaSeedToPlaces(now: Date, origin: PlacesSearchQuery): NearbyPlace[] {
  return MALAYSIA_NEARBY_PLACES.map((record) => {
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
  });
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
  };
}
