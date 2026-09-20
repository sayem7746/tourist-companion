import type pg from 'pg';
import { toIsoDate, toIsoDateTime } from '../db/pg-date.js';
import { ValidationError } from '../errors.js';
import type { TripStore } from '../trips/types.js';
import { alignStoredDays } from './align-days.js';
import {
  assertNoOverlaps,
  clipDayCount,
  nextSortOrder,
  normalizeItemFields,
  skeletonDates,
  sortDays,
} from './days.js';
import type {
  CreateItemInput,
  Itinerary,
  ItineraryDay,
  ItineraryItem,
  ItineraryItemKind,
  ItineraryStatus,
  ItineraryStore,
  ItemInput,
  PatchItemInput,
  PutItineraryInput,
  ReorderInput,
  ReplaceUnlockedInput,
} from './types.js';

interface ItineraryRow {
  id: string;
  tripId: string;
  dayCount: number;
  status: ItineraryStatus;
  generatedAt: Date | string | null;
  updatedAt: Date | string;
}

interface DayRow {
  id: string;
  itineraryId: string;
  dayNumber: number;
  date: Date | string;
}

interface ItemRow {
  id: string;
  dayId: string;
  sortOrder: number;
  kind: ItineraryItemKind;
  startTime: string;
  endTime: string;
  placeId: string | null;
  travelTimeMinutes: number | null;
  notes: string | null;
  bookingUrl: string | null;
  referralPartnerId: string | null;
  locked: boolean;
  title: string | null;
}

const SELECT_ITINERARY = `
  SELECT
    id,
    trip_id AS "tripId",
    day_count AS "dayCount",
    status,
    generated_at AS "generatedAt",
    updated_at AS "updatedAt"
  FROM itineraries
`;

const SELECT_DAYS = `
  SELECT
    id,
    itinerary_id AS "itineraryId",
    day_number AS "dayNumber",
    date::text AS date
  FROM itinerary_days
  WHERE itinerary_id = $1
  ORDER BY day_number ASC
`;

const SELECT_ITEMS = `
  SELECT
    id,
    day_id AS "dayId",
    sort_order AS "sortOrder",
    kind,
    start_time AS "startTime",
    end_time AS "endTime",
    place_id AS "placeId",
    travel_time_minutes AS "travelTimeMinutes",
    notes,
    booking_url AS "bookingUrl",
    referral_partner_id AS "referralPartnerId",
    locked,
    title
  FROM itinerary_items
  WHERE day_id = ANY($1::uuid[])
  ORDER BY start_time ASC, sort_order ASC, id ASC
`;

function mapItem(row: ItemRow): ItineraryItem {
  return {
    id: row.id,
    dayId: row.dayId,
    sortOrder: row.sortOrder,
    kind: row.kind,
    startTime: row.startTime,
    endTime: row.endTime,
    placeId: row.placeId,
    travelTimeMinutes: row.travelTimeMinutes,
    notes: row.notes,
    bookingUrl: row.bookingUrl,
    referralPartnerId: row.referralPartnerId,
    locked: row.locked,
    title: row.title,
  };
}

function assemble(header: ItineraryRow, days: DayRow[], items: ItemRow[]): Itinerary {
  const itemsByDay = new Map<string, ItineraryItem[]>();
  for (const item of items) {
    const list = itemsByDay.get(item.dayId) ?? [];
    list.push(mapItem(item));
    itemsByDay.set(item.dayId, list);
  }
  return {
    id: header.id,
    tripId: header.tripId,
    dayCount: header.dayCount,
    status: header.status,
    generatedAt: toIsoDateTime(header.generatedAt),
    updatedAt: toIsoDateTime(header.updatedAt) ?? new Date().toISOString(),
    days: sortDays(
      days.map((day) => ({
        id: day.id,
        itineraryId: day.itineraryId,
        dayNumber: day.dayNumber,
        date: toIsoDate(day.date),
        items: itemsByDay.get(day.id) ?? [],
      })),
    ),
  };
}

