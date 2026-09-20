import { WALK_15_MAX_METERS } from './types.js';
import type {
  NearbyCategory,
  NearbyChipId,
  NearbyPlace,
  NearbyQuickFilter,
  PlacesSearchQuery,
  PlacesSearchResult,
} from './types.js';
import { NEARBY_CATEGORY_CHIPS } from './types.js';

function matchesText(place: NearbyPlace, q: string): boolean {
  const blob = [place.name, place.description ?? '', place.address ?? '', place.area ?? '', place.badges.join(' ')].join(
    ' ',
  );
  return blob.toLowerCase().includes(q.toLowerCase());
}

export function applyQuickAndTextFilters(
  places: NearbyPlace[],
  query: Pick<PlacesSearchQuery, 'q' | 'openNow' | 'walk15'>,
): NearbyPlace[] {
  const needle = query.q?.trim();
  return places.filter((place) => {
    if (needle && needle.length >= 2 && !matchesText(place, needle)) return false;
    if (query.openNow && place.openNow !== true) return false;
    if (query.walk15 && (place.distanceMeters ?? Number.POSITIVE_INFINITY) > WALK_15_MAX_METERS) {
      return false;
    }
    return true;
  });
}

export function applyCategoryAndHalal(
  places: NearbyPlace[],
  category: NearbyChipId,
  halalOnly: boolean,
): NearbyPlace[] {
  if (halalOnly && category !== 'all' && category !== 'food') {
    return [];
  }
  return places.filter((place) => {
    if (halalOnly) {
      if (place.nearbyCategory !== 'food' || place.halal !== true) return false;
    }
    if (category !== 'all' && place.nearbyCategory !== category) return false;
    return true;
  });
}

export function countByChip(places: NearbyPlace[]): Record<NearbyChipId, number> {
  const counts = {
    all: places.length,
    food: 0,
    attractions: 0,
    transport: 0,
    atm: 0,
    pharmacy: 0,
    convenience: 0,
    tourist_services: 0,
  } satisfies Record<NearbyChipId, number>;
  for (const place of places) {
    const key = place.nearbyCategory as NearbyCategory;
    counts[key] += 1;
  }
  return counts;
}

export function assemblePlacesResult(
  places: NearbyPlace[],
  query: PlacesSearchQuery,
  meta: Pick<PlacesSearchResult, 'provider' | 'fallback' | 'areaId' | 'areaLabel'>,
): PlacesSearchResult {
  const preCategory = applyQuickAndTextFilters(places, query);
  const forCounts = applyCategoryAndHalal(preCategory, 'all', query.halalOnly === true);
  const counts = countByChip(forCounts);
  const filtered = applyCategoryAndHalal(preCategory, query.category, query.halalOnly === true).sort(
    (a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0) || a.name.localeCompare(b.name),
  );
  const quickFilters: NearbyQuickFilter[] = [];
  if (query.openNow) quickFilters.push('open_now');
  if (query.halalOnly) quickFilters.push('halal_only');
  if (query.walk15) quickFilters.push('walk_15');

  return {
    provider: meta.provider,
    fallback: meta.fallback,
    origin: { latitude: query.latitude, longitude: query.longitude },
    areaId: meta.areaId,
    areaLabel: meta.areaLabel,
    radiusMeters: query.radiusMeters,
    category: query.category,
    q: query.q?.trim() || null,
    quickFilters,
    chips: NEARBY_CATEGORY_CHIPS,
    counts,
    places: filtered,
  };
}
