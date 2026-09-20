export const TRIP_STATUSES = ['draft', 'active', 'completed', 'cancelled'] as const;
export const DAILY_BUDGETS = ['low', 'medium', 'high'] as const;
export const TRAVEL_STYLES = ['relaxed', 'balanced', 'packed'] as const;
export const INTERESTS = [
  'food',
  'nature',
  'culture',
  'shopping',
  'nightlife',
  'family',
  'adventure',
  'wellness',
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];
export type DailyBudget = (typeof DAILY_BUDGETS)[number];
export type TravelStyle = (typeof TRAVEL_STYLES)[number];
export type Interest = (typeof INTERESTS)[number];

export interface Trip {
  id: string;
  userId: string;
  destination: string;
  startDate: string;
  endDate: string;
  adultCount: number;
  childCount: number;
  interests: Interest[];
  dailyBudget: DailyBudget | null;
  travelStyle: TravelStyle | null;
  accommodationName: string | null;
  arrivalAirport: string | null;
  arrivalFlight: string | null;
  arrivalAt: string | null;
  status: TripStatus;
}

export interface CreateTripInput {
  destination: string;
  startDate: string;
  endDate: string;
  adultCount: number;
  childCount: number;
  interests: Interest[];
  dailyBudget?: DailyBudget | null;
  travelStyle?: TravelStyle | null;
  accommodationName?: string | null;
  arrivalAirport?: string | null;
  arrivalFlight?: string | null;
  arrivalAt?: string | null;
  status?: TripStatus;
}

export type UpdateTripInput = Partial<CreateTripInput>;

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

export interface SavedTripPlace {
  tripId: string;
  placeId: string;
  catalogId: string;
  name: string;
  category: PlaceCategory;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  sortOrder: number;
}

export interface SaveTripPlaceInput {
  placeId: string;
  name: string;
  category: PlaceCategory;
  city?: string | null;
  address?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  country?: string | null;
  notes?: string | null;
}

export interface TripStore {
  list(userId: string): Promise<Trip[]>;
  get(userId: string, tripId: string): Promise<Trip | undefined>;
  count(): Promise<number>;
  create(userId: string, input: CreateTripInput): Promise<Trip>;
  update(userId: string, tripId: string, patch: UpdateTripInput): Promise<Trip | undefined>;
  delete(userId: string, tripId: string): Promise<boolean>;
  listPlaces(userId: string, tripId: string): Promise<SavedTripPlace[] | undefined>;
  savePlace(
    userId: string,
    tripId: string,
    input: SaveTripPlaceInput,
  ): Promise<SavedTripPlace | undefined>;
  removePlace(userId: string, tripId: string, placeId: string): Promise<boolean | undefined>;
}
