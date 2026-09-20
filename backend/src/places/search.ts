import type { AppConfig } from '../config.js';
import { createPlacesProvider } from './factory.js';
import { assemblePlacesResult } from './filter.js';
import { createSeedPlacesProvider } from './seed-provider.js';
import {
  DEFAULT_NEARBY_AREA_ID,
  NEARBY_AREAS,
  type NearbyChipId,
  type PlacesSearchResult,
} from './types.js';

export interface NearbySearchInput {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  category?: NearbyChipId;
  q?: string;
  openNow?: boolean;
  halalOnly?: boolean;
  walk15?: boolean;
  areaId?: string;
  now?: Date;
}

export interface NearbySearchDeps {
  fetchImpl?: typeof fetch;
}

export async function searchNearbyPlaces(
  config: AppConfig,
  input: NearbySearchInput,
  deps: NearbySearchDeps = {},
): Promise<PlacesSearchResult> {
  const area =
    NEARBY_AREAS.find((item) => item.id === input.areaId) ??
    (input.latitude == null || input.longitude == null
      ? NEARBY_AREAS.find((item) => item.id === DEFAULT_NEARBY_AREA_ID)
      : undefined);

  const latitude = input.latitude ?? area!.latitude;
  const longitude = input.longitude ?? area!.longitude;
  const radiusMeters = input.radiusMeters ?? area?.radiusMeters ?? 2000;
  const category = input.category ?? 'all';

  const query = {
    latitude,
    longitude,
    radiusMeters,
    category,
    q: input.q,
    openNow: input.openNow,
    halalOnly: input.halalOnly,
    walk15: input.walk15,
    now: input.now,
  };

  const provider = createPlacesProvider(config, deps);
  let fallback = false;
  let places;
  try {
    places = await provider.search(query);
  } catch (error) {
    if (provider.kind === 'seed') throw error;
    fallback = true;
    places = await createSeedPlacesProvider().search(query);
  }

  return assemblePlacesResult(places, query, {
    provider: fallback ? 'seed' : provider.kind,
    fallback,
    areaId: area?.id ?? null,
    areaLabel: area?.label ?? null,
  });
}
