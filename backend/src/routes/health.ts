import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pingDatabase } from '../db/pool.js';
import { validateRequest } from '../validate.js';

const healthQuerySchema = z
  .object({
    verbose: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })
  .strict();

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (request) => {
    const { query } = validateRequest(request, { query: healthQuerySchema });
    const payload = {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    };

    if (query.verbose) {
      let database: 'up' | 'down' | 'skipped' = 'skipped';
      if (app.db) {
        try {
          database = (await pingDatabase(app.db)) ? 'up' : 'down';
        } catch {
          database = 'down';
        }
      }

      const metrics = app.metrics.snapshot();
      return {
        ...payload,
        uptimeSeconds: process.uptime(),
        database,
        metrics: {
          requestsTotal: metrics.requestsTotal,
          errorsTotal: metrics.errorsTotal,
          latencyMs: {
            p50: metrics.latencyMs.p50,
            p95: metrics.latencyMs.p95,
            p99: metrics.latencyMs.p99,
            max: metrics.latencyMs.max,
          },
        },
      };
    }

    return payload;
  });
}
