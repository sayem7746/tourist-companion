import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { optionalAuth, requireAdmin, requireAuth } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../errors.js';
import { validateRequest } from '../validate.js';
import { REFERRAL_CHANNELS, type PartnerStore } from './types.js';

const uuid = z.string().uuid();
const optionalUuid = uuid.optional();

const clickKey = z.string().trim().min(1).max(120).optional();

const optionalId = z.union([uuid, z.null()]).optional();

const clickBody = z
  .object({
    providerId: uuid,
    channel: z.enum(REFERRAL_CHANNELS),
    tripId: optionalId,
    placeId: optionalId,
    itineraryItemId: optionalId,
    referralCode: z.string().trim().min(3).max(64).optional(),
    clickKey,
  })
  .strict();

const leadBody = z
  .object({
    providerId: optionalUuid,
    channel: z.enum(REFERRAL_CHANNELS).optional(),
    referralId: optionalUuid,
    referralCode: z.string().trim().min(3).max(64).optional(),
    tripId: optionalId,
    placeId: optionalId,
    itineraryItemId: optionalId,
    clickKey,
  })
  .strict()
  .refine(
    (value) =>
      Boolean(value.referralId) ||
      Boolean(value.referralCode) ||
      (Boolean(value.providerId) && Boolean(value.channel)),
    {
      message: 'Provide referralId, referralCode, or providerId and channel',
    },
  );

const bookingBody = z
  .object({
    referralId: optionalUuid,
    referralCode: z.string().trim().min(3).max(64).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.referralId) || Boolean(value.referralCode), {
    message: 'Provide referralId or referralCode',
  });

const codeParams = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Use a letter, number, hyphen, or underscore code'),
});

const providerParams = z.object({
  providerId: uuid,
});

const goQuery = z
  .object({
    channel: z.enum(REFERRAL_CHANNELS),
    tripId: uuid.optional(),
    placeId: uuid.optional(),
    itineraryItemId: uuid.optional(),
    clickKey,
  })
  .strict();

export async function registerReferralRoutes(
  app: FastifyInstance,
  config: AppConfig,
  resolveStore: () => PartnerStore | undefined,
): Promise<void> {
  const getStore = (): PartnerStore => {
    const store = resolveStore();
    if (!store) {
      throw new ServiceUnavailableError('Partner store is not configured');
    }
    return store;
  };

  const auth = { preHandler: requireAuth(config) };
  const admin = { preHandler: requireAdmin(config) };

  app.post('/referrals/clicks', auth, async (request, reply) => {
    const { body } = validateRequest(request, { body: clickBody });
    const user = request.user;
    if (!user) {
      throw new ValidationError('Authentication required');
    }
    const result = await getStore().trackClick({
      userId: user.id,
      providerId: body.providerId,
      channel: body.channel,
      tripId: body.tripId,
      placeId: body.placeId,
      itineraryItemId: body.itineraryItemId,
      referralCode: body.referralCode,
      clickKey: body.clickKey,
    });
    return reply.status(result.created ? 201 : 200).send(result);
  });

  app.post('/referrals/leads', auth, async (request, reply) => {
    const { body } = validateRequest(request, { body: leadBody });
    const user = request.user;
    if (!user) {
      throw new ValidationError('Authentication required');
    }
    const result = await getStore().trackLead({
      userId: user.id,
      providerId: body.providerId,
      channel: body.channel,
      referralId: body.referralId,
      referralCode: body.referralCode,
      tripId: body.tripId,
      placeId: body.placeId,
      itineraryItemId: body.itineraryItemId,
      clickKey: body.clickKey,
    });
    return reply.status(result.created ? 201 : 200).send(result);
  });

  app.post('/referrals/bookings', admin, async (request) => {
    const { body } = validateRequest(request, { body: bookingBody });
    const referral = await getStore().trackBooking({
      referralId: body.referralId,
      referralCode: body.referralCode,
    });
    if (!referral) {
      throw new NotFoundError('Referral not found');
    }
    return { referral };
  });

  app.get('/referrals', auth, async (request) => {
    const user = request.user;
    if (!user) {
      throw new ValidationError('Authentication required');
    }
    const referrals = await getStore().listReferrals(user.id);
    return { referrals };
  });

  app.get(
    '/referrals/go/:providerId',
    { preHandler: requireAuth(config) },
    async (request, reply) => {
      const { params, query } = validateRequest(request, {
        params: providerParams,
        query: goQuery,
      });
      const user = request.user;
      if (!user) {
        throw new ValidationError('Authentication required');
      }
      const result = await getStore().trackClick({
        userId: user.id,
        providerId: params.providerId,
        channel: query.channel,
        tripId: query.tripId,
        placeId: query.placeId,
        itineraryItemId: query.itineraryItemId,
        clickKey: query.clickKey,
      });
      if (!result.outboundUrl) {
        throw new ValidationError('Partner has no outbound booking URL');
      }
      return reply.redirect(result.outboundUrl);
    },
  );

  app.get('/r/:code', { preHandler: optionalAuth(config) }, async (request, reply) => {
    const { params } = validateRequest(request, { params: codeParams });
    const redirected = await getStore().redirectByCode(params.code);
    if (!redirected) {
      throw new NotFoundError('Referral not found');
    }
    return reply.redirect(redirected.url);
  });
}
