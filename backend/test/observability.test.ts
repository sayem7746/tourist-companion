import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { serializeErrorForLog } from '../src/observability/error-log.js';
import { createMetricsCollector } from '../src/observability/metrics.js';

const app = buildApp(
  loadConfig({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    LOG_LEVEL: 'silent',
  }),
);

describe('observability', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('echoes X-Request-Id and generates one when missing', async () => {
    const withId = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'client-req-1' },
    });
    expect(withId.headers['x-request-id']).toBe('client-req-1');

    const generated = await app.inject({ method: 'GET', url: '/health' });
    expect(typeof generated.headers['x-request-id']).toBe('string');
    expect(String(generated.headers['x-request-id']).length).toBeGreaterThan(8);
  });

  it('includes requestId on error bodies', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health?unknown=1',
      headers: { 'x-request-id': 'err-1' },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: { requestId: string } };
    expect(body.error.requestId).toBe('err-1');
  });

  it('records request counts and latency on GET /metrics', async () => {
    await app.inject({ method: 'GET', url: '/health' });
    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      requestsTotal: number;
      latencyMs: { histogram: { le: number | '+Inf'; count: number }[]; p95: number | null };
      byRoute: Record<string, { count: number }>;
    };
    expect(body.requestsTotal).toBeGreaterThanOrEqual(1);
    expect(body.byRoute['GET /health']?.count).toBeGreaterThanOrEqual(1);
    expect(body.latencyMs.histogram.at(-1)?.le).toBe('+Inf');
    expect(body.latencyMs.p95).not.toBeUndefined();
  });

  it('includes a metrics summary on verbose health', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health?verbose=true',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      database: string;
      metrics: { requestsTotal: number; latencyMs: { p95: number | null } };
    };
    expect(body.database).toBe('skipped');
    expect(body.metrics.requestsTotal).toBeGreaterThanOrEqual(0);
    expect('p95' in body.metrics.latencyMs).toBe(true);
  });
});

describe('serializeErrorForLog', () => {
  it('includes stack outside production and omits it in production', () => {
    const error = new Error('boom');
    const dev = serializeErrorForLog(
      error,
      loadConfig({ NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '3000', LOG_LEVEL: 'silent' }),
    );
    const prod = serializeErrorForLog(
      error,
      loadConfig({
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3000',
        LOG_LEVEL: 'silent',
        JWT_SECRET: 'a'.repeat(32),
        DATABASE_URL: 'postgres://tourist:tourist@127.0.0.1:5432/tourist_companion',
      }),
    );
    expect(dev.stack).toContain('Error: boom');
    expect(prod.stack).toBeUndefined();
  });
});

describe('metrics collector', () => {
  it('computes p95 and skips /metrics paths', () => {
    const metrics = createMetricsCollector();
    for (let i = 1; i <= 20; i += 1) {
      metrics.record('GET', '/health', 200, i);
    }
    metrics.record('GET', '/metrics', 200, 9999);
    const snap = metrics.snapshot();
    expect(snap.requestsTotal).toBe(20);
    expect(snap.latencyMs.p95).toBe(19);
    expect(snap.byRoute['GET /metrics']).toBeUndefined();
  });
});
