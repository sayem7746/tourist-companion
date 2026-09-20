import type pg from 'pg';
import type {
  CreateTripInput,
  DailyBudget,
  Interest,
  PlaceCategory,
  SavedTripPlace,
  SaveTripPlaceInput,
  TravelStyle,
  Trip,
  TripStatus,
  TripStore,
  UpdateTripInput,
} from './types.js';

interface TripRow {
  id: string;
  userId: string;
  destination: string;
  startDate: Date | string;
  endDate: Date | string;
  adultCount: number;
  childCount: number;
  interests: Interest[];
  dailyBudget: DailyBudget | null;
  travelStyle: TravelStyle | null;
  accommodationName: string | null;
  arrivalAirport: string | null;
  arrivalFlight: string | null;
  arrivalAt: Date | string | null;
  status: TripStatus;
}

const SELECT_TRIP = `
  SELECT
    id,
    user_id AS "userId",
    destination,
    start_date AS "startDate",
    end_date AS "endDate",
    adult_count AS "adultCount",
    child_count AS "childCount",
    interests,
    daily_budget AS "dailyBudget",
    travel_style AS "travelStyle",
    accommodation_name AS "accommodationName",
    arrival_airport AS "arrivalAirport",
    arrival_flight AS "arrivalFlight",
    arrival_at AS "arrivalAt",
    status
  FROM trips
`;

function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function toIsoDateTime(value: Date | string | null): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return new Date(value).toISOString();
  return value.toISOString();
}

function mapTrip(row: TripRow): Trip {
  return {
    id: row.id,
    userId: row.userId,
    destination: row.destination,
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    adultCount: row.adultCount,
    childCount: row.childCount,
    interests: row.interests ?? [],
    dailyBudget: row.dailyBudget,
    travelStyle: row.travelStyle,
    accommodationName: row.accommodationName,
    arrivalAirport: row.arrivalAirport,
    arrivalFlight: row.arrivalFlight,
    arrivalAt: toIsoDateTime(row.arrivalAt),
    status: row.status,
  };
}

interface TripPlaceRow {
  tripId: string;
  catalogId: string;
  placeId: string | null;
  name: string;
  category: PlaceCategory;
  city: string | null;
  address: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  notes: string | null;
  sortOrder: number;
}

function toCoord(value: string | number | null): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSavedPlace(row: TripPlaceRow): SavedTripPlace {
  return {
    tripId: row.tripId,
    placeId: row.placeId || row.catalogId,
    catalogId: row.catalogId,
    name: row.name,
    category: row.category,
    city: row.city,
    address: row.address,
    latitude: toCoord(row.latitude),
    longitude: toCoord(row.longitude),
    notes: row.notes,
    sortOrder: row.sortOrder,
  };
}

const SELECT_SAVED_PLACE = `
  SELECT
    tp.trip_id AS "tripId",
    p.id AS "catalogId",
    p.external_id AS "placeId",
    p.name,
    p.category,
    p.city,
    p.address,
    p.latitude,
    p.longitude,
    tp.notes,
    tp.sort_order AS "sortOrder"
  FROM trip_places tp
  JOIN places p ON p.id = tp.place_id
`;

