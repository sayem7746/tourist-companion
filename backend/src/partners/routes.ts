import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../errors.js';
import { validateRequest } from '../validate.js';
import { defaultCommissionBasis, slugifyPartnerName } from './map.js';
import {
  COMMISSION_BASES,
  PARTNER_CATEGORIES,
  REFERRAL_DISCLOSURE,
  type PartnerStore,
} from './types.js';

const httpsUrl = z
  .string()
  .trim()
  .refine((value) => /^https:\/\//i.test(value), { message: 'URL must start with https://' });

const optionalHttps = z.union([httpsUrl, z.literal('').transform(() => null), z.null()]).optional();

const optionalText = z.union([z.string().trim().max(240), z.null()]).optional();

const listingObject = z
  .object({
    summary: z.string().trim().min(1).max(500).optional(),
    city: optionalText,
    area: optionalText,
    bookingUrl: optionalHttps,
    disclosure: z.string().trim().min(1).max(280).optional(),
    sponsored: z.boolean().optional(),
    licenseName: optionalText,
    licenseId: optionalText,
    typicalMyr: optionalText,
    languages: z.array(z.string().trim().min(2).max(8)).max(12).optional(),
    hotelClassHint: optionalText,
    vehicleClass: optionalText,
    airportCodes: z.array(z.enum(['KUL', 'KLIA2'])).optional(),
    meetAndGreet: z.boolean().nullable().optional(),
    durationHint: optionalText,
    meetingPoint: optionalText,
    connectivityKind: z.enum(['esim', 'prepaid_sim']).nullable().optional(),
    dataAllowance: optionalText,
    validity: optionalText,
    passportRequired: z.boolean().nullable().optional(),
    halal: z.boolean().nullable().optional(),
    reservationUrl: optionalHttps,
    deskHours: optionalText,
  })
  .strict();

const commissionObject = z
  .object({
    rate: z.number().min(0).max(1),
    basis: z.enum(COMMISSION_BASES).optional(),
    currency: z.literal('MYR').optional(),
  })
  .strict();

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase kebab-case slug')
      .optional(),
    category: z.enum(PARTNER_CATEGORIES),
    isActive: z.boolean().optional(),
    website: optionalHttps,
    contactEmail: z.union([z.string().trim().email().max(160), z.null()]).optional(),
    listing: listingObject.optional(),
    commission: commissionObject.optional(),
  })
  .strict();

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase kebab-case slug')
      .optional(),
    category: z.enum(PARTNER_CATEGORIES).optional(),
    website: optionalHttps,
    contactEmail: z.union([z.string().trim().email().max(160), z.null()]).optional(),
    listing: listingObject.optional(),
    commission: commissionObject.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one partner field is required',
  });

const idParams = z.object({
  id: z.string().uuid(),
});

const listQuery = z
  .object({
    category: z.enum(PARTNER_CATEGORIES).optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();

export async function registerPartnerAdminRoutes(
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

  const admin = { preHandler: requireAdmin(config) };

  app.get('/admin/partners', admin, async (request) => {
    const { query } = validateRequest(request, { query: listQuery });
    const partners = await getStore().list({
      category: query.category,
      isActive: query.isActive,
    });
    return { partners };
  });

  app.get('/admin/partners/:id', admin, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    const partner = await getStore().get(params.id);
    if (!partner) {
      throw new NotFoundError('Partner not found');
    }
    return { partner };
  });

  app.post('/admin/partners', admin, async (request, reply) => {
    const { body } = validateRequest(request, { body: createSchema });
    let slug = body.slug;
    if (!slug) {
      try {
        slug = slugifyPartnerName(body.name);
      } catch {
        throw new ValidationError('Unable to derive a slug from name');
      }
    }
    const summary = body.listing?.summary?.trim() ?? '';
    if (body.isActive && !summary) {
      throw new ValidationError('Active partners require a listing summary');
    }
    const partner = await getStore().create({
      name: body.name,
      slug,
      category: body.category,
      isActive: body.isActive ?? false,
      website: body.website,
      contactEmail: body.contactEmail,
      listing: {
        summary: summary || body.name,
        city: body.listing?.city,
        area: body.listing?.area,
        bookingUrl: body.listing?.bookingUrl,
        disclosure: body.listing?.disclosure?.trim() || REFERRAL_DISCLOSURE,
        sponsored: body.listing?.sponsored ?? false,
        licenseName: body.listing?.licenseName,
        licenseId: body.listing?.licenseId,
        typicalMyr: body.listing?.typicalMyr,
        languages: body.listing?.languages,
        hotelClassHint: body.listing?.hotelClassHint,
        vehicleClass: body.listing?.vehicleClass,
        airportCodes: body.listing?.airportCodes,
        meetAndGreet: body.listing?.meetAndGreet,
        durationHint: body.listing?.durationHint,
        meetingPoint: body.listing?.meetingPoint,
        connectivityKind: body.listing?.connectivityKind,
        dataAllowance: body.listing?.dataAllowance,
        validity: body.listing?.validity,
        passportRequired: body.listing?.passportRequired,
        halal: body.listing?.halal,
        reservationUrl: body.listing?.reservationUrl,
        deskHours: body.listing?.deskHours,
      },
      commission: body.commission
        ? {
            rate: body.commission.rate,
            currency: 'MYR',
            basis: body.commission.basis ?? defaultCommissionBasis(body.category),
          }
        : undefined,
    });
    return reply.status(201).send({ partner });
  });

  app.patch('/admin/partners/:id', admin, async (request) => {
    const { params, body } = validateRequest(request, { params: idParams, body: patchSchema });
    const partner = await getStore().update(params.id, {
      name: body.name,
      slug: body.slug,
      category: body.category,
      website: body.website,
      contactEmail: body.contactEmail,
      listing: body.listing,
      commission: body.commission
        ? { rate: body.commission.rate, basis: body.commission.basis }
        : undefined,
    });
    if (!partner) {
      throw new NotFoundError('Partner not found');
    }
    return { partner };
  });

  app.post('/admin/partners/:id/approve', admin, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    const partner = await getStore().setActive(params.id, true);
    if (!partner) {
      throw new NotFoundError('Partner not found');
    }
    return { partner };
  });

  app.post('/admin/partners/:id/pause', admin, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    const partner = await getStore().setActive(params.id, false);
    if (!partner) {
      throw new NotFoundError('Partner not found');
    }
    return { partner };
  });

  app.delete('/admin/partners/:id', admin, async (request, reply) => {
    const { params } = validateRequest(request, { params: idParams });
    const deleted = await getStore().delete(params.id);
    if (!deleted) {
      throw new NotFoundError('Partner not found');
    }
    return reply.status(204).send();
  });
}
