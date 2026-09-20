import { randomUUID } from 'node:crypto';
import type { Trip, TripStore } from './types.js';

export function createMemoryTripStore(): TripStore {
  const trips = new Map<string, Trip>();

  const assemble = (trip: Trip): Trip => ({ ...trip, interests: [...trip.interests] });

  return {
    async list(userId) {
      return [...trips.values()]
        .filter((trip) => trip.userId === userId)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map(assemble);
    },
    async get(userId, tripId) {
      const trip = trips.get(tripId);
      if (!trip || trip.userId !== userId) return undefined;
      return assemble(trip);
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
      return true;
    },
  };
}
