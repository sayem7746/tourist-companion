import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type DailyBudget = 'low' | 'medium' | 'high';
export type TravelStyle = 'relaxed' | 'balanced' | 'packed';
export type TripInterest =
  | 'food'
  | 'nature'
  | 'culture'
  | 'shopping'
  | 'nightlife'
  | 'family'
  | 'adventure'
  | 'wellness';

export interface Trip {
  id: string;
  userId: string;
  destination: string;
  startDate: string;
  endDate: string;
  adultCount: number;
  childCount: number;
  interests: TripInterest[];
  dailyBudget: DailyBudget | null;
  travelStyle: TravelStyle | null;
}

export interface CreateTripRequest {
  destination: string;
  startDate: string;
  endDate: string;
  adultCount: number;
  childCount: number;
  interests: TripInterest[];
  dailyBudget?: DailyBudget | null;
  travelStyle?: TravelStyle | null;
}

export type PlaceCategory =
  | 'airport'
  | 'attraction'
  | 'food'
  | 'lodging'
  | 'transport'
  | 'shopping'
  | 'safety'
  | 'other';

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

export const ITINERARY_ITEM_KINDS = ['activity', 'meal', 'travel', 'note'] as const;
export type ItineraryItemKind = (typeof ITINERARY_ITEM_KINDS)[number];
export type ItineraryStatus = 'draft' | 'active' | 'archived';

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
}

export interface Itinerary {
  id: string;
  tripId: string;
  dayCount: number;
  status: ItineraryStatus;
  days: ItineraryDay[];
  generatedAt: string | null;
  updatedAt?: string;
}

export type TimelineRow =
  | {
      type: 'commute';
      minutes: number;
      title: string | null;
      directionsHref: string | null;
      item?: ItineraryItem;
    }
  | { type: 'block'; item: ItineraryItem };

export interface CreateItineraryItemRequest {
  kind: ItineraryItemKind;
  startTime: string;
  endTime: string;
  dayId?: string;
  dayNumber?: number;
  placeId?: string | null;
  travelTimeMinutes?: number | null;
  notes?: string | null;
  bookingUrl?: string | null;
  title?: string | null;
  sortOrder?: number;
}

export type PatchItineraryItemRequest = Partial<
  Omit<CreateItineraryItemRequest, 'dayId' | 'dayNumber'>
> & {
  dayId?: string;
  dayNumber?: number;
  locked?: boolean;
};

export function itineraryIsEmpty(itinerary: Itinerary | null | undefined): boolean {
  return !itinerary || itinerary.days.every((day) => day.items.length === 0);
}

export function highlightCount(day: ItineraryDay | null | undefined): number {
  if (!day) {
    return 0;
  }
  return day.items.filter((item) => item.kind === 'activity' || item.kind === 'meal').length;
}

export function selectPlanDayNumber(itinerary: Itinerary, today: string): number {
  const match = itinerary.days.find((day) => day.date === today);
  return match?.dayNumber ?? itinerary.days[0]?.dayNumber ?? 1;
}

export function formatTime12h(hhmm: string): string {
  const [hourPart, minutePart] = hhmm.split(':');
  const hour = Number(hourPart);
  const minutes = minutePart ?? '00';
  if (!Number.isFinite(hour)) {
    return hhmm;
  }
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, '0')}:${minutes} ${suffix}`;
}

export function formatPlanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function timeToMinutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(':').map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(totalMinutes: number): string {
  const minutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function timesOverlap(
  a: Pick<ItineraryItem, 'startTime' | 'endTime'>,
  b: Pick<ItineraryItem, 'startTime' | 'endTime'>,
): boolean {
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
}

export function orderedDayItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

export function neighborItem(
  items: ItineraryItem[],
  itemId: string,
  direction: 'up' | 'down',
): ItineraryItem | null {
  const ordered = orderedDayItems(items);
  const index = ordered.findIndex((item) => item.id === itemId);
  if (index < 0) {
    return null;
  }
  return ordered[direction === 'up' ? index - 1 : index + 1] ?? null;
}

export function movedItemIds(itemIds: string[], itemId: string, direction: 'up' | 'down'): string[] | null {
  const index = itemIds.indexOf(itemId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= itemIds.length) {
    return null;
  }
  const next = [...itemIds];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  return next;
}

export function findTempTimeSlot(
  items: ItineraryItem[],
  durationMinutes = 1,
): { startTime: string; endTime: string } | null {
  if (durationMinutes < 1) {
    return null;
  }
  for (let start = 23 * 60 + 59 - durationMinutes; start >= 0; start -= 1) {
    const candidate = {
      startTime: minutesToTime(start),
      endTime: minutesToTime(start + durationMinutes),
    };
    if (!items.some((item) => timesOverlap(item, candidate))) {
      return candidate;
    }
  }
  return null;
}

export function nextActivityTimes(
  items: ItineraryItem[],
  durationMinutes = 90,
): { startTime: string; endTime: string } {
  const last = orderedDayItems(items).at(-1);
  let start = last ? timeToMinutes(last.endTime) + 30 : 9 * 60 + 30;
  let end = start + durationMinutes;
  if (end > 23 * 60 + 30) {
    start = Math.max(0, 23 * 60 + 30 - durationMinutes);
    end = start + durationMinutes;
  }
  const proposed = { startTime: minutesToTime(start), endTime: minutesToTime(end) };
  if (!items.some((item) => timesOverlap(item, proposed))) {
    return proposed;
  }
  return findTempTimeSlot(items, durationMinutes) ?? proposed;
}

function blockMinutes(item: ItineraryItem): number {
  if (item.travelTimeMinutes != null && item.travelTimeMinutes > 0) {
    return item.travelTimeMinutes;
  }
  const span = timeToMinutes(item.endTime) - timeToMinutes(item.startTime);
  return span > 0 ? span : 0;
}

export function directionsHref(
  item: Pick<ItineraryItem, 'placeId' | 'title'>,
  savedPlaces: SavedTripPlace[],
): string | null {
  const saved = item.placeId
    ? savedPlaces.find((place) => place.placeId === item.placeId)
    : undefined;
  if (saved?.latitude != null && saved.longitude != null) {
    const query = new URLSearchParams({
      api: '1',
      destination: `${saved.latitude},${saved.longitude}`,
      travelmode: 'walking',
    });
    return `https://www.google.com/maps/dir/?${query.toString()}`;
  }
  const queryText = item.title?.trim() || saved?.name;
  if (queryText) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;
  }
  return null;
}

