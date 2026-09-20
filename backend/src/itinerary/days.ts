import { ValidationError } from '../errors.js';
import {
  ITINERARY_MAX_DAYS,
  ITINERARY_MIN_DAYS,
  type ItineraryDay,
  type ItineraryItem,
  type ItemInput,
} from './types.js';

const MS_PER_DAY = 86_400_000;

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function inclusiveDaySpan(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.floor((end - start) / MS_PER_DAY) + 1;
}

export function clipDayCount(startDate: string, endDate: string): number {
  const span = inclusiveDaySpan(startDate, endDate);
  return Math.min(ITINERARY_MAX_DAYS, Math.max(ITINERARY_MIN_DAYS, span));
}

export function skeletonDates(startDate: string, endDate: string): string[] {
  const count = clipDayCount(startDate, endDate);
  return Array.from({ length: count }, (_, index) => addCalendarDays(startDate, index));
}

export function timeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const minutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function itemsOverlap(a: Pick<ItemInput, 'startTime' | 'endTime'>, b: Pick<ItemInput, 'startTime' | 'endTime'>): boolean {
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
}

export function assertNoOverlaps(items: Array<Pick<ItemInput, 'startTime' | 'endTime'>>): void {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (itemsOverlap(items[i], items[j])) {
        throw new ValidationError('Itinerary items on a day must not overlap', {
          startTime: items[i].startTime,
          endTime: items[i].endTime,
        });
      }
    }
  }
}

export function sortItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

export function sortDays(days: ItineraryDay[]): ItineraryDay[] {
  return [...days]
    .sort((a, b) => a.dayNumber - b.dayNumber || a.date.localeCompare(b.date))
    .map((day) => ({ ...day, items: sortItems(day.items) }));
}

export function nextSortOrder(items: ItineraryItem[], startTime: string): number {
  const sameOrEarlier = items.filter((item) => item.startTime <= startTime);
  if (sameOrEarlier.length === 0) {
    return items.length === 0 ? 0 : Math.min(...items.map((item) => item.sortOrder));
  }
  return Math.max(...sameOrEarlier.map((item) => item.sortOrder)) + 1;
}

export function normalizeItemFields(input: ItemInput): Omit<ItineraryItem, 'id' | 'dayId'> {
  return {
    sortOrder: input.sortOrder ?? 0,
    kind: input.kind,
    startTime: input.startTime,
    endTime: input.endTime,
    placeId: input.placeId ?? null,
    travelTimeMinutes: input.travelTimeMinutes ?? null,
    notes: input.notes ?? null,
    bookingUrl: input.bookingUrl ?? null,
    referralPartnerId: input.referralPartnerId ?? null,
    locked: input.locked ?? false,
    title: input.title ?? null,
  };
}
