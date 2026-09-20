import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { ServiceUnavailableError } from '../errors.js';
import { validateRequest } from '../validate.js';
import {
  ARRIVAL_AIRPORTS,
  ARRIVAL_STAGES,
  DEFAULT_ARRIVAL_AIRPORT,
  type ArrivalChecklistStore,
} from './types.js';

const querySchema = z
  .object({
    airport: z.enum(ARRIVAL_AIRPORTS).optional().default(DEFAULT_ARRIVAL_AIRPORT),
    stage: z.enum(ARRIVAL_STAGES).optional(),
  })
  .strict();

export async function registerArrivalRoutes(
  app: FastifyInstance,
  _config: AppConfig,
  resolveStore: () => ArrivalChecklistStore | undefined,
): Promise<void> {
  const getStore = (): ArrivalChecklistStore => {
    const store = resolveStore();
    if (!store) {
      throw new ServiceUnavailableError('Arrival checklist store is not configured');
    }
    return store;
  };

  app.get('/arrival-checklist', async (request) => {
    const { query } = validateRequest(request, { query: querySchema });
    const items = await getStore().list(query.airport, query.stage);
    return {
      airportCode: query.airport,
      stage: query.stage ?? null,
      stages: [...ARRIVAL_STAGES],
      items,
    };
  });
}