export function createPgTripStore(pool: pg.Pool): TripStore {
  return {
    async list(userId) {
      const result = await pool.query<TripRow>(
        `${SELECT_TRIP} WHERE user_id = $1 ORDER BY start_date ASC, created_at ASC`,
        [userId],
      );
      return result.rows.map(mapTrip);
    },
    async get(userId, tripId) {
      const result = await pool.query<TripRow>(`${SELECT_TRIP} WHERE id = $1 AND user_id = $2`, [
        tripId,
        userId,
      ]);
      return result.rows[0] ? mapTrip(result.rows[0]) : undefined;
    },
    async create(userId, input: CreateTripInput) {
      const result = await pool.query<TripRow>(
        `
        INSERT INTO trips (
          user_id, destination, start_date, end_date,
          adult_count, child_count, interests, daily_budget, travel_style,
          accommodation_name, arrival_airport, arrival_flight, arrival_at, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING
          id,
          user_id AS "userId",
          destination,
          start_date AS "startDate",
          end_date AS "endDate",
          adult_count AS "adultCount",
          child_count AS "childCount",
          interests,
          daily_budget AS "dailyBudget",
          travel_style AS "travelStyle",
          accommodation_name AS "accommodationName",
          arrival_airport AS "arrivalAirport",
          arrival_flight AS "arrivalFlight",
          arrival_at AS "arrivalAt",
          status
        `,
        [
          userId,
          input.destination,
          input.startDate,
          input.endDate,
          input.adultCount,
          input.childCount,
          input.interests,
          input.dailyBudget ?? null,
          input.travelStyle ?? null,
          input.accommodationName ?? null,
          input.arrivalAirport ?? null,
          input.arrivalFlight ?? null,
          input.arrivalAt ?? null,
          input.status ?? 'draft',
        ],
      );
      return mapTrip(result.rows[0]);
    },
    async update(userId, tripId, patch: UpdateTripInput) {
      const existing = await this.get(userId, tripId);
      if (!existing) return undefined;

      const sets: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      const assign = (column: string, value: unknown) => {
        sets.push(`${column} = $${i++}`);
        values.push(value);
      };

      if (patch.destination !== undefined) assign('destination', patch.destination);
      if (patch.startDate !== undefined) assign('start_date', patch.startDate);
      if (patch.endDate !== undefined) assign('end_date', patch.endDate);
      if (patch.adultCount !== undefined) assign('adult_count', patch.adultCount);
      if (patch.childCount !== undefined) assign('child_count', patch.childCount);
      if (patch.interests !== undefined) assign('interests', patch.interests);
      if (patch.dailyBudget !== undefined) assign('daily_budget', patch.dailyBudget);
      if (patch.travelStyle !== undefined) assign('travel_style', patch.travelStyle);
      if (patch.accommodationName !== undefined) {
        assign('accommodation_name', patch.accommodationName);
      }
      if (patch.arrivalAirport !== undefined) assign('arrival_airport', patch.arrivalAirport);
      if (patch.arrivalFlight !== undefined) assign('arrival_flight', patch.arrivalFlight);
      if (patch.arrivalAt !== undefined) assign('arrival_at', patch.arrivalAt);
      if (patch.status !== undefined) assign('status', patch.status);

      if (sets.length === 0) return existing;

      values.push(tripId, userId);
      const result = await pool.query<TripRow>(
        `
        UPDATE trips SET ${sets.join(', ')}
        WHERE id = $${i++} AND user_id = $${i}
        RETURNING
          id,
          user_id AS "userId",
          destination,
          start_date AS "startDate",
          end_date AS "endDate",
          adult_count AS "adultCount",
          child_count AS "childCount",
          interests,
          daily_budget AS "dailyBudget",
          travel_style AS "travelStyle",
          accommodation_name AS "accommodationName",
          arrival_airport AS "arrivalAirport",
          arrival_flight AS "arrivalFlight",
          arrival_at AS "arrivalAt",
          status
        `,
        values,
      );
      return result.rows[0] ? mapTrip(result.rows[0]) : undefined;
    },
    async delete(userId, tripId) {
      const result = await pool.query(
        'DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id',
        [tripId, userId],
      );
      return (result.rowCount ?? 0) > 0;
    },
    async listPlaces(userId, tripId) {
      const trip = await this.get(userId, tripId);
      if (!trip) return undefined;
      const result = await pool.query<TripPlaceRow>(
        `${SELECT_SAVED_PLACE}
         JOIN trips t ON t.id = tp.trip_id
         WHERE tp.trip_id = $1 AND t.user_id = $2
         ORDER BY tp.sort_order ASC, tp.created_at ASC`,
        [tripId, userId],
      );
      return result.rows.map(mapSavedPlace);
    },
    async savePlace(userId, tripId, input: SaveTripPlaceInput) {
      const trip = await this.get(userId, tripId);
      if (!trip) return undefined;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const place = await client.query<{ id: string }>(
          `
          INSERT INTO places (
            name, category, description, address, city, country,
            latitude, longitude, external_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (external_id) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            description = EXCLUDED.description,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            country = EXCLUDED.country,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude
          RETURNING id
          `,
          [
            input.name,
            input.category,
            input.description ?? null,
            input.address ?? null,
            input.city ?? null,
            input.country ?? 'MY',
            input.latitude ?? null,
            input.longitude ?? null,
            input.placeId,
          ],
        );
        const catalogId = place.rows[0]!.id;
        const nextOrder = await client.query<{ next: number }>(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM trip_places WHERE trip_id = $1`,
          [tripId],
        );
        await client.query(
          `
          INSERT INTO trip_places (trip_id, place_id, sort_order, notes)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (trip_id, place_id) DO UPDATE SET
            notes = COALESCE(EXCLUDED.notes, trip_places.notes)
          `,
          [tripId, catalogId, nextOrder.rows[0]?.next ?? 0, input.notes ?? null],
        );
        const saved = await client.query<TripPlaceRow>(
          `${SELECT_SAVED_PLACE}
           WHERE tp.trip_id = $1 AND tp.place_id = $2`,
          [tripId, catalogId],
        );
        await client.query('COMMIT');
        return saved.rows[0] ? mapSavedPlace(saved.rows[0]) : undefined;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async removePlace(userId, tripId, placeId) {
      const trip = await this.get(userId, tripId);
      if (!trip) return undefined;
      const result = await pool.query(
        `
        DELETE FROM trip_places tp
        USING places p
        WHERE tp.place_id = p.id
          AND tp.trip_id = $1
          AND (p.external_id = $2 OR p.id::text = $2)
        RETURNING tp.place_id
        `,
        [tripId, placeId],
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}
