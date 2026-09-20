import { randomUUID } from 'node:crypto';
import type {
  AppendHistoryInput,
  ConciergeHistoryStore,
  ConciergeStoredMessage,
} from './history-types.js';

function iso(date: Date): string {
  return date.toISOString();
}

function stillLive(row: ConciergeStoredMessage, now: Date): boolean {
  return Date.parse(row.expiresAt) > now.getTime();
}

export function createMemoryConciergeHistoryStore(): ConciergeHistoryStore {
  let rows: ConciergeStoredMessage[] = [];

  const listLive = (userId: string, tripId: string, now: Date): ConciergeStoredMessage[] => {
    rows = rows.filter((row) => stillLive(row, now) || !(row.userId === userId && row.tripId === tripId));
    return rows
      .filter((row) => row.userId === userId && row.tripId === tripId && stillLive(row, now))
      .sort(
        (a, b) =>
          Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
      )
      .map((row) => ({ ...row }));
  };

  return {
    async list(userId, tripId, now = new Date()) {
      return listLive(userId, tripId, now);
    },
    async append(input: AppendHistoryInput) {
      const now = input.now ?? new Date();
      const expiresAt = iso(new Date(now.getTime() + input.ttlMs));
      input.turns.forEach((turn, index) => {
        const created = new Date(now.getTime() + index);
        rows.push({
          id: randomUUID(),
          userId: input.userId,
          tripId: input.tripId,
          conversationId: input.conversationId,
          role: turn.role,
          content: turn.content,
          createdAt: iso(created),
          expiresAt,
        });
      });
      const live = listLive(input.userId, input.tripId, now);
      const keep = new Set(live.slice(-input.maxMessages).map((row) => row.id));
      rows = rows.filter(
        (row) => !(row.userId === input.userId && row.tripId === input.tripId) || keep.has(row.id),
      );
      return listLive(input.userId, input.tripId, now);
    },
    async deleteForTrip(userId, tripId) {
      const before = rows.length;
      rows = rows.filter((row) => !(row.userId === userId && row.tripId === tripId));
      return before - rows.length;
    },
  };
}
