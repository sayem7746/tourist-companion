import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../errors.js';
import type { TripStore } from '../trips/types.js';
import { validateRequest } from '../validate.js';
import { attachDayWeather } from '../weather/attach.js';
import { createWeatherClientFromConfig } from '../weather/client.js';
import type { WeatherClient } from '../weather/types.js';
import { planItinerary } from './generate.js';
import { ITINERARY_ITEM_KINDS, ITINERARY_STATUSES, type Itinerary, type ItineraryStore } from './types.js';

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:mm');

const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), {
    message: 'bookingUrl must be an https URL',
  });

const optionalText = z.string().trim().min(1).max(200).nullable();
const optionalNotes = z.string().trim().min(1).max(2000).nullable();
const optionalPlaceId = z.string().trim().min(1).max(160).nullable();

const itemFields = {
  kind: z.enum(ITINERARY_ITEM_KINDS),
  startTime: time,
  endTime: time,
  placeId: optionalPlaceId.optional(),
  travelTimeMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  notes: optionalNotes.optional(),
  bookingUrl: httpsUrl.nullable().optional(),
  referralPartnerId: z.string().uuid().nullable().optional(),
  locked: z.boolean().optional(),
  title: optionalText.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
};

const timesAfter = <T extends { startTime?: string; endTime?: string }>(value: T): boolean => {
  if (!value.startTime || !value.endTime) return true;
  return value.endTime > value.startTime;
};

const createItemSchema = z
  .object({
    ...itemFields,
    dayId: z.string().uuid().optional(),
    dayNumber: z.number().int().min(1).max(7).optional(),
  })
  .strict()
  .refine((value) => value.dayId != null || value.dayNumber != null, {
    message: 'dayId or dayNumber is required',
  })
  .refine(timesAfter, { message: 'endTime must be after startTime', path: ['endTime'] });

const patchItemSchema = z
  .object({
    kind: itemFields.kind.optional(),
    startTime: time.optional(),
    endTime: time.optional(),
    placeId: optionalPlaceId.optional(),
    travelTimeMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
    notes: optionalNotes.optional(),
    bookingUrl: httpsUrl.nullable().optional(),
    referralPartnerId: z.string().uuid().nullable().optional(),
    locked: z.boolean().optional(),
    title: optionalText.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    dayId: z.string().uuid().optional(),
    dayNumber: z.number().int().min(1).max(7).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one item field is required',
  })
  .refine(timesAfter, { message: 'endTime must be after startTime', path: ['endTime'] });

const putDaySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dayNumber: z.number().int().min(1).max(7).optional(),
    items: z
      .array(
        z
          .object(itemFields)
          .strict()
          .refine(timesAfter, { message: 'endTime must be after startTime', path: ['endTime'] }),
      )
      .max(40),
  })
  .strict()
  .refine((value) => value.date != null || value.dayNumber != null, {
    message: 'date or dayNumber is required',
  });

const putSchema = z
  .object({
    status: z.enum(ITINERARY_STATUSES).optional(),
    days: z.array(putDaySchema).max(7).optional(),
  })
  .strict();

const reorderSchema = z
  .object({
    dayId: z.string().uuid(),
    itemIds: z.array(z.string().uuid()).max(40),
  })
  .strict();

const regenerateSchema = z
  .object({
    dayId: z.string().uuid().optional(),
    dayNumber: z.number().int().min(1).max(7).optional(),
  })
  .strict();

const tripParams = z.object({
  id: z.string().uuid(),
});

const itemParams = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});

