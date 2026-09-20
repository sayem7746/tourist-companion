import type { MalaysiaPlaceSeedRecord, WeeklyHoursSlot } from './types.js';

const KL_OFFSET_MS = 8 * 60 * 60 * 1000;

export function kualaLumpurDayAndMinutes(now: Date): { day: number; minutes: number } {
  const shifted = new Date(now.getTime() + KL_OFFSET_MS);
  return {
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function slotIsOpen(slot: WeeklyHoursSlot, day: number, minutes: number): boolean {
  const spansMidnight = slot.closeMinutes > 24 * 60;
  if (!spansMidnight) {
    return slot.day === day && minutes >= slot.openMinutes && minutes < slot.closeMinutes;
  }
  const overnightEnd = slot.closeMinutes - 24 * 60;
  if (slot.day === day && minutes >= slot.openMinutes) return true;
  const nextDay = (slot.day + 1) % 7;
  return nextDay === day && minutes < overnightEnd;
}

export function isSeedPlaceOpen(place: MalaysiaPlaceSeedRecord, now: Date): boolean | null {
  if (place.alwaysOpen) return true;
  if (!place.hours?.length) return null;
  const { day, minutes } = kualaLumpurDayAndMinutes(now);
  return place.hours.some((slot) => slotIsOpen(slot, day, minutes));
}
