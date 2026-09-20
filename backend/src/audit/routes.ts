import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import { ServiceUnavailableError } from '../errors.js';
import { validateRequest } from '../validate.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditStore } from './types.js';

const optionalCount = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, 'Must be an integer')
    .transform((value) => Number(value))
    .refine((value) => value >= min && value <= max, {
      message: `Must be between ${min} and ${max}`,
    });

const listQuery = z
  .object({
    action: z.enum(AUDIT_ACTIONS).optional(),
    entityType: z.enum(AUDIT_ENTITY_TYPES).optional(),
    entityId: z.string().uuid().optional(),
    limit: optionalCount(1, 200).optional(),
    offset: optionalCount(0, 10_000).optional(),
  })
  .strict();

export async function registerAuditRoutes(
  app: FastifyInstance,
  config: AppConfig,
  resolveStore: () => AuditStore | undefined,
): Promise<void> {
  const getStore = (): AuditStore => {
    const store = resolveStore();
    if (!store) {
      throw new ServiceUnavailableError('Audit store is not configured');
    }
    return store;
  };

  app.get('/admin/audit', { preHandler: requireAdmin(config) }, async (request) => {
    const { query } = validateRequest(request, { query: listQuery });
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const { events, total } = await getStore().list({
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      limit,
      offset,
    });
    return {
      action: query.action ?? null,
      entityType: query.entityType ?? null,
      entityId: query.entityId ?? null,
      limit,
      offset,
      total,
      events,
    };
  });
}
