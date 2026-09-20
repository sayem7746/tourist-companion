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
      LLM_API_KEY: 'sk-test-not-used-in-this-assertion',
    });
    expect(cfg.APP_ENV).toBe('production');
    expect(cfg.LLM_MODEL).toBe('gpt-4o-mini');
    expect(cfg.CONCIERGE_HISTORY_MAX_MESSAGES).toBe(20);
    expect(cfg.CONCIERGE_HISTORY_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(cfg.PLACES_PROVIDER).toBeUndefined();
    expect(cfg.GOOGLE_PLACES_BASE_URL).toBe('https://places.googleapis.com');
    expect(cfg.OVERPASS_URL).toBe('https://overpass-api.de/api/interpreter');
    expect(cfg.PLACES_PROVIDER).toBeUndefined();
    expect(cfg.GOOGLE_PLACES_BASE_URL).toBe('https://places.googleapis.com');
    expect(cfg.OVERPASS_URL).toBe('https://overpass-api.de/api/interpreter');
    expect(cfg.WEATHER_PROVIDER).toBeUndefined();
    expect(cfg.OPEN_METEO_BASE_URL).toBe('https://api.open-meteo.com');
    expect(cfg.WEATHER_TIMEOUT_MS).toBe(2_500);
  });
});
