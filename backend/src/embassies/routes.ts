import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { validateRequest } from '../validate.js';
import { queryEmbassies } from './query.js';
import { MISSION_KINDS } from './types.js';

const querySchema = z
  .object({
    q: z.string().trim().min(2).max(80).optional(),
    kind: z.enum(MISSION_KINDS).optional(),
  })
  .strict();

export async function registerEmbassyRoutes(
  app: FastifyInstance,
  _config: AppConfig,
): Promise<void> {
  app.get('/embassies', async (request) => {
    const { query } = validateRequest(request, { query: querySchema });
    return queryEmbassies({
      q: query.q,
      kind: query.kind,
    });
  });
}
