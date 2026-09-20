import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type {
  AppendHistoryInput,
  ConciergeHistoryStore,
  ConciergeStoredMessage,
} from './history-types.js';

interface MessageRow {
  id: string;
  userId: string;
  tripId: string;
  conversationId: string;
  role: ConciergeStoredMessage['role'];
  content: string;
  createdAt: Date | string;
  expiresAt: Date | string;
}

const SELECT_LIVE = `
  SELECT
    id,
    user_id AS "userId",
    trip_id AS "tripId",
    conversation_id AS "conversationId",
    role,
    content,
    created_at AS "createdAt",
    expires_at AS "expiresAt"
  FROM concierge_messages
  WHERE user_id = $1
    AND trip_id = $2
    AND expires_at > $3
  ORDER BY created_at ASC, id ASC
`;

function toIso(value: Date | string): string {
  if (typeof value === 'string') {
    return new Date(value).toISOString();
  }
  return value.toISOString();
}

function mapRow(row: MessageRow): ConciergeStoredMessage {
  return {
    id: row.id,
    userId: row.userId,
    tripId: row.tripId,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: toIso(row.createdAt),
    expiresAt: toIso(row.expiresAt),
  };
}

export function createPgConciergeHistoryStore(pool: pg.Pool): ConciergeHistoryStore {
  return {
    async list(userId, tripId, now = new Date()) {
      await pool.query(
        `DELETE FROM concierge_messages WHERE user_id = $1 AND trip_id = $2 AND expires_at <= $3`,
        [userId, tripId, now],
      );
      const result = await pool.query<MessageRow>(SELECT_LIVE, [userId, tripId, now]);
      return result.rows.map(mapRow);
    },
    async append(input: AppendHistoryInput) {
      const now = input.now ?? new Date();
      const expiresAt = new Date(now.getTime() + input.ttlMs);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const [index, turn] of input.turns.entries()) {
          const createdAt = new Date(now.getTime() + index);
          await client.query(
            `
              INSERT INTO concierge_messages (
                id, user_id, trip_id, conversation_id, role, content, created_at, expires_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              randomUUID(),
              input.userId,
              input.tripId,
              input.conversationId,
              turn.role,
              turn.content,
              createdAt,
              expiresAt,
            ],
          );
        }
        await client.query(
          `DELETE FROM concierge_messages WHERE user_id = $1 AND trip_id = $2 AND expires_at <= $3`,
          [input.userId, input.tripId, now],
        );
        await client.query(
          `
            DELETE FROM concierge_messages
            WHERE user_id = $1
              AND trip_id = $2
              AND id NOT IN (
                SELECT id FROM concierge_messages
                WHERE user_id = $1 AND trip_id = $2 AND expires_at > $3
                ORDER BY created_at DESC, id DESC
                LIMIT $4
              )
          `,
          [input.userId, input.tripId, now, input.maxMessages],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      const result = await pool.query<MessageRow>(SELECT_LIVE, [input.userId, input.tripId, now]);
      return result.rows.map(mapRow);
    },
    async deleteForTrip(userId, tripId) {
      const result = await pool.query(
        `DELETE FROM concierge_messages WHERE user_id = $1 AND trip_id = $2`,
        [userId, tripId],
      );
      return result.rowCount ?? 0;
    },
  };
}
