import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { createMemoryAuthStore } from './auth/memory-store.js';
import { createPgAuthStore } from './auth/pg-store.js';
import { registerAuthRoutes } from './auth/routes.js';
import type { AuthStore } from './auth/types.js';
import type { AppConfig } from './config.js';
import { registerDb } from './db/pool.js';
import { AppError, NotFoundError } from './errors.js';
import { registerHealthRoutes } from './routes/health.js';

export function buildApp(config: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  void registerDb(app, config);

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin === config.FRONTEND_ORIGIN) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization',
      );
      reply.header(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      );
    }

    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  app.setNotFoundHandler((request) => {
    throw new NotFoundError(`Route ${request.method} ${request.url} not found`);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn(
        { err: error, code: error.code, details: error.details },
        error.message,
      );
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    if (error instanceof ZodError) {
      request.log.warn({ err: error }, 'Validation failed');
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.flatten(),
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

    request.log.error({ err: error }, message);
    return reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message:
          config.NODE_ENV === 'production' && statusCode >= 500
            ? 'An unexpected error occurred'
            : message,
      },
    });
  });

  app.addHook('onRequest', async (request) => {
    request.log.info(
      { method: request.method, url: request.url },
      'incoming request',
    );
  });

  void registerHealthRoutes(app);

  let memoryStore: AuthStore | undefined;
  void registerAuthRoutes(app, config, () => {
    if (app.db) {
      return createPgAuthStore(app.db);
    }
    if (config.NODE_ENV === 'test') {
      memoryStore ??= createMemoryAuthStore();
      return memoryStore;
    }
    return undefined;
  });

  return app;
}
