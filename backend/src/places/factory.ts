import type { AppConfig } from '../config.js';
import { hasUsableApiKey } from '../config.js';
import { createGooglePlacesProvider } from './google-provider.js';
import { createOverpassPlacesProvider } from './overpass-provider.js';
import { createSeedPlacesProvider } from './seed-provider.js';
import type { PlacesProvider, PlacesProviderKind } from './types.js';

export interface PlacesProviderDeps {
  fetchImpl?: typeof fetch;
}

export function resolvePlacesProviderKind(config: AppConfig): PlacesProviderKind {
  const requested = config.PLACES_PROVIDER;
  if (requested === 'google') {
    return hasUsableApiKey(config.GOOGLE_PLACES_API_KEY) ? 'google' : 'seed';
  }
  if (requested === 'overpass') return 'overpass';
  if (requested === 'seed') return 'seed';
  if (hasUsableApiKey(config.GOOGLE_PLACES_API_KEY)) return 'google';
  return 'seed';
}

export function createPlacesProvider(
  config: AppConfig,
  deps: PlacesProviderDeps = {},
): PlacesProvider {
  const kind = resolvePlacesProviderKind(config);
  if (kind === 'google' && config.GOOGLE_PLACES_API_KEY) {
    return createGooglePlacesProvider({
      apiKey: config.GOOGLE_PLACES_API_KEY,
      baseUrl: config.GOOGLE_PLACES_BASE_URL,
      fetchImpl: deps.fetchImpl,
    });
  }
  if (kind === 'overpass') {
    return createOverpassPlacesProvider({
      endpointUrl: config.OVERPASS_URL,
      fetchImpl: deps.fetchImpl,
    });
  }
  return createSeedPlacesProvider();
}
