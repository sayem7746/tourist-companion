import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createMemoryConciergeHistoryStore } from '../src/concierge/memory-store.js';
import { shouldPersistHistory } from '../src/concierge/history-types.js';
import { loadConfig } from '../src/config.js';

const app = buildApp(
  loadConfig({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-only-insecure-jwt-secret',
    CONCIERGE_RATE_LIMIT_MAX: '200',
    CONCIERGE_HISTORY_MAX_MESSAGES: '4',
    CONCIERGE_HISTORY_TTL_MS: String(7 * 24 * 60 * 60 * 1000),
  }),
);

const validTrip = {
  destination: 'Kuala Lumpur',
  startDate: '2026-09-18',
  endDate: '2026-09-25',
  adultCount: 2,
  childCount: 0,
  interests: ['food'],
  status: 'active',
};

async function signup(email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: { email, password: 'password12', displayName: 'Alex' },
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { token: string }).token;
}

async function createTrip(token: string) {
  const created = await app.inject({
    method: 'POST',
    url: '/trips',
    headers: { authorization: `Bearer ${token}` },
    payload: validTrip,
  });
  expect(created.statusCode).toBe(201);
  return (created.json() as { trip: { id: string } }).trip.id;
}

describe('concierge conversation history', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires auth to read or delete history', async () => {
    const get = await app.inject({ method: 'GET', url: '/concierge/history' });
    expect(get.statusCode).toBe(401);
    const del = await app.inject({ method: 'DELETE', url: '/concierge/history' });
    expect(del.statusCode).toBe(401);
  });

  it('does not persist anonymous chats', async () => {
    const chat = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Is this food spicy?' },
    });
    expect(chat.statusCode).toBe(200);
    expect((chat.json() as { persisted: boolean }).persisted).toBe(false);
  });

  it('persists last N messages per trip, skips SOS, and deletes on request', async () => {
    const token = await signup('history@example.com');
    const headers = { authorization: `Bearer ${token}` };
    const tripId = await createTrip(token);

    const first = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers,
      payload: { message: 'Is this food spicy?', tripId },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as { persisted: boolean; conversationId: string; tripId: string };
    expect(firstBody.persisted).toBe(true);
    expect(firstBody.tripId).toBe(tripId);

    await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers,
      payload: { message: 'How to ride the LRT?', tripId, conversationId: firstBody.conversationId },
    });
    await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers,
      payload: { message: 'Do I need cash for night market?', tripId, conversationId: firstBody.conversationId },
    });

    const listed = await app.inject({ method: 'GET', url: '/concierge/history', headers });
    expect(listed.statusCode).toBe(200);
    const history = listed.json() as {
      tripId: string;
      messages: Array<{ role: string; content: string }>;
      retention: { maxMessages: number; persistEmergency: boolean };
    };
    expect(history.tripId).toBe(tripId);
    expect(history.retention.maxMessages).toBe(4);
    expect(history.retention.persistEmergency).toBe(false);
    expect(history.messages).toHaveLength(4);
    expect(history.messages[0]?.content).toBe('How to ride the LRT?');
    expect(history.messages.at(-1)?.content.toLowerCase()).toMatch(/cash|pasar|myr/);

    const sos = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers,
      payload: { message: 'Someone grabbed my bag and I think they are still following me.', tripId },
    });
    expect((sos.json() as { persisted: boolean }).persisted).toBe(false);

    const afterSos = await app.inject({ method: 'GET', url: '/concierge/history', headers });
    const afterSosBody = afterSos.json() as { messages: Array<{ content: string }> };
    expect(afterSosBody.messages).toHaveLength(4);
    expect(afterSosBody.messages.some((row) => /grabbed my bag/i.test(row.content))).toBe(false);

    const deleted = await app.inject({ method: 'DELETE', url: `/concierge/history?tripId=${tripId}`, headers });
    expect(deleted.statusCode).toBe(204);

    const empty = await app.inject({ method: 'GET', url: `/concierge/history?tripId=${tripId}`, headers });
    expect((empty.json() as { messages: unknown[] }).messages).toHaveLength(0);
  });

  it('keeps history isolated per user and returns 404 for another trip', async () => {
    const tokenA = await signup('hist-a@example.com');
    const tokenB = await signup('hist-b@example.com');
    const tripA = await createTrip(tokenA);
    const tripB = await createTrip(tokenB);

    await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { message: 'Dress code for Batu Caves?', tripId: tripA },
    });

    const other = await app.inject({
      method: 'GET',
      url: `/concierge/history?tripId=${tripA}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(other.statusCode).toBe(404);

    const own = await app.inject({
      method: 'GET',
      url: `/concierge/history?tripId=${tripB}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(own.statusCode).toBe(200);
    expect((own.json() as { messages: unknown[] }).messages).toHaveLength(0);
  });
});

describe('concierge history store', () => {
  it('drops expired rows and keeps only the last N', async () => {
    const store = createMemoryConciergeHistoryStore();
    const t0 = new Date('2026-09-20T00:00:00.000Z');
    await store.append({
      userId: 'u1',
      tripId: 't1',
      conversationId: 'conversation-1',
      turns: [
        { role: 'user', content: 'one' },
        { role: 'assistant', content: 'ack one' },
        { role: 'user', content: 'two' },
        { role: 'assistant', content: 'ack two' },
      ],
      maxMessages: 2,
      ttlMs: 60_000,
      now: t0,
    });
    const kept = await store.list('u1', 't1', t0);
    expect(kept.map((row) => row.content)).toEqual(['two', 'ack two']);

    const expired = await store.list('u1', 't1', new Date(t0.getTime() + 61_000));
    expect(expired).toEqual([]);
  });

  it('does not persist SOS turns', () => {
    expect(shouldPersistHistory('sos')).toBe(false);
    expect(shouldPersistHistory('none')).toBe(true);
  });
});