export function buildTimeline(items: ItineraryItem[], savedPlaces: SavedTripPlace[] = []): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let lastWasCommute = false;
  for (const item of items) {
    if (item.kind === 'travel') {
      rows.push({
        type: 'commute',
        minutes: blockMinutes(item),
        title: item.title,
        directionsHref: directionsHref(item, savedPlaces),
        item,
      });
      lastWasCommute = true;
      continue;
    }
    const inbound = item.travelTimeMinutes != null && item.travelTimeMinutes > 0;
    if (inbound && !lastWasCommute) {
      rows.push({
        type: 'commute',
        minutes: item.travelTimeMinutes ?? 0,
        title: null,
        directionsHref: directionsHref(item, savedPlaces),
      });
    }
    rows.push({ type: 'block', item });
    lastWasCommute = false;
  }
  return rows;
}

export function localTodayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function inclusiveDayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }
  return Math.round((end - start) / 86_400_000) + 1;
}

export function selectFeaturedTrip(trips: Trip[], today: string): Trip | null {
  const current = trips.filter((trip) => trip.startDate <= today && today <= trip.endDate);
  if (current.length > 0) {
    return [...current].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))[0];
  }
  const upcoming = trips.filter((trip) => trip.startDate > today);
  if (upcoming.length > 0) {
    return [...upcoming].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))[0];
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class TripService {
  private readonly base = `${environment.apiBaseUrl}/trips`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<{ trips: Trip[] }> {
    return this.http.get<{ trips: Trip[] }>(this.base, { withCredentials: true });
  }

  create(body: CreateTripRequest): Observable<{ trip: Trip }> {
    return this.http.post<{ trip: Trip }>(this.base, body, { withCredentials: true });
  }

  update(id: string, body: Partial<CreateTripRequest>): Observable<{ trip: Trip }> {
    return this.http.patch<{ trip: Trip }>(`${this.base}/${id}`, body, { withCredentials: true });
  }

  listPlaces(tripId: string): Observable<{ places: SavedTripPlace[] }> {
    return this.http.get<{ places: SavedTripPlace[] }>(`${this.base}/${tripId}/places`, {
      withCredentials: true,
    });
  }

  savePlace(tripId: string, placeId: string): Observable<{ place: SavedTripPlace }> {
    return this.http.post<{ place: SavedTripPlace }>(
      `${this.base}/${tripId}/places`,
      { placeId },
      { withCredentials: true },
    );
  }

  removePlace(tripId: string, placeId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${tripId}/places/${encodeURIComponent(placeId)}`, {
      withCredentials: true,
    });
  }

  getItinerary(tripId: string): Observable<{ itinerary: Itinerary }> {
    return this.http.get<{ itinerary: Itinerary }>(`${this.base}/${tripId}/itinerary`, {
      withCredentials: true,
    });
  }

  generateItinerary(
    tripId: string,
    body: { dayId?: string; dayNumber?: number } = {},
  ): Observable<{ itinerary: Itinerary }> {
    return this.http.post<{ itinerary: Itinerary }>(`${this.base}/${tripId}/itinerary/generate`, body, {
      withCredentials: true,
    });
  }

  createItem(tripId: string, body: CreateItineraryItemRequest): Observable<{ itinerary: Itinerary }> {
    return this.http.post<{ itinerary: Itinerary }>(`${this.base}/${tripId}/itinerary/items`, body, {
      withCredentials: true,
    });
  }

  updateItem(
    tripId: string,
    itemId: string,
    body: PatchItineraryItemRequest,
  ): Observable<{ itinerary: Itinerary }> {
    return this.http.patch<{ itinerary: Itinerary }>(
      `${this.base}/${tripId}/itinerary/items/${encodeURIComponent(itemId)}`,
      body,
      { withCredentials: true },
    );
  }

  deleteItem(tripId: string, itemId: string): Observable<{ itinerary: Itinerary }> {
    return this.http.delete<{ itinerary: Itinerary }>(
      `${this.base}/${tripId}/itinerary/items/${encodeURIComponent(itemId)}`,
      { withCredentials: true },
    );
  }

  reorderItems(tripId: string, dayId: string, itemIds: string[]): Observable<{ itinerary: Itinerary }> {
    return this.http.post<{ itinerary: Itinerary }>(
      `${this.base}/${tripId}/itinerary/reorder`,
      { dayId, itemIds },
      { withCredentials: true },
    );
  }
}
