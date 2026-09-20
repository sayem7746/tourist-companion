import { WALK_METERS_PER_MINUTE, type GeoPoint } from './types.js';

const EARTH_RADIUS_METERS = 6_371_000;

/** ~111 m at the equator — enough for nearby search without storing a precise pin. */
export const APPROXIMATE_LOCATION_DECIMALS = 3;

export function approximateLocation(
  point: GeoPoint,
  decimals = APPROXIMATE_LOCATION_DECIMALS,
): GeoPoint {
  const factor = 10 ** decimals;
  return {
    latitude: Math.round(point.latitude * factor) / factor,
    longitude: Math.round(point.longitude * factor) / factor,
  };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkMinutesFromMeters(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_METERS_PER_MINUTE));
}
