import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { createMemoryAuthStore } from './auth/memory-store.js';
import { createPgAuthStore } from './auth/pg-store.js';
import { registerAuthRoutes } from './auth/routes.js';
import type { AuthStore } from './auth/types.js';
import { createMemoryProfileStore } from './profile/memory-store.js';
import { createPgProfileStore } from './profile/pg-store.js';
import { registerProfileRoutes } from './profile/routes.js';
import type { ProfileStore } from './profile/types.js';
import { createMemoryArrivalStore } from './arrival/memory-store.js';
import { createPgArrivalStore } from './arrival/pg-store.js';
import { registerArrivalRoutes } from './arrival/routes.js';
import type { ArrivalChecklistStore } from './arrival/types.js';
import { createMemoryTripStore } from './trips/memory-store.js';
import { createPgTripStore } from './trips/pg-store.js';
import { registerTripRoutes } from './trips/routes.js';
import type { TripStore } from './trips/types.js';
import { createMemoryItineraryStore } from './itinerary/memory-store.js';
import { createPgItineraryStore } from './itinerary/pg-store.js';
import { registerItineraryRoutes } from './itinerary/routes.js';
import type { ItineraryStore } from './itinerary/types.js';
import type { AppConfig } from './config.js';
import { registerDb } from './db/pool.js';
import { AppError, NotFoundError } from './errors.js';
import { serializeErrorForLog } from './observability/error-log.js';
import { createMetricsCollector } from './observability/metrics.js';
import { REQUEST_ID_HEADER, resolveRequestId } from './observability/request-id.js';
import { registerConciergeRoutes } from './concierge/routes.js';
import { createMemoryConciergeHistoryStore } from './concierge/memory-store.js';
import { createPgConciergeHistoryStore } from './concierge/pg-store.js';
import type { ConciergeHistoryStore } from './concierge/history-types.js';
import { registerEmbassyRoutes } from './embassies/routes.js';
import { registerEmergencyRoutes } from './emergency/routes.js';
import { registerSafetyRoutes } from './safety/routes.js';
import { registerKnowledgeRoutes } from './knowledge/routes.js';
import { registerContentAdminRoutes } from './content/routes.js';
import { registerFaqRoutes } from './faqs/routes.js';
import { createMemoryContentStore } from './content/memory-store.js';
import { createPgContentStore } from './content/pg-store.js';
import type { ContentStore } from './content/types.js';
import { registerPartnerAdminRoutes, registerPartnerPublicRoutes } from './partners/routes.js';
import { registerReferralRoutes } from './partners/referral-routes.js';
import { createMemoryPartnerStore } from './partners/memory-store.js';
import { createPgPartnerStore } from './partners/pg-store.js';
import type { PartnerStore } from './partners/types.js';
import { registerPlacesRoutes } from './places/routes.js';
import { registerDashboardRoutes } from './dashboard/routes.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMetricsRoutes } from './routes/metrics.js';

