import {
  DEFAULT_NEARBY_AREA_ID,
  NEARBY_AREAS,
  type GeoPoint,
} from '../places/types.js';

const EXTRA: Array<{ re: RegExp; latitude: number; longitude: number }> = [
  { re: /langkawi/, latitude: 6.35, longitude: 99.8 },
  { re: /penang|george town|georgetown/, latitude: 5.4141, longitude: 100.3288 },
  { re: /malacca|melaka/, latitude: 2.1896, longitude: 102.2501 },
  { re: /johor/, latitude: 1.4927, longitude: 103.7414 },
];

export function coordinatesForDestination(destination: string): GeoPoint {
  const dest = destination.trim().toLowerCase();
  const named = NEARBY_AREAS.find(
    (area) =>
      dest.includes(area.label.toLowerCase()) || dest.includes(area.id.replaceAll('_', ' ')),
  );
  if (named) {
    return { latitude: named.latitude, longitude: named.longitude };
  }
  const extra = EXTRA.find((entry) => entry.re.test(dest));
  if (extra) {
    return { latitude: extra.latitude, longitude: extra.longitude };
  }
  const fallback = NEARBY_AREAS.find((area) => area.id === DEFAULT_NEARBY_AREA_ID)!;
  return { latitude: fallback.latitude, longitude: fallback.longitude };
}
