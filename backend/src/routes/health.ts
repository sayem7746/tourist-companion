import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
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
      return {
        ...payload,
        uptimeSeconds: process.uptime(),
      };
    }

    return payload;
  });
}
