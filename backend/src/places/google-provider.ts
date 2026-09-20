import { distanceMeters, walkMinutesFromMeters } from './geo.js';
import { inferHalal, normalizePlace, stablePlaceId } from './normalize.js';
import {
  NEARBY_CATEGORIES,
  type NearbyCategory,
  type NearbyPlace,
  type PlacesProvider,
  type PlacesSearchQuery,
} from './types.js';

export const GOOGLE_TYPE_BY_NEARBY: Record<NearbyCategory, string[]> = {
  food: ['restaurant', 'cafe', 'food_court'],
  attractions: ['tourist_attraction', 'park', 'hindu_temple', 'mosque', 'museum'],
  transport: ['subway_station', 'train_station', 'transit_station', 'bus_station', 'taxi_stand'],
  atm: ['atm', 'bank'],
  pharmacy: ['pharmacy'],
  convenience: ['convenience_store'],
  tourist_services: ['visitor_center'],
};

const TYPE_TO_NEARBY: Record<string, NearbyCategory> = Object.fromEntries(
  NEARBY_CATEGORIES.flatMap((category) =>
    GOOGLE_TYPE_BY_NEARBY[category].map((type) => [type, category]),
  ),
) as Record<string, NearbyCategory>;

export interface GooglePlacesConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface GooglePlace {
  id?: string;
  types?: string[];
  primaryType?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  currentOpeningHours?: { openNow?: boolean };
}

export function nearbyCategoryFromGoogleTypes(
  primaryType: string | undefined,
  types: string[] = [],
): NearbyCategory | null {
  if (primaryType && TYPE_TO_NEARBY[primaryType]) return TYPE_TO_NEARBY[primaryType];
  for (const type of types) {
    if (TYPE_TO_NEARBY[type]) return TYPE_TO_NEARBY[type];
  }
  return null;
}

export function googlePlaceToNearby(
  raw: GooglePlace,
  query: PlacesSearchQuery,
): NearbyPlace | null {
  const nearbyCategory = nearbyCategoryFromGoogleTypes(raw.primaryType, raw.types);
  const latitude = raw.location?.latitude;
  const longitude = raw.location?.longitude;
  const name = raw.displayName?.text?.trim();
  const externalId = raw.id;
  if (!nearbyCategory || latitude == null || longitude == null || !name || !externalId) {
    return null;
  }
  const meters = distanceMeters(query, { latitude, longitude });
  return normalizePlace({
    id: stablePlaceId('google', externalId),
    name,
    nearbyCategory,
    address: raw.formattedAddress,
    latitude,
    longitude,
    distanceMeters: Math.round(meters),
    walkMinutes: walkMinutesFromMeters(meters),
    openNow: raw.currentOpeningHours?.openNow ?? null,
    halal: nearbyCategory === 'food' ? inferHalal(name, raw.types) : null,
    badges: [],
    source: 'google',
    externalId,
  });
}

function categoriesToQuery(category: PlacesSearchQuery['category']): NearbyCategory[] {
  if (category === 'all') return [...NEARBY_CATEGORIES];
  return [category];
}

export function createGooglePlacesProvider(config: GooglePlacesConfig): PlacesProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 8_000;
  const baseUrl = (config.baseUrl ?? 'https://places.googleapis.com').replace(/\/$/, '');

  async function searchOnce(
    query: PlacesSearchQuery,
    includedTypes: string[],
  ): Promise<NearbyPlace[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/v1/places:searchNearby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.currentOpeningHours',
        },
        body: JSON.stringify({
          includedTypes,
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: { latitude: query.latitude, longitude: query.longitude },
              radius: query.radiusMeters,
            },
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Google Places HTTP ${response.status}`);
      }
      const data = (await response.json()) as { places?: GooglePlace[] };
      return (data.places ?? [])
        .map((place) => googlePlaceToNearby(place, query))
        .filter((place): place is NearbyPlace => place != null);
    } finally {
      clearTimeout(timer);
    }
  }

  async function searchText(query: PlacesSearchQuery): Promise<NearbyPlace[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const payload: Record<string, unknown> = {
      textQuery: query.q!.trim(),
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      locationBias: {
        circle: {
          center: { latitude: query.latitude, longitude: query.longitude },
          radius: query.radiusMeters,
        },
      },
    };
    if (query.category !== 'all') {
      payload.includedType = GOOGLE_TYPE_BY_NEARBY[query.category][0];
    }
    if (query.openNow === true) {
      payload.openNow = true;
    }
    try {
      const response = await fetchImpl(`${baseUrl}/v1/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.currentOpeningHours',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Google Places HTTP ${response.status}`);
      }
      const data = (await response.json()) as { places?: GooglePlace[] };
      return (data.places ?? [])
        .map((place) => googlePlaceToNearby(place, query))
        .filter((place): place is NearbyPlace => place != null)
        .filter((place) => (place.distanceMeters ?? Number.POSITIVE_INFINITY) <= query.radiusMeters);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    kind: 'google',
    async search(query) {
      if (query.q?.trim()) {
        return searchText(query);
      }
      const groups = categoriesToQuery(query.category);
      const batches = await Promise.all(
        groups.map((category) => searchOnce(query, GOOGLE_TYPE_BY_NEARBY[category])),
      );
      const seen = new Set<string>();
      const merged: NearbyPlace[] = [];
      for (const place of batches.flat()) {
        if (seen.has(place.id)) continue;
        seen.add(place.id);
        merged.push(place);
      }
      return merged;
    },
  };
}
