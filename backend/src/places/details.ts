import type { AppConfig } from '../config.js';
import { NotFoundError } from '../errors.js';
import { createPlacesProvider } from './factory.js';
import { approximateLocation } from './geo.js';
import { createSeedPlacesProvider } from './seed-provider.js';
import {
  DEFAULT_NEARBY_AREA_ID,
  NEARBY_AREAS,
  type PlaceDetails,
  type PlacesProviderKind,
} from './types.js';

export { buildPlaceActions, googleDirectionsUrl, toPlaceDetails } from './place-view.js';

export interface PlaceDetailsInput {
  id: string;
  latitude?: number;
  longitude?: number;
  now?: Date;
}

export interface PlaceDetailsDeps {
  fetchImpl?: typeof fetch;
}

const defaultOrigin = {
  latitude: NEARBY_AREAS.find((area) => area.id === DEFAULT_NEARBY_AREA_ID)!.latitude,
  longitude: NEARBY_AREAS.find((area) => area.id === DEFAULT_NEARBY_AREA_ID)!.longitude,
};

export function parseStoredPlaceId(id: string): {
  kind: PlacesProviderKind | 'seed';
  lookupId: string;
} {
  if (id.startsWith('google:')) return { kind: 'google', lookupId: id.slice('google:'.length) };
  if (id.startsWith('overpass:')) return { kind: 'overpass', lookupId: id.slice('overpass:'.length) };
  if (id.startsWith('seed:')) return { kind: 'seed', lookupId: id.slice('seed:'.length) };
  return { kind: 'seed', lookupId: id };
}

export async function getPlaceDetails(
  config: AppConfig,
  input: PlaceDetailsInput,
  deps: PlaceDetailsDeps = {},
): Promise<PlaceDetails> {
  const now = input.now ?? new Date();
  const hasPin = input.latitude != null && input.longitude != null;
  const origin = hasPin
    ? approximateLocation({ latitude: input.latitude!, longitude: input.longitude! })
    : defaultOrigin;
  const query = { origin, now };
  const { kind, lookupId } = parseStoredPlaceId(input.id);
  const provider = createPlacesProvider(config, deps);
  const seed = createSeedPlacesProvider();

  if (kind === 'seed') {
    const fromSeed = await seed.get?.(lookupId, query);
    if (fromSeed) return fromSeed;
    throw new NotFoundError('Place not found');
  }

  if (provider.kind === kind && provider.get) {
    try {
      const fromProvider = await provider.get(input.id, query);
      if (fromProvider) return fromProvider;
    } catch {
      const fallback = await seed.get?.(lookupId, query);
      if (fallback) return fallback;
      throw new NotFoundError('Place not found');
    }
  }

  const fallback = await seed.get?.(lookupId, query);
  if (fallback) return fallback;
  throw new NotFoundError('Place not found');
}
