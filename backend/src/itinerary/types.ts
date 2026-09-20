import type { DayWeatherHint } from '../weather/types.js';

export const ITINERARY_MIN_DAYS = 1;
export const ITINERARY_MAX_DAYS = 7;

export const ITINERARY_ITEM_KINDS = ['activity', 'meal', 'travel', 'note'] as const;
export type ItineraryItemKind = (typeof ITINERARY_ITEM_KINDS)[number];

export const ITINERARY_STATUSES = ['draft', 'active', 'archived'] as const;
export type ItineraryStatus = (typeof ITINERARY_STATUSES)[number];

export interface ItineraryItem {
  id: string;
  dayId: string;
  sortOrder: number;
  kind: ItineraryItemKind;
  startTime: string;
  endTime: string;
  placeId: string | null;
  travelTimeMinutes: number | null;
  notes: string | null;
  bookingUrl: string | null;
  referralPartnerId: string | null;
  locked: boolean;
  title: string | null;
}

export interface ItineraryDay {
  id: string;
  itineraryId: string;
  dayNumber: number;
  date: string;
  items: ItineraryItem[];
  /** Enriched at read time; not stored. */
  weather?: DayWeatherHint | null;
}

export interface Itinerary {
  id: string;
  tripId: string;
  dayCount: number;
  status: ItineraryStatus;
  days: ItineraryDay[];
  generatedAt: string | null;
  updatedAt: string;
}

export interface ItemInput {
  kind: ItineraryItemKind;
  startTime: string;
  endTime: string;
  placeId?: string | null;
  travelTimeMinutes?: number | null;
  notes?: string | null;
  bookingUrl?: string | null;
  referralPartnerId?: string | null;
  locked?: boolean;
  title?: string | null;
  sortOrder?: number;
}

export type PatchItemInput = Partial<ItemInput> & {
  dayId?: string;
  dayNumber?: number;
};

export interface PutDayInput {
  date?: string;
  dayNumber?: number;
  items: ItemInput[];
}

export interface PutItineraryInput {
  status?: ItineraryStatus;
  days?: PutDayInput[];
}

export interface CreateItemInput extends ItemInput {
  dayId?: string;
  dayNumber?: number;
}

export interface ReorderInput {
  dayId: string;
  itemIds: string[];
}

export interface ReplaceUnlockedDayInput {
  dayId?: string;
  dayNumber?: number;
  items: ItemInput[];
}

export interface ReplaceUnlockedInput {
  days: ReplaceUnlockedDayInput[];
  generatedAt: string;
}

export interface ItineraryStore {
  get(userId: string, tripId: string): Promise<Itinerary | undefined>;
  put(userId: string, tripId: string, input: PutItineraryInput): Promise<Itinerary | undefined>;
  createItem(
    userId: string,
    tripId: string,
    input: CreateItemInput,
  ): Promise<Itinerary | undefined>;
  updateItem(
    userId: string,
    tripId: string,
    itemId: string,
    patch: PatchItemInput,
  ): Promise<Itinerary | undefined>;
  deleteItem(userId: string, tripId: string, itemId: string): Promise<Itinerary | undefined>;
  reorder(userId: string, tripId: string, input: ReorderInput): Promise<Itinerary | undefined>;
  replaceUnlocked(
    userId: string,
    tripId: string,
    input: ReplaceUnlockedInput,
  ): Promise<Itinerary | undefined>;
}
