import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();
if (process.env.APP_ENV) {
  loadEnv({ path: `.env.${process.env.APP_ENV}` });
}

const INSECURE_DEV_JWT = 'dev-only-insecure-jwt-secret';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16).default(INSECURE_DEV_JWT),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:4200'),
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  LLM_MODEL: z.string().min(1).default('gpt-4o-mini'),
  CONCIERGE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(30),
  CONCIERGE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  CONCIERGE_HISTORY_MAX_MESSAGES: z.coerce.number().int().min(2).max(100).default(20),
  CONCIERGE_HISTORY_TTL_MS: z.coerce.number().int().min(60_000).default(7 * 24 * 60 * 60 * 1000),
  PLACES_PROVIDER: z.enum(['seed', 'google', 'overpass']).optional(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
  GOOGLE_PLACES_BASE_URL: z.string().url().default('https://places.googleapis.com'),
  OVERPASS_URL: z.string().url().default('https://overpass-api.de/api/interpreter'),
});

export function hasUsableApiKey(key: string | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 8) return false;
  if (trimmed.startsWith('CHANGE_ME')) return false;
  return true;
}

export function hasUsableLlmKey(key: string | undefined): boolean {
  return hasUsableApiKey(key);
}

export type AppConfig = z.infer<typeof envSchema>;

function requiresStrongSecrets(cfg: AppConfig): boolean {
  return cfg.APP_ENV === 'staging' || cfg.APP_ENV === 'production' || cfg.NODE_ENV === 'production';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
  }
  const cfg = parsed.data;
  if (requiresStrongSecrets(cfg)) {
    if (cfg.JWT_SECRET === INSECURE_DEV_JWT || cfg.JWT_SECRET.length < 32) {
      throw new Error(
        'Invalid environment configuration: staging/production require JWT_SECRET of at least 32 characters (not the development placeholder)',
      );
    }
    if (!cfg.DATABASE_URL) {
      throw new Error('Invalid environment configuration: staging/production require DATABASE_URL');
    }
  }
  return cfg;
}

export const config = loadConfig();
