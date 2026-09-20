import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import type { AppConfig } from '../config.js';

const { Pool } = pg;

declare module 'fastify' {
  interface FastifyInstance {
    db?: pg.Pool;
  }
}

export async function registerDb(
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> {
  if (!config.DATABASE_URL) {
    app.log.warn('DATABASE_URL is not set; skipping PostgreSQL pool');
    return;
  }

  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
  });

  app.decorate('db', pool);

  app.addHook('onClose', async () => {
    await pool.end();
  });
}

export async function pingDatabase(pool: pg.Pool): Promise<boolean> {
  const result = await pool.query<{ ok: number | string }>('SELECT 1 AS ok');
  return Number(result.rows[0]?.ok) === 1;
}
