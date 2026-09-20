import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { validateRequest } from '../validate.js';
import { queryEmergency } from './query.js';
import { EMERGENCY_CATEGORIES, EMERGENCY_URGENCIES } from './types.js';

const querySchema = z
  .object({
    category: z.enum(EMERGENCY_CATEGORIES).optional(),
    urgency: z.enum(EMERGENCY_URGENCIES).optional(),
  })
  .strict();

export async function registerEmergencyRoutes(
  app: FastifyInstance,
  _config: AppConfig,
): Promise<void> {
  app.get('/emergency', async (request) => {
    const { query } = validateRequest(request, { query: querySchema });
    return queryEmergency({
      category: query.category,
      urgency: query.urgency,
    });
  });
}
