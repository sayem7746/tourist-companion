import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const EXPLORE_SEARCH_HEIGHT_PX = 52;
export const EXPLORE_SEARCH_PLACEHOLDER = 'Search food, sights, ATMs, pharmacies...';
export const SOS_COLOR = '#E11D48';
export const BOOKMARK_GOLD = '#D97706';
export const SOS_NUMBERS = [
  { code: '999', label: 'Police, fire, ambulance' },
  { code: '112', label: 'Mobile networks' },
] as const;

export const NEARBY_CHIP_IDS = [
  'all',
  'food',
  'attractions',
  'transport',
  'atm',
  'pharmacy',
  'convenience',
  'tourist_services',
] as const;
export type NearbyChipId = (typeof NEARBY_CHIP_IDS)[number];
export type NearbyCategory = Exclude<NearbyChipId, 'all'>;

export interface NearbyCategoryChip {
  id: NearbyChipId;
  label: string;
  icon: string;
}

export const NEARBY_CATEGORY_CHIPS: NearbyCategoryChip[] = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'food', label: 'Food & Halal', icon: 'restaurant' },
  { id: 'attractions', label: 'Must-See Sights', icon: 'photo_camera' },
  { id: 'transport', label: 'Transit', icon: 'directions_transit' },
  { id: 'atm', label: 'ATMs', icon: 'atm' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'local_pharmacy' },
  { id: 'convenience', label: 'Convenience', icon: 'local_convenience_store' },
  { id: 'tourist_services', label: 'Tourist services', icon: 'info' },
];

export const NEARBY_QUICK_FILTERS = ['open_now', 'halal_only', 'walk_15'] as const;
export type NearbyQuickFilter = (typeof NEARBY_QUICK_FILTERS)[number];

export const NEARBY_QUICK_FILTER_CHIPS: Array<{ id: NearbyQuickFilter; label: string }> = [
  { id: 'open_now', label: 'Open Now' },
  { id: 'halal_only', label: 'Halal Only' },
  { id: 'walk_15', label: '≤ 15 min walk' },
];

export interface NearbyArea {
  id: string;
  label: string;
  radiusMeters: number;
  latitude: number;
  longitude: number;
}

export const NEARBY_AREAS: NearbyArea[] = [
  {
    id: 'klcc',
    label: 'KLCC & Downtown',
    radiusMeters: 2000,
    latitude: 3.15785,
    longitude: 101.71165,
  },
  {
    id: 'bukit_bintang',
    label: 'Bukit Bintang',
    radiusMeters: 1500,
    latitude: 3.1466,
    longitude: 101.711,
  },
  {
    id: 'batu_caves',
    label: 'Batu Caves',
    radiusMeters: 2500,
    latitude: 3.2379,
    longitude: 101.684,
  },
];

export const DEFAULT_NEARBY_AREA_ID = 'klcc';

export interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  nearbyCategory: NearbyCategory;
  city?: string;
  country?: string;
  area?: string;
  address?: string;
  description?: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  walkMinutes?: number;
  openNow?: boolean | null;
  halal?: boolean | null;
  englishSpoken?: boolean | null;
  badges: string[];
  priceBandMyr?: string;
  source: string;
  externalId?: string;
}

export interface LicensedPlacePhoto {
  url: string;
  license: string;
  attribution: string;
  sourceUrl?: string;
}

export type PlaceActionKind = 'directions' | 'call' | 'website' | 'booking';

export interface PlaceExternalAction {
  kind: PlaceActionKind;
  label: string;
  href: string;
}

export interface PlaceDetails extends NearbyPlace {
  phone?: string;
  website?: string;
  bookingUrl?: string;
  bookingLabel?: string;
  hoursSummary?: string | null;
  hoursLines: string[];
  photos: LicensedPlacePhoto[];
  actions: PlaceExternalAction[];
}

export interface NearbySearchResult {
  provider: string;
  fallback: boolean;
  origin: { latitude: number; longitude: number };
  areaId: string | null;
  areaLabel: string | null;
  radiusMeters: number;
  category: NearbyChipId;
  q: string | null;
  quickFilters: NearbyQuickFilter[];
  chips: NearbyCategoryChip[];
  counts: Partial<Record<NearbyChipId, number>>;
  places: NearbyPlace[];
}

