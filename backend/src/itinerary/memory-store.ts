import { randomUUID } from 'node:crypto';
import { ValidationError } from '../errors.js';
import type { TripStore } from '../trips/types.js';
import {
  assertNoOverlaps,
  clipDayCount,
  nextSortOrder,
  normalizeItemFields,
  skeletonDates,
  sortDays,
  sortItems,
} from './days.js';
import type {
  CreateItemInput,
  Itinerary,
  ItineraryDay,
  ItineraryItem,
  ItineraryStore,
  ItemInput,
  PatchItemInput,
  PutItineraryInput,
  ReorderInput,
  ReplaceUnlockedInput,
} from './types.js';

function isoNow(): string {
  return new Date().toISOString();
}

function clone(itinerary: Itinerary): Itinerary {
  return {
    ...itinerary,
    days: sortDays(itinerary.days).map((day) => ({
      ...day,
      items: day.items.map((item) => ({ ...item })),
    })),
  };
}

export function createMemoryItineraryStore(trips: TripStore): ItineraryStore {
  const byTrip = new Map<string, Itinerary>();

  const ownedTrip = async (userId: string, tripId: string) => trips.get(userId, tripId);

  const align = (itinerary: Itinerary, startDate: string, endDate: string): Itinerary => {
    const dates = skeletonDates(startDate, endDate);
    const byDate = new Map(itinerary.days.map((day) => [day.date, day]));
    const days: ItineraryDay[] = dates.map((date, index) => {
      const existing = byDate.get(date);
      if (existing) {
        return { ...existing, dayNumber: index + 1 };
      }
      return {
        id: randomUUID(),
        itineraryId: itinerary.id,
        dayNumber: index + 1,
        date,
        items: [],
      };
    });
    const aligned: Itinerary = {
      ...itinerary,
      dayCount: dates.length,
      days,
    };
    byTrip.set(itinerary.tripId, aligned);
    return aligned;
  };

  const ensure = async (userId: string, tripId: string): Promise<Itinerary | undefined> => {
    const trip = await ownedTrip(userId, tripId);
    if (!trip) return undefined;
    const existing = byTrip.get(tripId);
    if (existing) {
      return align(existing, trip.startDate, trip.endDate);
    }
    const now = isoNow();
    const dates = skeletonDates(trip.startDate, trip.endDate);
    const itineraryId = randomUUID();
    const itinerary: Itinerary = {
      id: itineraryId,
      tripId,
      dayCount: clipDayCount(trip.startDate, trip.endDate),
      status: 'draft',
      generatedAt: null,
      updatedAt: now,
      days: dates.map((date, index) => ({
        id: randomUUID(),
        itineraryId,
        dayNumber: index + 1,
        date,
        items: [],
      })),
    };
    byTrip.set(tripId, itinerary);
    return itinerary;
  };

  const findDay = (itinerary: Itinerary, dayId?: string, dayNumber?: number): ItineraryDay => {
    const day = dayId
      ? itinerary.days.find((entry) => entry.id === dayId)
      : itinerary.days.find((entry) => entry.dayNumber === dayNumber);
    if (!day) {
      throw new ValidationError('Itinerary day not found');
    }
    return day;
  };

  const replaceDayItems = (itinerary: Itinerary, day: ItineraryDay, items: ItineraryItem[]): void => {
    assertNoOverlaps(items);
    day.items = sortItems(items);
    itinerary.updatedAt = isoNow();
  };

  const toStoredItem = (dayId: string, input: ItemInput, sortOrder: number): ItineraryItem => ({
    id: randomUUID(),
    dayId,
    ...normalizeItemFields({ ...input, sortOrder }),
  });

  return {
    async get(userId, tripId) {
      const itinerary = await ensure(userId, tripId);
      return itinerary ? clone(itinerary) : undefined;
    },
    async put(userId, tripId, input: PutItineraryInput) {
      const itinerary = await ensure(userId, tripId);
      if (!itinerary) return undefined;
      if (input.status) itinerary.status = input.status;
      if (input.days) {
        for (const day of itinerary.days) {
          const match = input.days.find(
            (candidate) =>
              (candidate.date != null && candidate.date === day.date) ||
              (candidate.dayNumber != null && candidate.dayNumber === day.dayNumber),
          );
          const items = (match?.items ?? []).map((item, index) =>
            toStoredItem(day.id, item, item.sortOrder ?? index),
          );
          replaceDayItems(itinerary, day, items);
        }
      }
      itinerary.updatedAt = isoNow();
      return clone(itinerary);
    },
    async createItem(userId, tripId, input: CreateItemInput) {
      const itinerary = await ensure(userId, tripId);
      if (!itinerary) return undefined;
      if (input.dayId == null && input.dayNumber == null) {
        throw new ValidationError('dayId or dayNumber is required');
      }
      const day = findDay(itinerary, input.dayId, input.dayNumber);
      const sortOrder = input.sortOrder ?? nextSortOrder(day.items, input.startTime);
      const item = toStoredItem(day.id, input, sortOrder);
      replaceDayItems(itinerary, day, [...day.items, item]);
      return clone(itinerary);
    },
    async updateItem(userId, tripId, itemId, patch: PatchItemInput) {
      const itinerary = await ensure(userId, tripId);
      if (!itinerary) return undefined;
      const currentDay = itinerary.days.find((day) => day.items.some((item) => item.id === itemId));
      const current = currentDay?.items.find((item) => item.id === itemId);
      if (!currentDay || !current) return undefined;

      const targetDay =
        patch.dayId != null || patch.dayNumber != null
          ? findDay(itinerary, patch.dayId, patch.dayNumber)
          : currentDay;

      const next: ItineraryItem = {
        ...current,
        dayId: targetDay.id,
        kind: patch.kind ?? current.kind,
        startTime: patch.startTime ?? current.startTime,
        endTime: patch.endTime ?? current.endTime,
        placeId: patch.placeId === undefined ? current.placeId : patch.placeId,
        travelTimeMinutes:
          patch.travelTimeMinutes === undefined ? current.travelTimeMinutes : patch.travelTimeMinutes,
        notes: patch.notes === undefined ? current.notes : patch.notes,
        bookingUrl: patch.bookingUrl === undefined ? current.bookingUrl : patch.bookingUrl,
        referralPartnerId:
          patch.referralPartnerId === undefined ? current.referralPartnerId : patch.referralPartnerId,
        locked: patch.locked === undefined ? current.locked : patch.locked,
        title: patch.title === undefined ? current.title : patch.title,
        sortOrder: patch.sortOrder === undefined ? current.sortOrder : patch.sortOrder,
      };

      if (timeInvalid(next.startTime, next.endTime)) {
        throw new ValidationError('endTime must be after startTime');
      }

      currentDay.items = currentDay.items.filter((item) => item.id !== itemId);
      targetDay.items = [...targetDay.items.filter((item) => item.id !== itemId), next];
      assertNoOverlaps(currentDay.items);
      if (targetDay.id !== currentDay.id) {
        assertNoOverlaps(targetDay.items);
      }
      currentDay.items = sortItems(currentDay.items);
      targetDay.items = sortItems(targetDay.items);
      itinerary.updatedAt = isoNow();
      return clone(itinerary);
    },
    async deleteItem(userId, tripId, itemId) {
      const itinerary = await ensure(userId, tripId);
      if (!itinerary) return undefined;
      const day = itinerary.days.find((entry) => entry.items.some((item) => item.id === itemId));
      if (!day) return undefined;
      day.items = day.items.filter((item) => item.id !== itemId);
      itinerary.updatedAt = isoNow();
      return clone(itinerary);
    },
    async reorder(userId, tripId, input: ReorderInput) {
      const itinerary = await ensure(userId, tripId);
      if (!itinerary) return undefined;
      const day = itinerary.days.find((entry) => entry.id === input.dayId);
      if (!day) {
        throw new ValidationError('Itinerary day not found');
      }
      const existingIds = day.items.map((item) => item.id).sort();
      const givenIds = [...input.itemIds].sort();
      if (existingIds.length !== givenIds.length || existingIds.some((id, index) => id !== givenIds[index])) {
        throw new ValidationError('itemIds must list every item on the day exactly once');
      }
      const byId = new Map(day.items.map((item) => [item.id, item]));
      day.items = input.itemIds.map((id, index) => ({ ...byId.get(id)!, sortOrder: index }));
      itinerary.updatedAt = isoNow();
      return clone(itinerary);
    },
    async replaceUnlocked(userId, tripId, input: ReplaceUnlockedInput) {
      const itinerary = await ensure(userId, tripId);
      if (!itinerary) return undefined;
      for (const dayInput of input.days) {
        const day = findDay(itinerary, dayInput.dayId, dayInput.dayNumber);
        const locked = day.items.filter((item) => item.locked);
        const generated = dayInput.items.map((item, index) =>
          toStoredItem(day.id, { ...item, locked: false }, item.sortOrder ?? index),
        );
        replaceDayItems(itinerary, day, [...locked, ...generated]);
      }
      itinerary.generatedAt = input.generatedAt;
      itinerary.updatedAt = isoNow();
      return clone(itinerary);
    },
  };
}

function timeInvalid(startTime: string, endTime: string): boolean {
  return endTime <= startTime;
}
