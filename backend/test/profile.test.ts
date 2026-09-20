import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const app = buildApp(
  loadConfig({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-only-insecure-jwt-secret',
  }),
);

async function signup(email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: {
      email,
      password: 'password12',
      displayName: 'Traveller',
    },
  });
  expect(response.statusCode).toBe(201);
  const token = (response.json() as { token: string }).token;
  return { token, cookie: String(response.headers['set-cookie']) };
}

describe('profile endpoints', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    const get = await app.inject({ method: 'GET', url: '/profile' });
    expect(get.statusCode).toBe(401);

    const patch = await app.inject({
      method: 'PATCH',
      url: '/profile',
      payload: { language: 'ms' },
    });
    expect(patch.statusCode).toBe(401);
  });

  it('returns default preferences and applies a partial patch', async () => {
    const { token } = await signup('profile@example.com');

    const initial = await app.inject({
      method: 'GET',
      url: '/profile',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toMatchObject({
      profile: {
        email: 'profile@example.com',
        displayName: 'Traveller',
        language: 'en',
        dietaryPreferences: [],
        mobilityNeeds: [],
        travelStyle: null,
      },
    });

    const patched = await app.inject({
      method: 'PATCH',
      url: '/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: 'Sam',
        language: 'ms',
        dietaryPreferences: ['halal', 'vegetarian'],
        mobilityNeeds: ['limited_walking'],
        travelStyle: 'relaxed',
      },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      profile: {
        displayName: 'Sam',
        language: 'ms',
        dietaryPreferences: ['halal', 'vegetarian'],
        mobilityNeeds: ['limited_walking'],
        travelStyle: 'relaxed',
      },
    });

    const again = await app.inject({
      method: 'GET',
      url: '/profile',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(again.json()).toMatchObject({
      profile: { displayName: 'Sam', language: 'ms', travelStyle: 'relaxed' },
    });
  });

  it('rejects invalid preference values', async () => {
    const { token } = await signup('invalid-profile@example.com');

    const response = await app.inject({
      method: 'PATCH',
      url: '/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: { travelStyle: 'chaotic', dietaryPreferences: ['pizza'] },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects an empty patch body', async () => {
    const { token } = await signup('empty-profile@example.com');
    const response = await app.inject({
      method: 'PATCH',
      url: '/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });
});
