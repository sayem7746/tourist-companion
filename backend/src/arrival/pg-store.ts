import type pg from 'pg';
import type {
  ArrivalAirportCode,
  ArrivalChecklistItem,
  ArrivalChecklistStore,
  ArrivalStage,
} from './types.js';

interface ArrivalRow {
  id: string;
  airportCode: ArrivalAirportCode;
  stage: ArrivalStage;
  title: string;
  body: string;
  sortOrder: number;
  estimatedMinutes: number | null;
}

function mapRow(row: ArrivalRow): ArrivalChecklistItem {
  return {
    id: row.id,
    airportCode: row.airportCode,
    stage: row.stage,
    title: row.title,
    body: row.body,
    sortOrder: row.sortOrder,
    ...(row.estimatedMinutes !== null ? { estimatedMinutes: row.estimatedMinutes } : {}),
  };
}

export function createPgArrivalStore(pool: pg.Pool): ArrivalChecklistStore {
  return {
    async list(airportCode, stage) {
      const values: unknown[] = [airportCode];
      let sql = `
        SELECT
          id,
          airport_code AS "airportCode",
          stage,
          title,
          body,
          sort_order AS "sortOrder",
          estimated_minutes AS "estimatedMinutes"
        FROM arrival_checklist_items
        WHERE airport_code = $1
      `;
      if (stage) {
        values.push(stage);
        sql += ` AND stage = $2`;
      }
      sql += `
        ORDER BY
          CASE stage
            WHEN 'immigration' THEN 1
            WHEN 'baggage' THEN 2
            WHEN 'customs' THEN 3
            WHEN 'sim' THEN 4
            WHEN 'money' THEN 5
            WHEN 'transport' THEN 6
            WHEN 'first_steps' THEN 7
            ELSE 99
          END,
          sort_order ASC,
          id ASC`;
      const result = await pool.query<ArrivalRow>(sql, values);
      return result.rows.map(mapRow);
    },
  };
}
