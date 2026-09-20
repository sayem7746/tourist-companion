import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../errors.js';
import { getPlaceDetails } from '../places/details.js';
import { validateRequest } from '../validate.js';
import {
  DAILY_BUDGETS,
  INTERESTS,
  TRAVEL_STYLES,
  TRIP_STATUSES,
  type TripStore,
} from './types.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date (YYYY-MM-DD)')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: 'Invalid calendar date',
  });

const isoDateTime = z.string().datetime();

const optionalText = z.string().trim().min(1).max(200).nullable();

const datesAfter = <T extends { startDate?: string; endDate?: string }>(
  value: T,
): boolean => {
  if (!value.startDate || !value.endDate) return true;
  return value.endDate > value.startDate;
};

const createSchema = z
  .object({
    destination: z.string().trim().min(1).max(120),
    startDate: isoDate,
    endDate: isoDate,
    adultCount: z.number().int().min(1).max(99),
    childCount: z.number().int().min(0).max(99).optional().default(0),
    interests: z.array(z.enum(INTERESTS)).min(1),
    dailyBudget: z.enum(DAILY_BUDGETS).nullable().optional(),
    travelStyle: z.enum(TRAVEL_STYLES).nullable().optional(),
    accommodationName: optionalText.optional(),
    arrivalAirport: optionalText.optional(),
    arrivalFlight: optionalText.optional(),
    arrivalAt: isoDateTime.nullable().optional(),
    status: z.enum(TRIP_STATUSES).optional(),
  })
  .strict()
  .refine(datesAfter, { message: 'endDate must be after startDate', path: ['endDate'] });

const patchSchema = z
  .object({
    destination: z.string().trim().min(1).max(120).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    adultCount: z.number().int().min(1).max(99).optional(),
    childCount: z.number().int().min(0).max(99).optional(),
    interests: z.array(z.enum(INTERESTS)).min(1).optional(),
    dailyBudget: z.enum(DAILY_BUDGETS).nullable().optional(),
    travelStyle: z.enum(TRAVEL_STYLES).nullable().optional(),
    accommodationName: optionalText.optional(),
    arrivalAirport: optionalText.optional(),
    arrivalFlight: optionalText.optional(),
    arrivalAt: isoDateTime.nullable().optional(),
    status: z.enum(TRIP_STATUSES).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one trip field is required',
  })
  .refine(datesAfter, { message: 'endDate must be after startDate', path: ['endDate'] });

const idParams = z.object({
  id: z.string().uuid(),
});

const placeIdParams = z.object({
  id: z.string().uuid(),
  placeId: z.string().trim().min(1).max(160),
});

const savePlaceSchema = z
  .object({
    placeId: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export async function registerTripRoutes(
  app: FastifyInstance,
  config: AppConfig,
  resolveStore: () => TripStore | undefined,
): Promise<void> {
  const getStore = (): TripStore => {
    const store = resolveStore();
    if (!store) {
      throw new ServiceUnavailableError('Trip store is not configured');
    }
    return store;
  };

  const requireUserId = (request: { user?: { id: string } }): string => {
    const userId = request.user?.id;
    if (!userId) {
      throw new ValidationError('Authenticated user is missing');
    }
    return userId;
  };

  const auth = { preHandler: requireAuth(config) };

  app.get('/trips', auth, async (request) => {
    const trips = await getStore().list(requireUserId(request));
    return { trips };
  });

  app.get('/trips/:id', auth, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    const trip = await getStore().get(requireUserId(request), params.id);
    if (!trip) {
      throw new NotFoundError('Trip not found');
    }
    return { trip };
  });

  app.post('/trips', auth, async (request, reply) => {
    const { body } = validateRequest(request, { body: createSchema });
    const trip = await getStore().create(requireUserId(request), body);
    return reply.status(201).send({ trip });
  });

  app.patch('/trips/:id', auth, async (request) => {
    const { params, body } = validateRequest(request, { params: idParams, body: patchSchema });
    const store = getStore();
    const userId = requireUserId(request);
    const current = await store.get(userId, params.id);
    if (!current) {
      throw new NotFoundError('Trip not found');
    }
    const startDate = body.startDate ?? current.startDate;
    const endDate = body.endDate ?? current.endDate;
    if (endDate <= startDate) {
      throw new ValidationError('endDate must be after startDate');
    }
    const trip = await store.update(userId, params.id, body);
    if (!trip) {
      throw new NotFoundError('Trip not found');
    }
    return { trip };
  });

  app.delete('/trips/:id', auth, async (request, reply) => {
    const { params } = validateRequest(request, { params: idParams });
    const deleted = await getStore().delete(requireUserId(request), params.id);
    if (!deleted) {
      throw new NotFoundError('Trip not found');
    }
    return reply.status(204).send();
  });

  app.get('/trips/:id/places', auth, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    const places = await getStore().listPlaces(requireUserId(request), params.id);
    if (!places) {
      throw new NotFoundError('Trip not found');
    }
    return { places };
  });

  app.post('/trips/:id/places', auth, async (request, reply) => {
    const { params, body } = validateRequest(request, { params: idParams, body: savePlaceSchema });
    const userId = requireUserId(request);
    const store = getStore();
    const trip = await store.get(userId, params.id);
    if (!trip) {
      throw new NotFoundError('Trip not found');
    }
    const details = await getPlaceDetails(config, { id: body.placeId });
    const existing = await store.listPlaces(userId, params.id);
    const alreadySaved = existing?.some((place) => place.placeId === body.placeId);
    const saved = await store.savePlace(userId, params.id, {
      placeId: body.placeId,
      name: details.name,
      category: details.category,
      city: details.city ?? null,
      address: details.address ?? null,
      description: details.description ?? null,
      latitude: details.latitude,
      longitude: details.longitude,
      country: details.country ?? 'MY',
      notes: body.notes ?? null,
    });
    if (!saved) {
      throw new NotFoundError('Trip not found');
    }
    return reply.status(alreadySaved ? 200 : 201).send({ place: saved });
  });

  app.delete('/trips/:id/places/:placeId', auth, async (request, reply) => {
    const { params } = validateRequest(request, { params: placeIdParams });
    const removed = await getStore().removePlace(requireUserId(request), params.id, params.placeId);
    if (removed == null) {
      throw new NotFoundError('Trip not found');
    }
    if (!removed) {
      throw new NotFoundError('Saved place not found');
    }
    return reply.status(204).send();
  });
}