type Queryable = Pick<pg.Pool, 'query'> | pg.PoolClient;

async function loadItinerary(db: Queryable, tripId: string): Promise<Itinerary | undefined> {
  const header = await db.query<ItineraryRow>(`${SELECT_ITINERARY} WHERE trip_id = $1`, [tripId]);
  if (!header.rows[0]) return undefined;
  const days = await db.query<DayRow>(SELECT_DAYS, [header.rows[0].id]);
  const dayIds = days.rows.map((day) => day.id);
  const items =
    dayIds.length === 0
      ? { rows: [] as ItemRow[] }
      : await db.query<ItemRow>(SELECT_ITEMS, [dayIds]);
  return assemble(header.rows[0], days.rows, items.rows);
}

async function insertDays(
  client: pg.PoolClient,
  itineraryId: string,
  dates: string[],
): Promise<void> {
  for (const [index, date] of dates.entries()) {
    await client.query(
      `
      INSERT INTO itinerary_days (itinerary_id, day_number, date)
      VALUES ($1, $2, $3)
      ON CONFLICT (itinerary_id, day_number) DO UPDATE SET date = EXCLUDED.date
      `,
      [itineraryId, index + 1, date],
    );
  }
}

async function alignDays(
  client: pg.PoolClient,
  itinerary: Itinerary,
  startDate: string,
  endDate: string,
): Promise<Itinerary> {
  await alignStoredDays(client, itinerary.id, startDate, endDate, itinerary.dayCount);
  const loaded = await loadItinerary(client, itinerary.tripId);
  return loaded!;
}

async function insertItem(client: pg.PoolClient, dayId: string, input: ItemInput, sortOrder: number): Promise<void> {
  const fields = normalizeItemFields({ ...input, sortOrder });
  await client.query(
    `
    INSERT INTO itinerary_items (
      day_id, sort_order, kind, start_time, end_time, place_id, travel_time_minutes,
      notes, booking_url, referral_partner_id, locked, title
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `,
    [
      dayId,
      fields.sortOrder,
      fields.kind,
      fields.startTime,
      fields.endTime,
      fields.placeId,
      fields.travelTimeMinutes,
      fields.notes,
      fields.bookingUrl,
      fields.referralPartnerId,
      fields.locked,
      fields.title,
    ],
  );
}

