import { describe, expect, it } from 'vitest';
import {
  applyAlignDayOps,
  DAY_NUMBER_STAGE_OFFSET,
  planAlignDayOps,
  type AlignDayOp,
  type StoredItineraryDay,
} from '../src/itinerary/align-days.js';

function days(...pairs: Array<[string, string]>): StoredItineraryDay[] {
  return pairs.map(([id, date], index) => ({
    id,
    dayNumber: index + 1,
    date,
  }));
}

/** Old alignDays: UPDATE/INSERT day_number in order without staging through a free range. */
function naiveAlignOps(stored: StoredItineraryDay[], targetDates: string[]): AlignDayOp[] {
  const keep = new Set(targetDates);
  const remaining = stored.filter((day) => keep.has(day.date));
  const byDate = new Map(remaining.map((day) => [day.date, day]));
  const ops: AlignDayOp[] = [{ type: 'deleteNotIn', dates: targetDates }];
  for (const [index, date] of targetDates.entries()) {
    const current = byDate.get(date);
    const dayNumber = index + 1;
    if (current) {
      ops.push({ type: 'setNumber', id: current.id, dayNumber });
    } else {
      ops.push({ type: 'insert', dayNumber, date });
    }
  }
  return ops;
}

describe('itinerary day alignment', () => {
  it('does nothing when SQL dates already match the trip skeleton', () => {
    const stored = days(['d1', '2026-10-04'], ['d2', '2026-10-05'], ['d3', '2026-10-06'], ['d4', '2026-10-07']);
    expect(planAlignDayOps(stored, ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'])).toBeNull();
  });

  it('hits itinerary_days_itinerary_number_unique when prepending a day without staging', () => {
    const stored = days(['oct2', '2026-10-02'], ['oct3', '2026-10-03']);
    const target = ['2026-10-01', '2026-10-02', '2026-10-03'];
    expect(() => applyAlignDayOps(stored, naiveAlignOps(stored, target), { maxDayNumber: 7 })).toThrow(
      /itinerary_days_itinerary_number_unique/,
    );
  });

  it('stages day_number then remaps so prepending a start date does not 500', () => {
    const stored = days(['oct2', '2026-10-02'], ['oct3', '2026-10-03']);
    const target = ['2026-10-01', '2026-10-02', '2026-10-03'];
    const ops = planAlignDayOps(stored, target);
    expect(ops?.[0]).toEqual({ type: 'deleteNotIn', dates: target });
    expect(ops?.[1]).toEqual({ type: 'stageNumbers', offset: DAY_NUMBER_STAGE_OFFSET });

    const aligned = applyAlignDayOps(stored, ops!, { maxDayNumber: 14 });
    expect(aligned.map((day) => ({ date: day.date, dayNumber: day.dayNumber, id: day.id }))).toEqual([
      { date: '2026-10-01', dayNumber: 1, id: 'new-2026-10-01' },
      { date: '2026-10-02', dayNumber: 2, id: 'oct2' },
      { date: '2026-10-03', dayNumber: 3, id: 'oct3' },
    ]);
  });

  it('shifts a 7-day window without unique collisions and keeps items with the same date', () => {
    const stored = days(
      ['d1', '2026-10-01'],
      ['d2', '2026-10-02'],
      ['d3', '2026-10-03'],
      ['d4', '2026-10-04'],
      ['d5', '2026-10-05'],
      ['d6', '2026-10-06'],
      ['d7', '2026-10-07'],
    );
    const target = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
    const aligned = applyAlignDayOps(stored, planAlignDayOps(stored, target)!, { maxDayNumber: 14 });
    expect(aligned.map((day) => `${day.dayNumber}:${day.date}:${day.id}`)).toEqual([
      '1:2026-10-02:d2',
      '2:2026-10-03:d3',
      '3:2026-10-04:d4',
      '4:2026-10-05:d5',
      '5:2026-10-06:d6',
      '6:2026-10-07:d7',
      '7:2026-10-08:new-2026-10-08',
    ]);
  });
});
