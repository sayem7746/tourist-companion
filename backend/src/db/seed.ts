import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

loadEnv();

const { Pool } = pg;

async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to seed the database');
  }

  const seedPath = path.resolve(process.cwd(), 'db/seed.sql');
  const seedSql = await readFile(seedPath, 'utf8');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query('BEGIN');
    await pool.query(seedSql);
    await pool.query('COMMIT');
    console.log('Seed complete (idempotent).');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

try {
  await seed();
} catch (error) {
  console.error(error);
  process.exit(1);
}
