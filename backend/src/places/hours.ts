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

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatClockMinutes(totalMinutes: number): string {
  const minutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  return minute === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatSlotRange(slot: WeeklyHoursSlot): string {
  return `${formatClockMinutes(slot.openMinutes)} – ${formatClockMinutes(slot.closeMinutes)}`;
}

export function formatHoursLines(
  place: Pick<MalaysiaPlaceSeedRecord, 'alwaysOpen' | 'hours'>,
): string[] {
  if (place.alwaysOpen) return ['Open 24 hours'];
  if (!place.hours?.length) return [];

  const byDay = new Map<number, string>();
  for (const slot of place.hours) {
    const range = formatSlotRange(slot);
    const prev = byDay.get(slot.day);
    byDay.set(slot.day, prev ? `${prev}, ${range}` : range);
  }

  const days = [...byDay.keys()].sort((a, b) => a - b);
  const ranges = days.map((day) => byDay.get(day)!);
  if (days.length === 7 && ranges.every((range) => range === ranges[0])) {
    return [`Daily ${ranges[0]}`];
  }
  return days.map((day) => `${DAY_LABELS[day]} ${byDay.get(day)}`);
}
