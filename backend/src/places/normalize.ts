import { PLACE_CATEGORY_BY_NEARBY, type NearbyCategory, type NearbyPlace } from './types.js';

const HALAL_RE = /\bhalal\b/i;

export function nearbyCategoryToPlaceCategory(nearby: NearbyCategory) {
  return PLACE_CATEGORY_BY_NEARBY[nearby];
}

export function inferHalal(name: string, types: string[] = [], explicit?: boolean | null): boolean | null {
  if (explicit === true || explicit === false) return explicit;
  if (HALAL_RE.test(name) || types.some((type) => HALAL_RE.test(type))) return true;
  return null;
}

export function stablePlaceId(source: NearbyPlace['source'], externalId: string): string {
  return `${source}:${externalId}`;
}

export function emptyBadges(badges?: string[]): string[] {
  return badges?.filter((badge) => badge.trim().length > 0) ?? [];
}

export function normalizePlace(partial: Omit<NearbyPlace, 'category' | 'badges' | 'country'> & {
  category?: NearbyPlace['category'];
  badges?: string[];
  country?: string;
}): NearbyPlace {
  return {
    ...partial,
    category: partial.category ?? nearbyCategoryToPlaceCategory(partial.nearbyCategory),
    country: partial.country ?? 'MY',
    badges: emptyBadges(partial.badges),
    city: partial.city ?? 'Kuala Lumpur',
  };
}
