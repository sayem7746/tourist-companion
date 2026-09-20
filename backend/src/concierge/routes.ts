import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { optionalAuth } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import { hasUsableLlmKey } from '../config.js';
import { TooManyRequestsError } from '../errors.js';
import { CONCIERGE_CATEGORIES } from '../knowledge/types.js';
import { validateRequest } from '../validate.js';
import { createOpenAiCompatibleClient, type LlmClient } from './llm.js';
import type { ProfileStore } from '../profile/types.js';
import type { TripStore } from '../trips/types.js';
import { orchestrateConciergeChat } from './orchestrate.js';
import { SlidingWindowLimiter } from './rate-limit.js';
import { loadStoredConciergeContext } from './trip-context.js';

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
    history: z.array(historySchema).max(10).optional(),
    context: contextSchema.optional(),
    categoryHint: z.enum(CONCIERGE_CATEGORIES).optional(),
  })
  .strict();

function clientKey(request: { ip: string; user?: { id: string } }): string {
  return request.user?.id ? `user:${request.user.id}` : `ip:${request.ip}`;
}

export async function registerConciergeRoutes(
  app: FastifyInstance,
  config: AppConfig,
  options?: {
    llm?: LlmClient;
    limiter?: SlidingWindowLimiter;
    resolveProfileStore?: () => ProfileStore | undefined;
    resolveTripStore?: () => TripStore | undefined;
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

    const stored =
      request.user?.id
        ? await loadStoredConciergeContext(request.user.id, {
            profileStore: options?.resolveProfileStore?.(),
            tripStore: options?.resolveTripStore?.(),
          }, { displayName: request.user.displayName })
        : undefined;

    const result = await orchestrateConciergeChat(body, { llm, useLlm }, request.user, stored);
    request.log.info(
      {
        requestId: request.id,
        category: result.analytics.category,
        escalationLevel: result.analytics.escalationLevel,
        mode: result.mode,
      },
      'concierge chat',
    );
    return result;
  });
}
