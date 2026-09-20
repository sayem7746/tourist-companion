import { distanceMeters, walkMinutesFromMeters } from './geo.js';
import { inferHalal, normalizePlace, stablePlaceId } from './normalize.js';
import {
  NEARBY_CATEGORIES,
  type NearbyCategory,
  type NearbyPlace,
  type PlacesProvider,
  type PlacesSearchQuery,
} from './types.js';

export const OVERPASS_FILTERS_BY_NEARBY: Record<NearbyCategory, string[]> = {
  food: ['node["amenity"~"restaurant|cafe|fast_food|food_court"]', 'node["shop"="food"]'],
  attractions: [
    'node["tourism"~"attraction|museum|viewpoint"]',
    'node["leisure"="park"]',
    'node["amenity"~"place_of_worship"]',
  ],
  transport: [
    'node["railway"~"station|halt"]',
    'node["station"="subway"]',
    'node["highway"="bus_stop"]',
    'node["amenity"="taxi"]',
  ],
  atm: ['node["amenity"="atm"]', 'node["amenity"="bank"]', 'node["shop"="money_lender"]'],
  pharmacy: ['node["amenity"="pharmacy"]', 'node["shop"="chemist"]'],
  convenience: ['node["shop"~"convenience|kiosk"]'],
  tourist_services: ['node["tourism"="information"]', 'node["information"="office"]'],
};

export interface OverpassConfig {
  endpointUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export function nearbyCategoryFromOsmTags(tags: Record<string, string> = {}): NearbyCategory | null {
  const amenity = tags.amenity;
  const shop = tags.shop;
  const tourism = tags.tourism;
  const leisure = tags.leisure;
  const railway = tags.railway;
  const highway = tags.highway;
  const station = tags.station;
  const information = tags.information;

  if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food' || amenity === 'food_court') {
    return 'food';
  }
  if (shop === 'food') return 'food';
  if (
    tourism === 'attraction' ||
    tourism === 'museum' ||
    tourism === 'viewpoint' ||
    leisure === 'park' ||
    amenity === 'place_of_worship'
  ) {
    return 'attractions';
  }
  if (railway === 'station' || railway === 'halt' || station === 'subway' || highway === 'bus_stop' || amenity === 'taxi') {
    return 'transport';
  }
  if (amenity === 'atm' || amenity === 'bank' || shop === 'money_lender') return 'atm';
  if (amenity === 'pharmacy' || shop === 'chemist') return 'pharmacy';
  if (shop === 'convenience' || shop === 'kiosk') return 'convenience';
  if (tourism === 'information' || information === 'office') return 'tourist_services';
  return null;
}

export function overpassElementToNearby(
  element: OverpassElement,
  query: PlacesSearchQuery,
): NearbyPlace | null {
  const latitude = element.lat;
  const longitude = element.lon;
  const name = element.tags?.name?.trim();
  const nearbyCategory = nearbyCategoryFromOsmTags(element.tags);
  if (latitude == null || longitude == null || !name || !nearbyCategory) return null;
  const meters = distanceMeters(query, { latitude, longitude });
  const cuisine = element.tags?.cuisine ?? '';
  const dietHalal = element.tags?.['diet:halal'];
  const explicitHalal = dietHalal === 'yes' ? true : dietHalal === 'no' ? false : null;
  return normalizePlace({
    id: stablePlaceId('overpass', String(element.id)),
    name,
    nearbyCategory,
    address: [element.tags?.['addr:street'], element.tags?.['addr:city']].filter(Boolean).join(', ') || undefined,
    latitude,
    longitude,
    distanceMeters: Math.round(meters),
    walkMinutes: walkMinutesFromMeters(meters),
    openNow: null,
    halal:
      nearbyCategory === 'food'
        ? inferHalal(name, [cuisine], explicitHalal)
        : null,
    badges: [],
    source: 'overpass',
    externalId: String(element.id),
  });
}

function filtersFor(category: PlacesSearchQuery['category']): string[] {
  const cats = category === 'all' ? [...NEARBY_CATEGORIES] : [category];
  return cats.flatMap((cat) => OVERPASS_FILTERS_BY_NEARBY[cat]);
}

export function buildOverpassQuery(query: PlacesSearchQuery): string {
  const around = `(around:${Math.round(query.radiusMeters)},${query.latitude},${query.longitude})`;
  const clauses = filtersFor(query.category).map((filter) => `  ${filter}${around};`).join('\n');
  return `[out:json][timeout:25];\n(\n${clauses}\n);\nout body;`;
}

export function createOverpassPlacesProvider(config: OverpassConfig = {}): PlacesProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 12_000;
  const endpointUrl = (config.endpointUrl ?? 'https://overpass-api.de/api/interpreter').replace(/\/$/, '');

  return {
    kind: 'overpass',
    async search(query) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'tourist-companion/0.0.0 (nearby helper)',
          },
          body: `data=${encodeURIComponent(buildOverpassQuery(query))}`,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Overpass HTTP ${response.status}`);
        }
        const data = (await response.json()) as { elements?: OverpassElement[] };
        return (data.elements ?? [])
          .map((element) => overpassElementToNearby(element, query))
          .filter((place): place is NearbyPlace => place != null);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
