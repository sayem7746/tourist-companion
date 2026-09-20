import type pg from 'pg';
import { toIsoDate } from '../db/pg-date.js';
import { skeletonDates } from './days.js';
import { ITINERARY_MAX_DAYS } from './types.js';

export const DAY_NUMBER_STAGE_OFFSET = ITINERARY_MAX_DAYS;

export type StoredItineraryDay = {
  id: string;
  dayNumber: number;
  date: string;
};

export type AlignDayOp =
  | { type: 'deleteNotIn'; dates: string[] }
  | { type: 'stageNumbers'; offset: number }
  | { type: 'setNumber'; id: string; dayNumber: number }
  | { type: 'insert'; dayNumber: number; date: string };

type Queryable = Pick<pg.Pool, 'query'> | pg.PoolClient;

export function planAlignDayOps(
  stored: StoredItineraryDay[],
  targetDates: string[],
): AlignDayOp[] | null {
  const aligned =
    stored.length === targetDates.length &&
    stored.every((day, index) => day.dayNumber === index + 1 && day.date === targetDates[index]);
  if (aligned) return null;

  const keep = new Set(targetDates);
  const remaining = stored.filter((day) => keep.has(day.date));
  const byDate = new Map(remaining.map((day) => [day.date, day]));
  const ops: AlignDayOp[] = [
    { type: 'deleteNotIn', dates: targetDates },
    { type: 'stageNumbers', offset: DAY_NUMBER_STAGE_OFFSET },
  ];
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

export function applyAlignDayOps(
  stored: StoredItineraryDay[],
  ops: AlignDayOp[],
  options: { maxDayNumber?: number } = {},
): StoredItineraryDay[] {
  const maxDayNumber = options.maxDayNumber ?? ITINERARY_MAX_DAYS + DAY_NUMBER_STAGE_OFFSET;
  let rows = stored.map((day) => ({ ...day }));

  const assertConstraints = (): void => {
    const numbers = new Set<number>();
    const dates = new Set<string>();
    for (const row of rows) {
      if (row.dayNumber < 1 || row.dayNumber > maxDayNumber) {
        throw new Error(`day_number ${row.dayNumber} violates itinerary_days_number_valid`);
      }
      if (numbers.has(row.dayNumber)) {
        const error = new Error(
          'duplicate key value violates unique constraint "itinerary_days_itinerary_number_unique"',
        );
        Object.assign(error, { code: '23505' });
        throw error;
      }
      if (dates.has(row.date)) {
        const error = new Error(
          'duplicate key value violates unique constraint "itinerary_days_itinerary_date_unique"',
        );
        Object.assign(error, { code: '23505' });
        throw error;
      }
      numbers.add(row.dayNumber);
      dates.add(row.date);
    }
  };

  for (const op of ops) {
    switch (op.type) {
      case 'deleteNotIn':
        rows = rows.filter((row) => op.dates.includes(row.date));
        break;
      case 'stageNumbers':
        rows = rows.map((row) => ({ ...row, dayNumber: row.dayNumber + op.offset }));
        break;
      case 'setNumber':
        rows = rows.map((row) => (row.id === op.id ? { ...row, dayNumber: op.dayNumber } : row));
        break;
      case 'insert':
        rows = [
          ...rows,
          { id: `new-${op.date}`, dayNumber: op.dayNumber, date: op.date },
        ];
        break;
      default: {
        const _exhaustive: never = op;
        throw new Error(`Unknown align op: ${JSON.stringify(_exhaustive)}`);
      }
    }
    assertConstraints();
  }

  return rows.sort((a, b) => a.dayNumber - b.dayNumber || a.date.localeCompare(b.date));
}

export async function loadStoredDays(db: Queryable, itineraryId: string): Promise<StoredItineraryDay[]> {
  const result = await db.query<StoredItineraryDay>(
    `
    SELECT id, day_number AS "dayNumber", date::text AS date
    FROM itinerary_days
    WHERE itinerary_id = $1
    ORDER BY day_number ASC
    `,
    [itineraryId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    dayNumber: Number(row.dayNumber),
    date: toIsoDate(row.date),
  }));
}

export async function executeAlignDayOps(
  client: Queryable,
  itineraryId: string,
  ops: AlignDayOp[],
): Promise<void> {
  for (const op of ops) {
    switch (op.type) {
      case 'deleteNotIn':
        await client.query(
          `DELETE FROM itinerary_days WHERE itinerary_id = $1 AND NOT (date = ANY($2::date[]))`,
          [itineraryId, op.dates],
        );
        break;
      case 'stageNumbers':
        await client.query(`UPDATE itinerary_days SET day_number = day_number + $2 WHERE itinerary_id = $1`, [
          itineraryId,
          op.offset,
        ]);
        break;
      case 'setNumber':
        await client.query(`UPDATE itinerary_days SET day_number = $2 WHERE id = $1`, [op.id, op.dayNumber]);
        break;
      case 'insert':
        await client.query(
          `INSERT INTO itinerary_days (itinerary_id, day_number, date) VALUES ($1, $2, $3)`,
          [itineraryId, op.dayNumber, op.date],
        );
        break;
      default: {
        const _exhaustive: never = op;
        throw new Error(`Unknown align op: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}

export async function alignStoredDays(
  client: Queryable,
  itineraryId: string,
  startDate: string,
  endDate: string,
  currentDayCount: number,
): Promise<boolean> {
  const dates = skeletonDates(startDate, endDate);
  const stored = await loadStoredDays(client, itineraryId);
  const ops = planAlignDayOps(stored, dates);
  if (ops == null && currentDayCount === dates.length) return false;
  await client.query(`UPDATE itineraries SET day_count = $2 WHERE id = $1`, [itineraryId, dates.length]);
  if (ops) await executeAlignDayOps(client, itineraryId, ops);
  return true;
}
