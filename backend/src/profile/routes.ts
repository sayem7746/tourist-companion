import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../errors.js';
import { validateRequest } from '../validate.js';
import {
  DIETARY_PREFERENCES,
  MOBILITY_NEEDS,
  TRAVEL_STYLES,
  type ProfileStore,
} from './types.js';

const languageSchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .regex(/^[A-Za-z]{2}(?:-[A-Za-z0-9]{2,8})*$/, 'Use a language tag such as en or en-US');

const patchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    language: languageSchema.optional(),
    dietaryPreferences: z.array(z.enum(DIETARY_PREFERENCES)).optional(),
    mobilityNeeds: z.array(z.enum(MOBILITY_NEEDS)).optional(),
    travelStyle: z.enum(TRAVEL_STYLES).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one profile field is required',
  });

export async function registerProfileRoutes(
  app: FastifyInstance,
  config: AppConfig,
  resolveStore: () => ProfileStore | undefined,
): Promise<void> {
  const getStore = (): ProfileStore => {
    const store = resolveStore();
    if (!store) {
      throw new ServiceUnavailableError('Profile store is not configured');
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

  app.get('/profile', { preHandler: requireAuth(config) }, async (request) => {
    const profile = await getStore().getOrCreate(requireUserId(request));
    if (!profile) {
      throw new NotFoundError('Profile not found');
    }
    return { profile };
  });

  app.patch('/profile', { preHandler: requireAuth(config) }, async (request) => {
    const { body } = validateRequest(request, { body: patchSchema });
    const profile = await getStore().update(requireUserId(request), body);
    if (!profile) {
      throw new NotFoundError('Profile not found');
    }
    return { profile };
  });
}
