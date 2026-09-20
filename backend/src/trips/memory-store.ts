import { randomUUID } from 'node:crypto';
import type { SavedTripPlace, SaveTripPlaceInput, Trip, TripStore } from './types.js';

interface StoredPlace {
  catalogId: string;
  snapshot: SaveTripPlaceInput;
}

export function createMemoryTripStore(): TripStore {
  const trips = new Map<string, Trip>();
  const catalog = new Map<string, StoredPlace>();
  const links = new Map<string, { tripId: string; placeId: string; notes: string | null; sortOrder: number }>();

  const assemble = (trip: Trip): Trip => ({ ...trip, interests: [...trip.interests] });

  const linkKey = (tripId: string, placeId: string) => `${tripId}:${placeId}`;

  const toSaved = (
    tripId: string,
    placeId: string,
    stored: StoredPlace,
    notes: string | null,
    sortOrder: number,
  ): SavedTripPlace => ({
    tripId,
    placeId,
    catalogId: stored.catalogId,
    name: stored.snapshot.name,
    category: stored.snapshot.category,
    city: stored.snapshot.city ?? null,
    address: stored.snapshot.address ?? null,
    latitude: stored.snapshot.latitude ?? null,
    longitude: stored.snapshot.longitude ?? null,
    notes,
    sortOrder,
  });

  const ownedTrip = (userId: string, tripId: string): Trip | undefined => {
    const trip = trips.get(tripId);
    if (!trip || trip.userId !== userId) return undefined;
    return trip;
  };

  return {
    async list(userId) {
      return [...trips.values()]
        .filter((trip) => trip.userId === userId)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map(assemble);
    },
    async get(userId, tripId) {
      const trip = ownedTrip(userId, tripId);
      return trip ? assemble(trip) : undefined;
    },
    async count() {
      return trips.size;
    },
    async create(userId, input) {
      const trip: Trip = {
        id: randomUUID(),
        userId,
        destination: input.destination,
        startDate: input.startDate,
        endDate: input.endDate,
        adultCount: input.adultCount,
        childCount: input.childCount,
        interests: [...input.interests],
        dailyBudget: input.dailyBudget ?? null,
        travelStyle: input.travelStyle ?? null,
        accommodationName: input.accommodationName ?? null,
        arrivalAirport: input.arrivalAirport ?? null,
        arrivalFlight: input.arrivalFlight ?? null,
        arrivalAt: input.arrivalAt ?? null,
        status: input.status ?? 'draft',
      };
      trips.set(trip.id, trip);
      return assemble(trip);
    },
    async update(userId, tripId, patch) {
      const current = trips.get(tripId);
      if (!current || current.userId !== userId) return undefined;
      const next: Trip = {
        ...current,
        destination: patch.destination ?? current.destination,
        startDate: patch.startDate ?? current.startDate,
        endDate: patch.endDate ?? current.endDate,
        adultCount: patch.adultCount === undefined ? current.adultCount : patch.adultCount,
        childCount: patch.childCount === undefined ? current.childCount : patch.childCount,
        interests: patch.interests ? [...patch.interests] : current.interests,
        dailyBudget: patch.dailyBudget === undefined ? current.dailyBudget : patch.dailyBudget,
        travelStyle: patch.travelStyle === undefined ? current.travelStyle : patch.travelStyle,
        status: patch.status === undefined ? current.status : patch.status,
        accommodationName:
          patch.accommodationName === undefined
            ? current.accommodationName
            : patch.accommodationName,
        arrivalAirport:
          patch.arrivalAirport === undefined ? current.arrivalAirport : patch.arrivalAirport,
        arrivalFlight:
          patch.arrivalFlight === undefined ? current.arrivalFlight : patch.arrivalFlight,
        arrivalAt: patch.arrivalAt === undefined ? current.arrivalAt : patch.arrivalAt,
      };
      trips.set(tripId, next);
      return assemble(next);
    },
    async delete(userId, tripId) {
      const trip = trips.get(tripId);
      if (!trip || trip.userId !== userId) return false;
      trips.delete(tripId);
      for (const key of [...links.keys()]) {
        if (key.startsWith(`${tripId}:`)) links.delete(key);
      }
      return true;
    },
    async listPlaces(userId, tripId) {
      if (!ownedTrip(userId, tripId)) return undefined;
      return [...links.values()]
        .filter((link) => link.tripId === tripId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.placeId.localeCompare(b.placeId))
        .map((link) => {
          const stored = catalog.get(link.placeId)!;
          return toSaved(tripId, link.placeId, stored, link.notes, link.sortOrder);
        });
    },
    async savePlace(userId, tripId, input: SaveTripPlaceInput) {
      if (!ownedTrip(userId, tripId)) return undefined;
      const existingCatalog = catalog.get(input.placeId);
      const stored: StoredPlace = {
        catalogId: existingCatalog?.catalogId ?? randomUUID(),
        snapshot: { ...input },
      };
      catalog.set(input.placeId, stored);

      const key = linkKey(tripId, input.placeId);
      const existingLink = links.get(key);
      const sortOrder =
        existingLink?.sortOrder ??
        Math.max(0, ...[...links.values()].filter((link) => link.tripId === tripId).map((link) => link.sortOrder + 1));
      const notes = input.notes != null ? input.notes : (existingLink?.notes ?? null);
      links.set(key, { tripId, placeId: input.placeId, notes, sortOrder });
      return toSaved(tripId, input.placeId, stored, notes, sortOrder);
    },
    async removePlace(userId, tripId, placeId) {
      if (!ownedTrip(userId, tripId)) return undefined;
      return links.delete(linkKey(tripId, placeId));
    },
  };
}