export function createPgItineraryStore(pool: pg.Pool, trips: TripStore): ItineraryStore {
  const ensure = async (userId: string, tripId: string, client?: pg.PoolClient): Promise<Itinerary | undefined> => {
    const trip = await trips.get(userId, tripId);
    if (!trip) return undefined;
    const db = client ?? pool;
    const existing = await loadItinerary(db, tripId);
    if (existing) {
      if (client) {
        return alignDays(client, existing, trip.startDate, trip.endDate);
      }
      const owned = await pool.connect();
      try {
        await owned.query('BEGIN');
        const aligned = await alignDays(owned, existing, trip.startDate, trip.endDate);
        await owned.query('COMMIT');
        return aligned;
      } catch (error) {
        await owned.query('ROLLBACK');
        throw error;
      } finally {
        owned.release();
      }
    }

    const run = async (cx: pg.PoolClient): Promise<Itinerary> => {
      const dates = skeletonDates(trip.startDate, trip.endDate);
      const inserted = await cx.query<ItineraryRow>(
        `
        INSERT INTO itineraries (trip_id, day_count, status)
        VALUES ($1, $2, 'draft')
        ON CONFLICT (trip_id) DO UPDATE SET day_count = EXCLUDED.day_count
        RETURNING
          id,
          trip_id AS "tripId",
          day_count AS "dayCount",
          status,
          generated_at AS "generatedAt",
          updated_at AS "updatedAt"
        `,
        [tripId, clipDayCount(trip.startDate, trip.endDate)],
      );
      await insertDays(cx, inserted.rows[0].id, dates);
      const loaded = (await loadItinerary(cx, tripId))!;
      return alignDays(cx, loaded, trip.startDate, trip.endDate);
    };

    if (client) return run(client);
    const owned = await pool.connect();
    try {
      await owned.query('BEGIN');
      const created = await run(owned);
      await owned.query('COMMIT');
      return created;
    } catch (error) {
      await owned.query('ROLLBACK');
      throw error;
    } finally {
      owned.release();
    }
  };

  const withTrip = async (
    userId: string,
    tripId: string,
    work: (client: pg.PoolClient, itinerary: Itinerary) => Promise<Itinerary | undefined>,
  ): Promise<Itinerary | undefined> => {
    const trip = await trips.get(userId, tripId);
    if (!trip) return undefined;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const itinerary = await ensure(userId, tripId, client);
      if (!itinerary) {
        await client.query('ROLLBACK');
        return undefined;
      }
      const result = await work(client, itinerary);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isProviderFkError(error)) {
        throw new ValidationError('referralPartnerId is not a known provider');
      }
      throw error;
    } finally {
      client.release();
    }
  };

  const dayFrom = (itinerary: Itinerary, dayId?: string, dayNumber?: number): ItineraryDay => {
    const day = dayId
      ? itinerary.days.find((entry) => entry.id === dayId)
      : itinerary.days.find((entry) => entry.dayNumber === dayNumber);
    if (!day) {
      throw new ValidationError('Itinerary day not found');
    }
    return day;
  };

  return {
    async get(userId, tripId) {
      return ensure(userId, tripId);
    },
    async put(userId, tripId, input: PutItineraryInput) {
      return withTrip(userId, tripId, async (client, itinerary) => {
        if (input.status) {
          await client.query(`UPDATE itineraries SET status = $2 WHERE id = $1`, [
            itinerary.id,
            input.status,
          ]);
        }
        if (input.days) {
          for (const day of itinerary.days) {
            const match = input.days.find(
              (candidate) =>
                (candidate.date != null && candidate.date === day.date) ||
                (candidate.dayNumber != null && candidate.dayNumber === day.dayNumber),
            );
            const items = match?.items ?? [];
            assertNoOverlaps(items);
            await client.query(`DELETE FROM itinerary_items WHERE day_id = $1`, [day.id]);
            for (const [index, item] of items.entries()) {
              await insertItem(client, day.id, item, item.sortOrder ?? index);
            }
          }
        }
        await client.query(`UPDATE itineraries SET updated_at = NOW() WHERE id = $1`, [itinerary.id]);
        return (await loadItinerary(client, tripId))!;
      });
    },
    async createItem(userId, tripId, input: CreateItemInput) {
      return withTrip(userId, tripId, async (client, itinerary) => {
        if (input.dayId == null && input.dayNumber == null) {
          throw new ValidationError('dayId or dayNumber is required');
        }
        const day = dayFrom(itinerary, input.dayId, input.dayNumber);
        const sortOrder = input.sortOrder ?? nextSortOrder(day.items, input.startTime);
        const nextItems = [...day.items, { ...normalizeItemFields({ ...input, sortOrder }), id: 'tmp', dayId: day.id }];
        assertNoOverlaps(nextItems);
        await insertItem(client, day.id, input, sortOrder);
        await client.query(`UPDATE itineraries SET updated_at = NOW() WHERE id = $1`, [itinerary.id]);
        return (await loadItinerary(client, tripId))!;
      });
    },
    async updateItem(userId, tripId, itemId, patch: PatchItemInput) {
      return withTrip(userId, tripId, async (client, itinerary) => {
        const currentDay = itinerary.days.find((day) => day.items.some((item) => item.id === itemId));
        const current = currentDay?.items.find((item) => item.id === itemId);
        if (!currentDay || !current) return undefined;
        const targetDay =
          patch.dayId != null || patch.dayNumber != null
            ? dayFrom(itinerary, patch.dayId, patch.dayNumber)
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
        if (next.endTime <= next.startTime) {
          throw new ValidationError('endTime must be after startTime');
        }
        const targetItems = [
          ...targetDay.items.filter((item) => item.id !== itemId),
          next,
        ];
        assertNoOverlaps(targetItems);
        if (targetDay.id !== currentDay.id) {
          assertNoOverlaps(currentDay.items.filter((item) => item.id !== itemId));
        }
        await client.query(
          `
          UPDATE itinerary_items SET
            day_id = $2,
            sort_order = $3,
            kind = $4,
            start_time = $5,
            end_time = $6,
            place_id = $7,
            travel_time_minutes = $8,
            notes = $9,
            booking_url = $10,
            referral_partner_id = $11,
            locked = $12,
            title = $13
          WHERE id = $1
          `,
          [
            itemId,
            next.dayId,
            next.sortOrder,
            next.kind,
            next.startTime,
            next.endTime,
            next.placeId,
            next.travelTimeMinutes,
            next.notes,
            next.bookingUrl,
            next.referralPartnerId,
            next.locked,
            next.title,
          ],
        );
        await client.query(`UPDATE itineraries SET updated_at = NOW() WHERE id = $1`, [itinerary.id]);
        return (await loadItinerary(client, tripId))!;
      });
    },
    async deleteItem(userId, tripId, itemId) {
      return withTrip(userId, tripId, async (client, itinerary) => {
        const exists = itinerary.days.some((day) => day.items.some((item) => item.id === itemId));
        if (!exists) return undefined;
        await client.query(`DELETE FROM itinerary_items WHERE id = $1`, [itemId]);
        await client.query(`UPDATE itineraries SET updated_at = NOW() WHERE id = $1`, [itinerary.id]);
        return (await loadItinerary(client, tripId))!;
      });
    },
    async reorder(userId, tripId, input: ReorderInput) {
      return withTrip(userId, tripId, async (client, itinerary) => {
        const day = itinerary.days.find((entry) => entry.id === input.dayId);
        if (!day) {
          throw new ValidationError('Itinerary day not found');
        }
        const existingIds = day.items.map((item) => item.id).sort();
        const givenIds = [...input.itemIds].sort();
        if (existingIds.length !== givenIds.length || existingIds.some((id, index) => id !== givenIds[index])) {
          throw new ValidationError('itemIds must list every item on the day exactly once');
        }
        for (const [index, id] of input.itemIds.entries()) {
          await client.query(`UPDATE itinerary_items SET sort_order = $2 WHERE id = $1`, [id, index]);
        }
        await client.query(`UPDATE itineraries SET updated_at = NOW() WHERE id = $1`, [itinerary.id]);
        return (await loadItinerary(client, tripId))!;
      });
    },
    async replaceUnlocked(userId, tripId, input: ReplaceUnlockedInput) {
      return withTrip(userId, tripId, async (client, itinerary) => {
        for (const dayInput of input.days) {
          const day = dayFrom(itinerary, dayInput.dayId, dayInput.dayNumber);
          const locked = day.items.filter((item) => item.locked);
          assertNoOverlaps([...locked, ...dayInput.items]);
          await client.query(`DELETE FROM itinerary_items WHERE day_id = $1 AND locked = false`, [day.id]);
          for (const [index, item] of dayInput.items.entries()) {
            await insertItem(client, day.id, { ...item, locked: false }, item.sortOrder ?? index);
          }
        }
        await client.query(`UPDATE itineraries SET generated_at = $2, updated_at = NOW() WHERE id = $1`, [
          itinerary.id,
          input.generatedAt,
        ]);
        return (await loadItinerary(client, tripId))!;
      });
    },
  };
}

function isProviderFkError(error: unknown): boolean {
  if (typeof error !== 'object' || error == null) return false;
  const code = 'code' in error ? String(error.code) : '';
  const constraint = 'constraint' in error ? String(error.constraint) : '';
  return code === '23503' && constraint.includes('referral_partner');
}
