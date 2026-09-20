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
});

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