export interface NearbyQuery {
  category?: NearbyChipId;
  q?: string;
  area?: string;
  openNow?: boolean;
  halalOnly?: boolean;
  walk15?: boolean;
}

export interface MapPin {
  id: string;
  name: string;
  left: number;
  top: number;
}

const CATEGORY_COVER: Record<NearbyCategory, string> = {
  food: '#d97706',
  attractions: '#0d7652',
  transport: '#1d4ed8',
  atm: '#334155',
  pharmacy: '#0f766e',
  convenience: '#7c3aed',
  tourist_services: '#0369a1',
};

export function nearbyHttpParams(query: NearbyQuery): HttpParams {
  let params = new HttpParams();
  if (query.category && query.category !== 'all') {
    params = params.set('category', query.category);
  }
  const q = query.q?.trim() ?? '';
  if (q.length >= 2) {
    params = params.set('q', q.slice(0, 80));
  }
  if (query.area) {
    params = params.set('area', query.area);
  }
  if (query.openNow) {
    params = params.set('openNow', 'true');
  }
  if (query.halalOnly) {
    params = params.set('halalOnly', 'true');
  }
  if (query.walk15) {
    params = params.set('walk15', 'true');
  }
  return params;
}

export function formatDistance(place: Pick<NearbyPlace, 'distanceMeters' | 'walkMinutes'>): string {
  const meters = place.distanceMeters;
  if (meters == null) {
    return '';
  }
  const dist = meters >= 1000 ? `${(meters / 1000).toFixed(1).replace(/\.0$/, '')} km` : `${Math.round(meters)}m`;
  if (place.walkMinutes != null && meters < 2500) {
    return `${dist} • ${place.walkMinutes} min walk`;
  }
  return dist;
}

export function openingStatus(place: Pick<NearbyPlace, 'openNow'>): string | null {
  if (place.openNow === true) {
    return 'Open now';
  }
  if (place.openNow === false) {
    return 'Closed';
  }
  return null;
}

export function directionsUrl(place: Pick<NearbyPlace, 'latitude' | 'longitude'>): string {
  const query = new URLSearchParams({
    api: '1',
    destination: `${place.latitude},${place.longitude}`,
    travelmode: 'walking',
  });
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

export function coverTone(category: NearbyCategory): string {
  return CATEGORY_COVER[category];
}

export function actionButtonClass(kind: PlaceActionKind): string {
  return kind === 'directions' || kind === 'booking' ? 'btn' : 'btn btn-secondary';
}

export function mapPins(
  places: Array<Pick<NearbyPlace, 'id' | 'name' | 'latitude' | 'longitude'>>,
  origin: { latitude: number; longitude: number },
  radiusMeters: number,
): MapPin[] {
  const span = Math.max(radiusMeters, 400) / 111_000;
  return places.slice(0, 24).map((place) => {
    const x = (place.longitude - origin.longitude) / (span * Math.cos((origin.latitude * Math.PI) / 180));
    const y = (origin.latitude - place.latitude) / span;
    return {
      id: place.id,
      name: place.name,
      left: clampPercent(50 + x * 38),
      top: clampPercent(50 + y * 38),
    };
  });
}

function clampPercent(value: number): number {
  return Math.min(92, Math.max(8, value));
}

@Injectable({ providedIn: 'root' })
export class ExploreService {
  private readonly nearbyUrl = `${environment.apiBaseUrl}/places/nearby`;
  private readonly placesUrl = `${environment.apiBaseUrl}/places`;

  constructor(private readonly http: HttpClient) {}

  nearby(query: NearbyQuery): Observable<NearbySearchResult> {
    return this.http.get<NearbySearchResult>(this.nearbyUrl, { params: nearbyHttpParams(query) });
  }

  place(id: string): Observable<PlaceDetails> {
    return this.http.get<PlaceDetails>(`${this.placesUrl}/${encodeURIComponent(id)}`);
  }
}
