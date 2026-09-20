import { distanceMeters, walkMinutesFromMeters } from '../places/geo.js';
import { slotIsOpen } from '../places/hours.js';
import { MALAYSIA_NEARBY_PLACES } from '../places/malaysia-seed.js';
import type { GeoPoint, MalaysiaPlaceSeedRecord } from '../places/types.js';
import type { DailyBudget, Interest, TravelStyle, Trip } from '../trips/types.js';
import { itemsOverlap, minutesToTime, timeToMinutes } from './days.js';
import type { Itinerary, ItineraryDay, ItineraryItem, ItemInput } from './types.js';

const TRAVEL_WALK_THRESHOLD_MINUTES = 20;
const DAY_END_BY_STYLE: Record<TravelStyle, number> = {
  relaxed: 20 * 60,
  balanced: 21 * 60,
  packed: 22 * 60,
};

export interface GenerateScope {
  dayId?: string;
  dayNumber?: number;
}

export interface GeneratedDayPlan {
  dayId: string;
  dayNumber: number;
  items: ItemInput[];
}

function weekdayFromIsoDate(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function styleOf(trip: Trip): TravelStyle {
  return trip.travelStyle ?? 'balanced';
}

function activityCount(style: TravelStyle): number {
  if (style === 'relaxed') return 1;
  if (style === 'packed') return 3;
  return 2;
}

function dayStartMinutes(trip: Trip, day: ItineraryDay, style: TravelStyle): number {
  const baseline = style === 'relaxed' ? 10 * 60 : style === 'packed' ? 8 * 60 + 30 : 9 * 60 + 30;
  if (day.dayNumber !== 1 || !trip.arrivalAt) return baseline;
  const arrival = kualaLumpurMinutesOnDate(trip.arrivalAt, day.date);
  if (arrival == null) return baseline;
  return Math.max(baseline, arrival + 45);
}

function kualaLumpurMinutesOnDate(iso: string, date: string): number | null {
  const shifted = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  if (shifted.toISOString().slice(0, 10) !== date) return null;
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function priceRank(place: MalaysiaPlaceSeedRecord): 0 | 1 | 2 {
  if (place.badges.includes('Free')) return 0;
  const match = place.priceBandMyr?.match(/RM\s*(\d+)/);
  if (!match) return 1;
  const low = Number(match[1]);
  if (low <= 25) return 0;
  if (low <= 50) return 1;
  return 2;
}

function budgetTarget(budget: DailyBudget | null): 0 | 1 | 2 {
  if (budget === 'low') return 0;
  if (budget === 'high') return 2;
  return 1;
}

function haystack(place: MalaysiaPlaceSeedRecord): string {
  return `${place.name} ${place.description} ${place.area} ${place.badges.join(' ')}`.toLowerCase();
}

export function matchesInterest(place: MalaysiaPlaceSeedRecord, interest: Interest): boolean {
  const text = haystack(place);
  switch (interest) {
    case 'food':
      return place.nearbyCategory === 'food';
    case 'culture':
      return (
        place.nearbyCategory === 'attractions' ||
        /heritage|temple|must-see|merdeka|landmark|tourism centre/.test(text)
      );
    case 'nature':
      return /park|cave|lake|fountain/.test(text);
    case 'shopping':
      return /suria|pavilion|mall|bukit bintang/.test(text);
    case 'nightlife':
      return /night|late|jalan alor|open late/.test(text);
    case 'family':
      return /family|kid|playground|free/.test(text);
    case 'adventure':
      return /cave|steps|must-see/.test(text);
    case 'wellness':
      return /park|walk|lake|playground/.test(text);
    default:
      return false;
  }
}

function locationScore(place: MalaysiaPlaceSeedRecord, destination: string): number {
  const dest = destination.trim().toLowerCase();
  if (!dest) return 1;
  if (place.area.toLowerCase() === dest || dest.includes(place.area.toLowerCase())) return 8;
  if (place.city.toLowerCase() === dest || dest.includes(place.city.toLowerCase())) return 6;
  if (place.city.toLowerCase().includes(dest) || dest.includes(place.city.toLowerCase())) return 5;
  if (/kuala lumpur|\bkl\b|malaysia/.test(dest)) return 2;
  return 0;
}

export function placesForDestination(destination: string): MalaysiaPlaceSeedRecord[] {
  const matches = MALAYSIA_NEARBY_PLACES.filter((place) => locationScore(place, destination) > 0);
  return matches.length >= 4 ? matches : MALAYSIA_NEARBY_PLACES;
}

export function isPlaceOpenDuring(
  place: MalaysiaPlaceSeedRecord,
  date: string,
  startMinutes: number,
  endMinutes: number,
): boolean {
  if (place.alwaysOpen) return true;
  if (!place.hours?.length) return true;
  const day = weekdayFromIsoDate(date);
  const lastMinute = Math.max(startMinutes, endMinutes - 1);
  return slotIsOpenFor(place, day, startMinutes) && slotIsOpenFor(place, day, lastMinute);
}

function slotIsOpenFor(place: MalaysiaPlaceSeedRecord, day: number, minutes: number): boolean {
  if (place.alwaysOpen) return true;
  return (place.hours ?? []).some((slot) => slotIsOpen(slot, day, minutes));
}

function scorePlace(
  place: MalaysiaPlaceSeedRecord,
  trip: Trip,
  theme: Interest,
  kind: 'activity' | 'meal' | 'travel',
): number {
  let score = locationScore(place, trip.destination) * 3;
  score -= Math.abs(priceRank(place) - budgetTarget(trip.dailyBudget)) * 4;
  if (kind === 'meal' && place.nearbyCategory === 'food') score += 12;
  if (kind === 'activity' && place.nearbyCategory === 'attractions') score += 8;
  if (kind === 'travel' && place.nearbyCategory === 'transport') score += 12;
  if (matchesInterest(place, theme)) score += 10;
  for (const interest of trip.interests) {
    if (matchesInterest(place, interest)) score += 3;
  }
  if (trip.childCount > 0 && /family|kid|playground/.test(haystack(place))) score += 6;
  if (trip.dailyBudget === 'low' && place.badges.includes('Free')) score += 4;
  if (trip.dailyBudget === 'high' && priceRank(place) >= 1 && kind === 'meal') score += 3;
  return score;
}

function catalogForKind(
  places: MalaysiaPlaceSeedRecord[],
  kind: 'activity' | 'meal' | 'travel',
): MalaysiaPlaceSeedRecord[] {
  if (kind === 'meal') return places.filter((place) => place.nearbyCategory === 'food');
  if (kind === 'travel') return places.filter((place) => place.nearbyCategory === 'transport');
  return places.filter(
    (place) => place.nearbyCategory === 'attractions' || place.nearbyCategory === 'tourist_services',
  );
}

export function pickPlace(options: {
  places: MalaysiaPlaceSeedRecord[];
  trip: Trip;
  date: string;
  startMinutes: number;
  endMinutes: number;
  kind: 'activity' | 'meal' | 'travel';
  theme: Interest;
  usedIds: Set<string>;
}): MalaysiaPlaceSeedRecord | undefined {
  const { places, trip, date, startMinutes, endMinutes, kind, theme, usedIds } = options;
  const open = catalogForKind(places, kind).filter((place) =>
    isPlaceOpenDuring(place, date, startMinutes, endMinutes),
  );
  const ranked = [...open].sort(
    (a, b) => scorePlace(b, trip, theme, kind) - scorePlace(a, trip, theme, kind) || a.id.localeCompare(b.id),
  );
  return ranked.find((place) => !usedIds.has(place.id)) ?? ranked[0];
}

function findSlot(
  occupied: Array<Pick<ItemInput, 'startTime' | 'endTime'>>,
  preferredStart: number,
  duration: number,
  dayEnd: number,
): { startTime: string; endTime: string } | undefined {
  let cursor = preferredStart;
  const latest = dayEnd - duration;
  while (cursor <= latest) {
    const candidate = {
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(cursor + duration),
    };
    const blocker = occupied.find((block) => itemsOverlap(block, candidate));
    if (!blocker) return candidate;
    cursor = timeToMinutes(blocker.endTime) + 10;
  }
  return undefined;
}

function coords(place: MalaysiaPlaceSeedRecord | undefined): GeoPoint | undefined {
  if (!place) return undefined;
  return { latitude: place.latitude, longitude: place.longitude };
}

function transitMinutes(from: GeoPoint, to: GeoPoint): number {
  const meters = distanceMeters(from, to);
  const walk = walkMinutesFromMeters(meters);
  if (walk <= TRAVEL_WALK_THRESHOLD_MINUTES) return walk;
  return Math.min(75, Math.max(20, Math.round(meters / 400)));
}

function itemFromPlace(
  place: MalaysiaPlaceSeedRecord,
  kind: ItemInput['kind'],
  slot: { startTime: string; endTime: string },
  extras: Partial<ItemInput> = {},
): ItemInput {
  const notes = [
    place.halal ? 'Halal' : undefined,
    place.priceBandMyr ? `Typical spend ${place.priceBandMyr}` : undefined,
    extras.notes || undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    kind,
    startTime: slot.startTime,
    endTime: slot.endTime,
    placeId: place.id,
    title: place.name,
    bookingUrl: place.bookingUrl ?? null,
    locked: false,
    ...extras,
    notes: notes || null,
  };
}

function markUsed(used: Set<string>, place: MalaysiaPlaceSeedRecord | undefined): void {
  if (place) used.add(place.id);
}

export function generateDayItems(options: {
  trip: Trip;
  day: ItineraryDay;
  lockedItems?: ItineraryItem[];
  usedPlaceIds?: Set<string>;
  places?: MalaysiaPlaceSeedRecord[];
}): ItemInput[] {
  const trip = options.trip;
  const day = options.day;
  const style = styleOf(trip);
  const dayEnd = DAY_END_BY_STYLE[style];
  const theme = trip.interests[(day.dayNumber - 1) % Math.max(trip.interests.length, 1)] ?? 'culture';
  const places = options.places ?? placesForDestination(trip.destination);
  const used = options.usedPlaceIds ?? new Set<string>();
  const locked = [...(options.lockedItems ?? day.items.filter((item) => item.locked))];
  const occupied: Array<Pick<ItemInput, 'startTime' | 'endTime'>> = locked.map((item) => ({
    startTime: item.startTime,
    endTime: item.endTime,
  }));
  const generated: ItemInput[] = [];

  let cursor = dayStartMinutes(trip, day, style);
  let lastPlace: MalaysiaPlaceSeedRecord | undefined;

  const pushItem = (item: ItemInput, place?: MalaysiaPlaceSeedRecord) => {
    generated.push(item);
    occupied.push(item);
    cursor = timeToMinutes(item.endTime) + (style === 'packed' ? 10 : 20);
    if (place) lastPlace = place;
    markUsed(used, place);
  };

  const placeAfterTravel = (
    kind: 'activity' | 'meal' | 'travel',
    preferredStart: number,
    duration: number,
    fallbackTitle: string,
  ): MalaysiaPlaceSeedRecord | undefined => {
    const slotGuess = findSlot(occupied, preferredStart, duration, dayEnd);
    if (!slotGuess) return undefined;
    const picked = pickPlace({
      places,
      trip,
      date: day.date,
      startMinutes: timeToMinutes(slotGuess.startTime),
      endMinutes: timeToMinutes(slotGuess.endTime),
      kind,
      theme,
      usedIds: used,
    });
    const origin = coords(lastPlace);
    const dest = coords(picked);
    let start = preferredStart;
    if (origin && dest && picked) {
      const minutes = transitMinutes(origin, dest);
      if (minutes > TRAVEL_WALK_THRESHOLD_MINUTES) {
        const travelSlot = findSlot(occupied, start, minutes, dayEnd);
        if (travelSlot) {
          const hub =
            pickPlace({
              places,
              trip,
              date: day.date,
              startMinutes: timeToMinutes(travelSlot.startTime),
              endMinutes: timeToMinutes(travelSlot.endTime),
              kind: 'travel',
              theme,
              usedIds: new Set(),
            }) ?? places.find((place) => place.nearbyCategory === 'transport');
          pushItem(
            {
              kind: 'travel',
              startTime: travelSlot.startTime,
              endTime: travelSlot.endTime,
              placeId: hub?.id ?? null,
              title: hub ? `Transfer via ${hub.name}` : `Travel to ${picked.name}`,
              travelTimeMinutes: minutes,
              notes: `About ${minutes} min from the previous stop`,
              locked: false,
            },
            hub,
          );
          start = cursor;
        }
      }
    }

    const slot = findSlot(occupied, Math.max(start, preferredStart), duration, dayEnd);
    if (!slot) return undefined;
    if (picked && isPlaceOpenDuring(picked, day.date, timeToMinutes(slot.startTime), timeToMinutes(slot.endTime))) {
      const originNow = coords(lastPlace);
      const destNow = coords(picked);
      const inbound =
        originNow && destNow ? Math.min(transitMinutes(originNow, destNow), TRAVEL_WALK_THRESHOLD_MINUTES) : 0;
      const walkOnly = originNow && destNow ? walkMinutesFromMeters(distanceMeters(originNow, destNow)) : 0;
      pushItem(
        itemFromPlace(picked, kind, slot, {
          travelTimeMinutes: walkOnly > 0 && walkOnly <= TRAVEL_WALK_THRESHOLD_MINUTES ? inbound : null,
        }),
        picked,
      );
      return picked;
    }

    pushItem({
      kind,
      startTime: slot.startTime,
      endTime: slot.endTime,
      title: fallbackTitle,
      placeId: null,
      locked: false,
    });
    return undefined;
  };

  if (day.dayNumber === 1 && trip.arrivalAirport) {
    const duration = 50;
    const slot = findSlot(occupied, cursor, duration, dayEnd);
    if (slot) {
      const hub = places.find((place) => place.id === 'my-transit-grab-klcc') ??
        places.find((place) => place.nearbyCategory === 'transport');
      pushItem(
        {
          kind: 'travel',
          startTime: slot.startTime,
          endTime: slot.endTime,
          placeId: hub?.id ?? null,
          title: `Transfer from ${trip.arrivalAirport}`,
          travelTimeMinutes: duration,
          notes: trip.accommodationName ? `To ${trip.accommodationName}` : 'City arrival transfer',
          locked: false,
        },
        hub,
      );
    }
  }

  if (cursor < 10 * 60 + 30) {
    placeAfterTravel('meal', cursor, 45, 'Breakfast');
  }

  const activities = activityCount(style);
  let lunchPlaced = generated.some((item) => item.kind === 'meal' && timeToMinutes(item.startTime) >= 11 * 60);
  for (let index = 0; index < activities; index += 1) {
    if (!lunchPlaced && cursor >= 11 * 60 + 30) {
      placeAfterTravel('meal', Math.max(cursor, 12 * 60), 75, 'Lunch');
      lunchPlaced = true;
    }
    const duration = style === 'packed' ? 75 : 90;
    placeAfterTravel('activity', cursor, duration, theme === 'culture' ? 'City walk' : 'Local highlight');
  }

  if (!lunchPlaced) {
    placeAfterTravel('meal', Math.max(cursor, 12 * 60), 75, 'Lunch');
  }

  const wantDinner = style !== 'relaxed' || trip.interests.includes('food') || trip.interests.includes('nightlife');
  if (wantDinner) {
    placeAfterTravel('meal', Math.max(cursor, 18 * 60 + 30), 90, 'Dinner');
  }

  if (style === 'relaxed' && cursor < 16 * 60) {
    const slot = findSlot(occupied, Math.max(cursor, 14 * 60 + 30), 60, dayEnd);
    if (slot) {
      pushItem({
        kind: 'note',
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: 'Rest at the hotel',
        notes: 'Open afternoon for downtime',
        locked: false,
      });
    }
  }

  return generated
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((item, index) => ({ ...item, sortOrder: index }));
}

export function planItinerary(
  trip: Trip,
  itinerary: Itinerary,
  scope?: GenerateScope,
): GeneratedDayPlan[] {
  const targets = itinerary.days.filter((day) => {
    if (scope?.dayId) return day.id === scope.dayId;
    if (scope?.dayNumber != null) return day.dayNumber === scope.dayNumber;
    return true;
  });
  const usedPlaceIds = new Set(
    itinerary.days
      .filter((day) => !targets.some((target) => target.id === day.id))
      .flatMap((day) => day.items.map((item) => item.placeId).filter((id): id is string => id != null)),
  );
  const places = placesForDestination(trip.destination);
  return targets.map((day) => ({
    dayId: day.id,
    dayNumber: day.dayNumber,
    items: generateDayItems({
      trip,
      day,
      lockedItems: day.items.filter((item) => item.locked),
      usedPlaceIds,
      places,
    }),
  }));
}
