import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { validateRequest } from '../validate.js';
import { querySafety } from './query.js';
import { SAFETY_TOPICS } from './types.js';

const querySchema = z
  .object({
    topic: z.enum(SAFETY_TOPICS).optional(),
  })
  .strict();

export async function registerSafetyRoutes(
  app: FastifyInstance,
  _config: AppConfig,
): Promise<void> {
  app.get('/safety', async (request) => {
    const { query } = validateRequest(request, { query: querySchema });
    return querySafety({
      topic: query.topic,
    });
  });
}
