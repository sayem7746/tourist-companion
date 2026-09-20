import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('allows development defaults without DATABASE_URL', () => {
    const cfg = loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: '3000',
    });
    expect(cfg.APP_ENV).toBe('development');
    expect(cfg.JWT_SECRET.length).toBeGreaterThanOrEqual(16);
  });

  it('rejects staging without a strong JWT_SECRET and DATABASE_URL', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        HOST: '0.0.0.0',
        PORT: '3000',
        JWT_SECRET: 'dev-only-insecure-jwt-secret',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('accepts production when secrets are set', () => {
    const cfg = loadConfig({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: '3000',
      DATABASE_URL: 'postgres://user:pass@db:5432/tourist_companion',
      JWT_SECRET: 'production-grade-secret-value-32chars',
      FRONTEND_ORIGIN: 'https://app.example.com',
    });
    expect(cfg.APP_ENV).toBe('production');
  });
});
