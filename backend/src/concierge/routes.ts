import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import { hasUsableLlmKey } from '../config.js';
import { NotFoundError, TooManyRequestsError } from '../errors.js';
import { CONCIERGE_CATEGORIES } from '../knowledge/types.js';
import { validateRequest } from '../validate.js';
import { createOpenAiCompatibleClient, type LlmClient } from './llm.js';
import type { ProfileStore } from '../profile/types.js';
import type { TripStore } from '../trips/types.js';
import {
  contextHistory,
  historyRetention,
  publicHistoryMessages,
  shouldPersistHistory,
  type ConciergeHistoryStore,
} from './history-types.js';
import { orchestrateConciergeChat } from './orchestrate.js';
import { SlidingWindowLimiter } from './rate-limit.js';
import { loadStoredConciergeContext, malaysiaTodayIso, selectCurrentTrip } from './trip-context.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date (YYYY-MM-DD)');

const contextSchema = z
  .object({
    area: z.string().trim().min(1).max(80).optional(),
    tripMode: z.string().trim().min(1).max(40).optional(),
    firstName: z.string().trim().min(1).max(40).optional(),
    dietaryPreferences: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    mobilityNeeds: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    travelStyle: z.string().trim().min(1).max(40).optional(),
    destination: z.string().trim().min(1).max(120).optional(),
    tripStartDate: isoDate.optional(),
    tripEndDate: isoDate.optional(),
    itinerary: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    accommodationName: z.string().trim().min(1).max(200).optional(),
    interests: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  })
  .strict();

const historySchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2000),
  })
  .strict();

const bodySchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    conversationId: z.string().trim().min(8).max(80).optional(),
    tripId: z.string().uuid().optional(),
    history: z.array(historySchema).max(10).optional(),
    context: contextSchema.optional(),
    categoryHint: z.enum(CONCIERGE_CATEGORIES).optional(),
  })
  .strict();

const tripQuery = z
  .object({
    tripId: z.string().uuid().optional(),
  })
  .strict();

function clientKey(request: { ip: string; user?: { id: string } }): string {
  return request.user?.id ? `user:${request.user.id}` : `ip:${request.ip}`;
}

async function resolveHistoryTrip(
  userId: string,
  tripStore: TripStore | undefined,
  requestedTripId?: string,
): Promise<string | undefined> {
  if (!tripStore) return undefined;
  if (requestedTripId) {
    const trip = await tripStore.get(userId, requestedTripId);
    if (!trip) {
      throw new NotFoundError('Trip not found');
    }
    return trip.id;
  }
  const trips = await tripStore.list(userId);
  return selectCurrentTrip(trips, malaysiaTodayIso())?.id;
}

export async function registerConciergeRoutes(
  app: FastifyInstance,
  config: AppConfig,
  options?: {
    llm?: LlmClient;
    limiter?: SlidingWindowLimiter;
    resolveProfileStore?: () => ProfileStore | undefined;
    resolveTripStore?: () => TripStore | undefined;
    resolveHistoryStore?: () => ConciergeHistoryStore | undefined;
  },
): Promise<void> {
  const limiter =
    options?.limiter ??
    new SlidingWindowLimiter(config.CONCIERGE_RATE_LIMIT_MAX, config.CONCIERGE_RATE_LIMIT_WINDOW_MS);

  const useLlm = hasUsableLlmKey(config.LLM_API_KEY);
  const llm =
    options?.llm ??
    (useLlm && config.LLM_API_KEY
      ? createOpenAiCompatibleClient({
          apiKey: config.LLM_API_KEY,
          baseUrl: config.LLM_BASE_URL,
          model: config.LLM_MODEL,
        })
      : undefined);

  const retention = historyRetention(
    config.CONCIERGE_HISTORY_MAX_MESSAGES,
    config.CONCIERGE_HISTORY_TTL_MS,
  );

  const auth = { preHandler: requireAuth(config) };

  app.get('/concierge/history', auth, async (request) => {
    const { query } = validateRequest(request, { query: tripQuery });
    const userId = request.user!.id;
    const tripId = await resolveHistoryTrip(userId, options?.resolveTripStore?.(), query.tripId);
    const store = options?.resolveHistoryStore?.();
    if (!tripId || !store) {
      return {
        tripId: tripId ?? null,
        conversationId: null,
        messages: [],
        retention,
      };
    }
    const messages = await store.list(userId, tripId);
    return {
      tripId,
      conversationId: messages.at(-1)?.conversationId ?? null,
      messages: publicHistoryMessages(messages),
      retention,
    };
  });

  app.delete('/concierge/history', auth, async (request, reply) => {
    const { query } = validateRequest(request, { query: tripQuery });
    const userId = request.user!.id;
    const tripId = await resolveHistoryTrip(userId, options?.resolveTripStore?.(), query.tripId);
    if (!tripId) {
      throw new NotFoundError('Trip not found');
    }
    await options?.resolveHistoryStore?.()?.deleteForTrip(userId, tripId);
    return reply.status(204).send();
  });

  app.post('/concierge/chat', { preHandler: optionalAuth(config) }, async (request, reply) => {
    const { body } = validateRequest(request, { body: bodySchema });
    const limited = limiter.take(clientKey(request));
    if (!limited.ok) {
      reply.header('Retry-After', String(limited.retryAfterSeconds));
      throw new TooManyRequestsError(
        'Concierge rate limit exceeded. Try again shortly.',
        limited.retryAfterSeconds,
      );
    }

    const userId = request.user?.id;
    const stored =
      userId
        ? await loadStoredConciergeContext(
            userId,
            {
              profileStore: options?.resolveProfileStore?.(),
              tripStore: options?.resolveTripStore?.(),
            },
            { displayName: request.user?.displayName },
          )
        : undefined;

    const historyStore = userId ? options?.resolveHistoryStore?.() : undefined;
    const tripId = userId
      ? await resolveHistoryTrip(userId, options?.resolveTripStore?.(), body.tripId)
      : undefined;
    const storedMessages =
      userId && tripId && historyStore ? await historyStore.list(userId, tripId) : [];
    const history =
      body.history && body.history.length > 0 ? body.history : contextHistory(storedMessages);
    const conversationId =
      body.conversationId?.trim() || storedMessages.at(-1)?.conversationId;

    const result = await orchestrateConciergeChat(
      { ...body, history, conversationId },
      { llm, useLlm },
      request.user,
      stored,
    );

    let persisted = false;
    if (
      userId &&
      tripId &&
      historyStore &&
      shouldPersistHistory(result.escalationLevel)
    ) {
      await historyStore.append({
        userId,
        tripId,
        conversationId: result.conversationId,
        turns: [
          { role: 'user', content: body.message },
          { role: 'assistant', content: result.reply.text },
        ],
        maxMessages: config.CONCIERGE_HISTORY_MAX_MESSAGES,
        ttlMs: config.CONCIERGE_HISTORY_TTL_MS,
      });
      persisted = true;
    }

    request.log.info(
      {
        requestId: request.id,
        category: result.analytics.category,
        escalationLevel: result.analytics.escalationLevel,
        mode: result.mode,
        persisted,
      },
      'concierge chat',
    );
    return { ...result, tripId, persisted };
  });
}
