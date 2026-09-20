import { toPlaceDetails } from './place-view.js';
import { distanceMeters, walkMinutesFromMeters } from './geo.js';
import { inferHalal, normalizePlace, stablePlaceId } from './normalize.js';
import {
  NEARBY_CATEGORIES,
  type LicensedPlacePhoto,
  type NearbyCategory,
  type NearbyPlace,
  type PlaceDetails,
  type PlaceDetailsQuery,
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
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  editorialSummary?: { text?: string };
  photos?: Array<{
    name?: string;
    authorAttributions?: Array<{ displayName?: string; uri?: string }>;
  }>;
}

const GOOGLE_DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'types',
  'primaryType',
  'currentOpeningHours',
  'regularOpeningHours',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'editorialSummary',
  'photos',
].join(',');

const GOOGLE_SEARCH_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.currentOpeningHours';

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

export function googlePlaceToDetails(
  raw: GooglePlace,
  query: PlaceDetailsQuery,
  photos: LicensedPlacePhoto[] = [],
): PlaceDetails | null {
  const nearby = googlePlaceToNearby(raw, {
    latitude: query.origin.latitude,
    longitude: query.origin.longitude,
    radiusMeters: 20_000,
    category: 'all',
  });
  if (!nearby) return null;
  if (raw.editorialSummary?.text && !nearby.description) {
    nearby.description = raw.editorialSummary.text;
  }
  const hoursLines = (raw.regularOpeningHours?.weekdayDescriptions ?? []).map((line) => line.trim()).filter(Boolean);
  return toPlaceDetails(nearby, {
    phone: raw.internationalPhoneNumber || raw.nationalPhoneNumber,
    website: raw.websiteUri,
    hoursLines,
    photos,
  });
}

export async function resolveGooglePhotos(
  photos: GooglePlace['photos'] = [],
  config: { baseUrl: string; apiKey: string; fetchImpl: typeof fetch; timeoutMs: number },
): Promise<LicensedPlacePhoto[]> {
  const licensed: LicensedPlacePhoto[] = [];
  for (const photo of photos.slice(0, 3)) {
    if (!photo.name) continue;
    const attribution =
      photo.authorAttributions
        ?.map((author) => author.displayName?.trim())
        .filter(Boolean)
        .join(', ') || 'Google Places';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await config.fetchImpl(
        `${config.baseUrl}/v1/${photo.name}/media?maxHeightPx=800&skipHttpRedirect=true`,
        {
          headers: { 'X-Goog-Api-Key': config.apiKey },
          signal: controller.signal,
        },
      );
      if (!response.ok) continue;
      const data = (await response.json()) as { photoUri?: string };
      if (!data.photoUri) continue;
      licensed.push({
        url: data.photoUri,
        license: 'Google Places (attribution required)',
        attribution,
      });
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return licensed;
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
          'X-Goog-FieldMask': GOOGLE_SEARCH_FIELD_MASK,
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
          'X-Goog-FieldMask': GOOGLE_SEARCH_FIELD_MASK,
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
    async get(id, query) {
      const placeId = id.startsWith('google:') ? id.slice('google:'.length) : id;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/v1/places/${encodeURIComponent(placeId)}`, {
          headers: {
            'X-Goog-Api-Key': config.apiKey,
            'X-Goog-FieldMask': GOOGLE_DETAILS_FIELD_MASK,
          },
          signal: controller.signal,
        });
        if (response.status === 404) return null;
        if (!response.ok) {
          throw new Error(`Google Places HTTP ${response.status}`);
        }
        const raw = (await response.json()) as GooglePlace;
        const photos = await resolveGooglePhotos(raw.photos, {
          baseUrl,
          apiKey: config.apiKey,
          fetchImpl,
          timeoutMs,
        });
        return googlePlaceToDetails(raw, query, photos);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