export async function registerItineraryRoutes(
  app: FastifyInstance,
  config: AppConfig,
  resolveStore: () => ItineraryStore | undefined,
  resolveTripStore: () => TripStore | undefined,
  resolveWeather: () => WeatherClient = () => createWeatherClientFromConfig(config),
): Promise<void> {
  const getStore = (): ItineraryStore => {
    const store = resolveStore();
    if (!store) {
      throw new ServiceUnavailableError('Itinerary store is not configured');
    }
    return store;
  };

  const getTripStore = (): TripStore => {
    const store = resolveTripStore();
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

  const withWeather = async (userId: string, tripId: string, itinerary: Itinerary): Promise<Itinerary> => {
    const trip = await getTripStore().get(userId, tripId);
    if (!trip) return itinerary;
    return attachDayWeather(itinerary, trip.destination, resolveWeather());
  };

  app.get('/trips/:id/itinerary', auth, async (request) => {
    const { params } = validateRequest(request, { params: tripParams });
    const userId = requireUserId(request);
    const itinerary = await getStore().get(userId, params.id);
    if (!itinerary) {
      throw new NotFoundError('Trip not found');
    }
    return { itinerary: await withWeather(userId, params.id, itinerary) };
  });

  app.put('/trips/:id/itinerary', auth, async (request) => {
    const { params, body } = validateRequest(request, { params: tripParams, body: putSchema });
    const userId = requireUserId(request);
    const itinerary = await getStore().put(userId, params.id, body);
    if (!itinerary) {
      throw new NotFoundError('Trip not found');
    }
    return { itinerary: await withWeather(userId, params.id, itinerary) };
  });

  app.post('/trips/:id/itinerary/items', auth, async (request, reply) => {
    const { params, body } = validateRequest(request, { params: tripParams, body: createItemSchema });
    const userId = requireUserId(request);
    const itinerary = await getStore().createItem(userId, params.id, body);
    if (!itinerary) {
      throw new NotFoundError('Trip not found');
    }
    return reply.status(201).send({ itinerary: await withWeather(userId, params.id, itinerary) });
  });

  app.patch('/trips/:id/itinerary/items/:itemId', auth, async (request) => {
    const { params, body } = validateRequest(request, { params: itemParams, body: patchItemSchema });
    const userId = requireUserId(request);
    const itinerary = await getStore().updateItem(userId, params.id, params.itemId, body);
    if (!itinerary) {
      throw new NotFoundError('Itinerary item not found');
    }
    return { itinerary: await withWeather(userId, params.id, itinerary) };
  });

  app.delete('/trips/:id/itinerary/items/:itemId', auth, async (request) => {
    const { params } = validateRequest(request, { params: itemParams });
    const userId = requireUserId(request);
    const itinerary = await getStore().deleteItem(userId, params.id, params.itemId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary item not found');
    }
    return { itinerary: await withWeather(userId, params.id, itinerary) };
  });

  app.post('/trips/:id/itinerary/reorder', auth, async (request) => {
    const { params, body } = validateRequest(request, { params: tripParams, body: reorderSchema });
    const userId = requireUserId(request);
    const itinerary = await getStore().reorder(userId, params.id, body);
    if (!itinerary) {
      throw new NotFoundError('Trip not found');
    }
    return { itinerary: await withWeather(userId, params.id, itinerary) };
  });

  const generateDraft = async (request: FastifyRequest) => {
    const { params, body } = validateRequest(request, { params: tripParams, body: regenerateSchema });
    const store = getStore();
    const userId = requireUserId(request);
    const trip = await getTripStore().get(userId, params.id);
    const itinerary = await store.get(userId, params.id);
    if (!trip || !itinerary) {
      throw new NotFoundError('Trip not found');
    }
    const scope =
      body.dayId != null || body.dayNumber != null
        ? { dayId: body.dayId, dayNumber: body.dayNumber }
        : undefined;
    if (scope) {
      const day = itinerary.days.find(
        (entry) => entry.id === body.dayId || entry.dayNumber === body.dayNumber,
      );
      if (!day) {
        throw new NotFoundError('Itinerary day not found');
      }
    }
    const planned = planItinerary(trip, itinerary, scope);
    const updated = await store.replaceUnlocked(userId, params.id, {
      days: planned.map((day) => ({ dayId: day.dayId, items: day.items })),
      generatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new NotFoundError('Trip not found');
    }
    const decorated = await withWeather(userId, params.id, updated);
    const weatherSource = decorated.days.find((day) => day.weather?.source)?.weather?.source ?? 'seed';
    return {
      itinerary: decorated,
      generation: {
        implemented: true,
        source: 'places-seed',
        weatherSource,
        daysRegenerated: planned.map((day) => day.dayNumber),
      },
    };
  };

  app.post('/trips/:id/itinerary/regenerate', auth, generateDraft);
  app.post('/trips/:id/itinerary/generate', auth, generateDraft);
}
