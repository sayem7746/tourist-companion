import type { TouristProfile } from '../profile/types.js';
import type { ProfileStore } from '../profile/types.js';
import type { Trip, TripStore } from '../trips/types.js';
import type { ConciergeLiveContext } from './types.js';

const MY_TIME_ZONE = 'Asia/Kuala_Lumpur';

export function malaysiaTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function selectCurrentTrip(trips: Trip[], today: string): Trip | undefined {
  const usable = trips.filter((trip) => trip.status !== 'cancelled' && trip.status !== 'completed');
  const inWindow = usable.filter((trip) => trip.startDate <= today && today <= trip.endDate);
  if (inWindow.length > 0) {
    const active = inWindow.filter((trip) => trip.status === 'active');
    const pool = active.length > 0 ? active : inWindow;
    return [...pool].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
    )[0];
  }
  const upcoming = usable.filter((trip) => trip.startDate > today);
  if (upcoming.length > 0) {
    return [...upcoming].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
    )[0];
  }
  return undefined;
}

function itineraryLines(trip: Trip): string[] {
  const lines = [`${trip.destination} ${trip.startDate}–${trip.endDate}`];
  const arrival = ['Arrive', trip.arrivalAirport, trip.arrivalFlight, trip.arrivalAt]
    .filter((part): part is string => Boolean(part))
    .join(' ');
  if (arrival !== 'Arrive') {
    lines.push(arrival);
  }
  if (trip.accommodationName) {
    lines.push(`Stay ${trip.accommodationName}`);
  }
  if (trip.interests.length > 0) {
    lines.push(`Interests: ${trip.interests.join(', ')}`);
  }
  const party =
    trip.childCount > 0
      ? `${trip.adultCount} adult(s), ${trip.childCount} child(ren)`
      : `${trip.adultCount} adult(s)`;
  lines.push(`Party: ${party}`);
  return lines;
}

function tripModeFromTrip(trip: Trip): string | undefined {
  if (trip.childCount > 0 || trip.interests.includes('family')) {
    return 'family';
  }
  return trip.travelStyle ?? undefined;
}

export function contextFromProfileAndTrip(
  profile?: TouristProfile,
  trip?: Trip,
  displayName?: string,
): ConciergeLiveContext {
  const firstName =
    profile?.displayName?.trim().split(/\s+/)[0] || displayName?.trim().split(/\s+/)[0] || undefined;
  const context: ConciergeLiveContext = {
    firstName,
    dietaryPreferences: profile?.dietaryPreferences?.length ? [...profile.dietaryPreferences] : undefined,
    mobilityNeeds: profile?.mobilityNeeds?.length ? [...profile.mobilityNeeds] : undefined,
    travelStyle: profile?.travelStyle ?? trip?.travelStyle ?? undefined,
  };
  if (!trip) {
    return context;
  }
  return {
    ...context,
    area: trip.destination,
    destination: trip.destination,
    tripMode: tripModeFromTrip(trip),
    tripStartDate: trip.startDate,
    tripEndDate: trip.endDate,
    itinerary: itineraryLines(trip),
    accommodationName: trip.accommodationName ?? undefined,
    interests: trip.interests.length ? [...trip.interests] : undefined,
    travelStyle: trip.travelStyle ?? profile?.travelStyle ?? undefined,
  };
}

export interface TripContextStores {
  profileStore?: ProfileStore;
  tripStore?: TripStore;
}

export async function loadStoredConciergeContext(
  userId: string,
  stores: TripContextStores,
  options?: { displayName?: string; today?: string },
): Promise<ConciergeLiveContext> {
  const [profile, trips] = await Promise.all([
    stores.profileStore?.getOrCreate(userId),
    stores.tripStore?.list(userId),
  ]);
  const today = options?.today ?? malaysiaTodayIso();
  const trip = trips?.length ? selectCurrentTrip(trips, today) : undefined;
  return contextFromProfileAndTrip(profile, trip, options?.displayName);
}
