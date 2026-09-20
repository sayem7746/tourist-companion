import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { TooManyRequestsError } from '../errors.js';
import { SlidingWindowLimiter } from '../rate-limit.js';
import { validateRequest } from '../validate.js';
import { getPlaceDetails } from './details.js';
import { searchNearbyPlaces } from './search.js';
import {
  NEARBY_AREA_IDS,
  NEARBY_AREAS,
  NEARBY_CATEGORY_CHIPS,
  NEARBY_CHIP_IDS,
  NEARBY_QUICK_FILTER_CHIPS,
} from './types.js';

const boolQuery = z.enum(['true', 'false']).optional();

const nearbyQuerySchema = z
  .object({
    lat: z.coerce.number().gte(-90).lte(90).optional(),
    lng: z.coerce.number().gte(-180).lte(180).optional(),
    radius: z.coerce.number().int().min(100).max(20_000).optional(),
    category: z.enum(NEARBY_CHIP_IDS).optional(),
    q: z.string().trim().min(2).max(80).optional(),
    openNow: boolQuery,
    halalOnly: boolQuery,
    walk15: boolQuery,
    area: z.enum(NEARBY_AREA_IDS).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.lat == null) !== (value.lng == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lat and lng must be provided together',
        path: ['lat'],
      });
    }
  });

const placeIdParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
  })
  .strict();

const placeIdQuerySchema = z
  .object({
    lat: z.coerce.number().gte(-90).lte(90).optional(),
    lng: z.coerce.number().gte(-180).lte(180).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.lat == null) !== (value.lng == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lat and lng must be provided together',
        path: ['lat'],
      });
    }
  });

function asBool(value: 'true' | 'false' | undefined): boolean | undefined {
  if (value == null) return undefined;
  return value === 'true';
}

export async function registerPlacesRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  const limiter = new SlidingWindowLimiter(
    config.PLACES_RATE_LIMIT_MAX,
    config.PLACES_RATE_LIMIT_WINDOW_MS,
  );

  const enforcePlacesRateLimit = (
    request: { ip: string },
    reply: { header: (k: string, v: string) => unknown },
  ): void => {
    const limited = limiter.take(`ip:${request.ip}`);
    if (!limited.ok) {
      reply.header('Retry-After', String(limited.retryAfterSeconds));
      throw new TooManyRequestsError(
        'Places rate limit exceeded. Try again shortly.',
        limited.retryAfterSeconds,
      );
    }
  };

  app.get('/places/categories', async () => ({
    country: 'MY',
    destination: 'Malaysia',
    chips: NEARBY_CATEGORY_CHIPS,
    quickFilters: NEARBY_QUICK_FILTER_CHIPS,
    areas: NEARBY_AREAS,
  }));

  app.get('/places/nearby', async (request, reply) => {
    enforcePlacesRateLimit(request, reply);
    const { query } = validateRequest(request, { query: nearbyQuerySchema });
    return searchNearbyPlaces(config, {
      latitude: query.lat,
      longitude: query.lng,
      radiusMeters: query.radius,
      category: query.category,
      q: query.q,
      openNow: asBool(query.openNow),
      halalOnly: asBool(query.halalOnly),
      walk15: asBool(query.walk15),
      areaId: query.area,
    });
  });

  app.get('/places/:id', async (request, reply) => {
    enforcePlacesRateLimit(request, reply);
    const { params, query } = validateRequest(request, {
      params: placeIdParamsSchema,
      query: placeIdQuerySchema,
    });
    return getPlaceDetails(config, {
      id: params.id,
      latitude: query.lat,
      longitude: query.lng,
    });
  });
}
