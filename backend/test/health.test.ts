import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const app = buildApp(
  loadConfig({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    LOG_LEVEL: 'silent',
  }),
);

describe('GET /health', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok status', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });

  it('rejects unknown query parameters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health?unknown=1',
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('reports skipped database when DATABASE_URL is unset', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health?verbose=true',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { database: string };
    expect(body.database).toBe('skipped');
  });
});
