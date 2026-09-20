import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { ServiceUnavailableError } from '../errors.js';
import { validateRequest } from '../validate.js';
import { recommendHotelTransfers } from './hotel-transfer.js';
import { ARRIVAL_CONNECTIVITY_OPTIONS, ARRIVAL_CONNECTIVITY_TIPS } from './connectivity-content.js';
import { ARRIVAL_TRANSPORT_SEED } from './transport-content.js';
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

  const transportQuerySchema = z
    .object({
      airport: z.enum(ARRIVAL_AIRPORTS).optional().default(DEFAULT_ARRIVAL_AIRPORT),
    })
    .strict();

  app.get('/arrival-transport', async (request) => {
    const { query } = validateRequest(request, { query: transportQuerySchema });
    const options = ARRIVAL_TRANSPORT_SEED.filter((option) => option.airportCode === query.airport).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    return {
      airportCode: query.airport,
      options,
    };
  });

  app.get('/arrival-connectivity', async (request) => {
    const { query } = validateRequest(request, { query: transportQuerySchema });
    const options = ARRIVAL_CONNECTIVITY_OPTIONS.filter((option) => option.airportCode === query.airport).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    const tips = ARRIVAL_CONNECTIVITY_TIPS.filter((tip) => tip.airportCode === query.airport).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    return {
      airportCode: query.airport,
      options,
      tips,
    };
  });

  const transferQuerySchema = z
    .object({
      airport: z.enum(ARRIVAL_AIRPORTS).optional().default(DEFAULT_ARRIVAL_AIRPORT),
      destination: z.string().trim().min(2).max(120),
    })
    .strict();

  app.get('/arrival-transfer', async (request) => {
    const { query } = validateRequest(request, { query: transferQuerySchema });
    return recommendHotelTransfers(query.airport, query.destination);
  });
}