export function buildApp(config: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      serializers: {
        err(error) {
          const serialized = serializeErrorForLog(error, config);
          return {
            type: serialized.type ?? 'Error',
            message: serialized.message,
            stack: serialized.stack ?? '',
            code: serialized.code,
            statusCode: serialized.statusCode,
          };
        },
      },
    },
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: resolveRequestId,
    disableRequestLogging: true,
  });

  app.decorate('metrics', createMetricsCollector());

  void registerDb(app, config);

  app.addHook('onRequest', async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);

    const origin = request.headers.origin;
    if (origin === config.FRONTEND_ORIGIN) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Request-Id, X-Admin-Token',
      );
      reply.header(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      );
      reply.header('Access-Control-Expose-Headers', 'X-Request-Id');
    }

    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  app.setNotFoundHandler((request) => {
    throw new NotFoundError(`Route ${request.method} ${request.url} not found`);
  });

  app.setErrorHandler((error, request, reply) => {
    const errLog = serializeErrorForLog(error, config);

    if (error instanceof AppError) {
      request.log.warn(
        { err: error, code: error.code, details: error.details, requestId: request.id },
        error.message,
      );
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
    }

    if (error instanceof ZodError) {
      request.log.warn({ err: error, requestId: request.id }, 'Validation failed');
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.flatten(),
          requestId: request.id,
        },
      });
    }

    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;

    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id, ...errLog }, message);
    } else {
      request.log.warn({ err: error, requestId: request.id }, message);
    }

    return reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message:
          config.NODE_ENV === 'production' && statusCode >= 500
            ? 'An unexpected error occurred'
            : message,
        requestId: request.id,
      },
    });
  });

  app.addHook('onRequest', async (request) => {
    request.log.info(
      { method: request.method, url: request.url, requestId: request.id },
      'incoming request',
    );
  });

  app.addHook('onResponse', async (request, reply) => {
    const durationMs = reply.elapsedTime;
    app.metrics.record(request.method, request.url, reply.statusCode, durationMs);
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        requestId: request.id,
      },
      'request completed',
    );
  });

  void registerHealthRoutes(app);
  void registerMetricsRoutes(app);
  void registerEmergencyRoutes(app, config);
  void registerEmbassyRoutes(app, config);
  void registerSafetyRoutes(app, config);
  void registerPlacesRoutes(app, config);

  let memoryAuthStore: AuthStore | undefined;
  let memoryProfileStore: ProfileStore | undefined;
  let memoryTripStore: TripStore | undefined;
  let memoryItineraryStore: ItineraryStore | undefined;
  let memoryArrivalStore: ArrivalChecklistStore | undefined;
  let memoryHistoryStore: ConciergeHistoryStore | undefined;
  let memoryPartnerStore: PartnerStore | undefined;
  let memoryContentStore: ContentStore | undefined;

  const resolveAuthStore = (): AuthStore | undefined => {
    if (app.db) {
      return createPgAuthStore(app.db);
    }
    if (config.NODE_ENV === 'test') {
      memoryAuthStore ??= createMemoryAuthStore();
      return memoryAuthStore;
    }
    return undefined;
  };

  const resolveProfileStore = (): ProfileStore | undefined => {
    if (app.db) {
      return createPgProfileStore(app.db);
    }
    if (config.NODE_ENV === 'test') {
      const authStore = resolveAuthStore();
      if (!authStore) return undefined;
      memoryProfileStore ??= createMemoryProfileStore(authStore);
      return memoryProfileStore;
    }
    return undefined;
  };

  const resolveTripStore = (): TripStore | undefined => {
    if (app.db) {
      return createPgTripStore(app.db);
    }
    if (config.NODE_ENV === 'test') {
      memoryTripStore ??= createMemoryTripStore();
      return memoryTripStore;
    }
    return undefined;
  };

  const resolveItineraryStore = (): ItineraryStore | undefined => {
    const tripStore = resolveTripStore();
    if (!tripStore) return undefined;
    if (app.db) {
      return createPgItineraryStore(app.db, tripStore);
    }
    if (config.NODE_ENV === 'test') {
      memoryItineraryStore ??= createMemoryItineraryStore(tripStore);
      return memoryItineraryStore;
    }
    return undefined;
  };

  const resolveHistoryStore = (): ConciergeHistoryStore | undefined => {
    if (app.db) {
      return createPgConciergeHistoryStore(app.db);
    }
    if (config.NODE_ENV === 'test') {
      memoryHistoryStore ??= createMemoryConciergeHistoryStore();
      return memoryHistoryStore;
    }
    return undefined;
  };

  const resolvePartnerStore = (): PartnerStore | undefined => {
    if (app.db) {
      return createPgPartnerStore(app.db);
    }
    if (config.NODE_ENV === 'test') {
      memoryPartnerStore ??= createMemoryPartnerStore();
      return memoryPartnerStore;
    }
    return undefined;
  };

  const resolveContentStore = (): ContentStore | undefined => {
    if (app.db) {
      return createPgContentStore(app.db);
    }
    if (config.NODE_ENV === 'test') {
      memoryContentStore ??= createMemoryContentStore();
      return memoryContentStore;
    }
    return undefined;
  };

  app.decorate('getAuthStore', resolveAuthStore);

  void registerAuthRoutes(app, config, resolveAuthStore);
  void registerProfileRoutes(app, config, resolveProfileStore);
  void registerTripRoutes(app, config, resolveTripStore);
  void registerItineraryRoutes(app, config, resolveItineraryStore, resolveTripStore);
  void registerKnowledgeRoutes(app, config, resolveContentStore);
  void registerConciergeRoutes(app, config, {
    resolveProfileStore,
    resolveTripStore,
    resolveHistoryStore,
    resolveContentStore,
  });

  void registerArrivalRoutes(app, config, () => {
    if (app.db) {
      return createPgArrivalStore(app.db);
    }
    if (config.NODE_ENV === 'test') {
      memoryArrivalStore ??= createMemoryArrivalStore();
      return memoryArrivalStore;
    }
    return undefined;
  });

  void registerPartnerPublicRoutes(app, config, resolvePartnerStore);
  void registerPartnerAdminRoutes(app, config, resolvePartnerStore);
  void registerReferralRoutes(app, config, resolvePartnerStore);
  void registerContentAdminRoutes(app, config, resolveContentStore);
  void registerFaqRoutes(app, config, resolveContentStore);
  void registerDashboardRoutes(app, config, {
    resolveAuthStore,
    resolveTripStore,
    resolvePartnerStore,
  });

  return app;
}
