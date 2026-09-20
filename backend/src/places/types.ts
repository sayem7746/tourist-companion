export const PLACE_CATEGORIES = [
  'airport',
  'attraction',
  'food',
  'lodging',
  'transport',
  'shopping',
  'safety',
  'other',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const NEARBY_CATEGORIES = [
  'food',
  'attractions',
  'transport',
  'atm',
  'pharmacy',
  'convenience',
  'tourist_services',
] as const;

export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number];

export const NEARBY_CHIP_IDS = ['all', ...NEARBY_CATEGORIES] as const;
export type NearbyChipId = (typeof NEARBY_CHIP_IDS)[number];

export interface NearbyCategoryChip {
  id: NearbyChipId;
  label: string;
  icon: string;
}

export const NEARBY_CATEGORY_CHIPS: NearbyCategoryChip[] = [
  { id: 'all', label: 'All', icon: '' },
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

export const PLACE_CATEGORY_BY_NEARBY: Record<NearbyCategory, PlaceCategory> = {
  food: 'food',
  attractions: 'attraction',
  transport: 'transport',
  atm: 'other',
  pharmacy: 'safety',
  convenience: 'shopping',
  tourist_services: 'other',
};

export const PLACES_PROVIDER_KINDS = ['seed', 'google', 'overpass'] as const;
export type PlacesProviderKind = (typeof PLACES_PROVIDER_KINDS)[number];

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

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

export const NEARBY_AREA_IDS = NEARBY_AREAS.map((area) => area.id) as [string, ...string[]];

export const DEFAULT_NEARBY_AREA_ID = 'klcc';

export const WALK_METERS_PER_MINUTE = 80;
export const WALK_15_MAX_METERS = 15 * WALK_METERS_PER_MINUTE;

export interface WeeklyHoursSlot {
  /** 0 = Sunday … 6 = Saturday (JS Date#getUTCDay / local getDay). */
  day: number;
  openMinutes: number;
  closeMinutes: number;
}

export interface NearbyPlace {
  id: string;
  name: string;
  category: PlaceCategory;
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
  source: PlacesProviderKind;
  externalId?: string;
}

export interface MalaysiaPlaceSeedRecord {
  id: string;
  name: string;
  nearbyCategory: NearbyCategory;
  city: string;
  country: 'MY';
  area: string;
  address: string;
  description: string;
  latitude: number;
  longitude: number;
  alwaysOpen?: boolean;
  hours?: WeeklyHoursSlot[];
  halal?: boolean | null;
  englishSpoken?: boolean | null;
  badges: string[];
  priceBandMyr?: string;
}

export interface MalaysiaPlacesSeed {
  country: 'MY';
  destination: 'Malaysia';
  version: string;
  areas: NearbyArea[];
  places: MalaysiaPlaceSeedRecord[];
}

export interface PlacesSearchQuery {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  category: NearbyChipId;
  q?: string;
  openNow?: boolean;
  halalOnly?: boolean;
  walk15?: boolean;
  now?: Date;
}

export interface PlacesSearchResult {
  provider: PlacesProviderKind;
  fallback: boolean;
  origin: GeoPoint;
  areaId: string | null;
  areaLabel: string | null;
  radiusMeters: number;
  category: NearbyChipId;
  q: string | null;
  quickFilters: NearbyQuickFilter[];
  chips: NearbyCategoryChip[];
  counts: Record<NearbyChipId, number>;
  places: NearbyPlace[];
}

export interface PlacesProvider {
  readonly kind: PlacesProviderKind;
  search(query: PlacesSearchQuery): Promise<NearbyPlace[]>;
}
