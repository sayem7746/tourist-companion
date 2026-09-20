import { describe, expect, it } from 'vitest';
import { toIsoDate } from '../src/db/pg-date.js';

describe('toIsoDate', () => {
  it('keeps YYYY-MM-DD strings as calendar dates', () => {
    expect(toIsoDate('2026-10-05')).toBe('2026-10-05');
    expect(toIsoDate('2026-10-05T16:00:00.000Z')).toBe('2026-10-05');
  });

  it('uses the local calendar day, not UTC ISO, for Date values', () => {
    // node-pg DATE is local midnight. toISOString() is the previous UTC day in UTC+8.
    const localMidnight = new Date(2026, 9, 5);
    expect(toIsoDate(localMidnight)).toBe('2026-10-05');
    if (localMidnight.getTimezoneOffset() < 0) {
      expect(localMidnight.toISOString().slice(0, 10)).toBe('2026-10-04');
    }
  });
});
