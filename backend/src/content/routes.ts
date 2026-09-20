import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAdminAudit } from '../audit/record.js';
import type { AuditStore } from '../audit/types.js';
import { requireAdmin } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../errors.js';
import { validateRequest } from '../validate.js';
import { slugifyContentTitle } from './map.js';
import {
  CONTENT_AIRPORTS,
  CONTENT_KINDS,
  type ContentStore,
} from './types.js';

const optionalText = z.union([z.string().trim().max(240), z.null()]).optional();

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(16).optional();
const stepsSchema = z.array(z.string().trim().min(1).max(400)).max(16).optional();

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase kebab-case slug');

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    slug: slugSchema.optional(),
    kind: z.enum(CONTENT_KINDS),
    summary: z.string().trim().max(500).optional(),
    body: z.string().trim().min(1).max(20000),
    tags: tagsSchema,
    area: optionalText,
    airportCode: z.union([z.enum(CONTENT_AIRPORTS), z.null()]).optional(),
    topic: optionalText,
    whenToUse: z.union([z.string().trim().max(800), z.null()]).optional(),
    icon: optionalText,
    steps: stepsSchema,
    sortOrder: z.number().int().min(0).max(9999).optional(),
    published: z.boolean().optional(),
  })
  .strict();

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    slug: slugSchema.optional(),
    kind: z.enum(CONTENT_KINDS).optional(),
    summary: z.string().trim().max(500).optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    tags: tagsSchema,
    area: optionalText,
    airportCode: z.union([z.enum(CONTENT_AIRPORTS), z.null()]).optional(),
    topic: optionalText,
    whenToUse: z.union([z.string().trim().max(800), z.null()]).optional(),
    icon: optionalText,
    steps: stepsSchema,
    sortOrder: z.number().int().min(0).max(9999).optional(),
    published: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one content field is required',
  });

const idParams = z.object({
  id: z.string().uuid(),
});

const listQuery = z
  .object({
    kind: z.enum(CONTENT_KINDS).optional(),
    published: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    q: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

export async function registerContentAdminRoutes(
  app: FastifyInstance,
  config: AppConfig,
  resolveStore: () => ContentStore | undefined,
  resolveAuditStore: () => AuditStore | undefined = () => undefined,
): Promise<void> {
  const getStore = (): ContentStore => {
    const store = resolveStore();
    if (!store) {
      throw new ServiceUnavailableError('Content store is not configured');
    }
    return store;
  };

  const admin = { preHandler: requireAdmin(config) };

  app.get('/admin/content', admin, async (request) => {
    const { query } = validateRequest(request, { query: listQuery });
    const items = await getStore().list({
      kind: query.kind,
      published: query.published,
      q: query.q,
    });
    return {
      kinds: [...CONTENT_KINDS],
      kind: query.kind ?? null,
      published: query.published ?? null,
      q: query.q ?? null,
      items,
    };
  });

  app.get('/admin/content/:id', admin, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    const item = await getStore().get(params.id);
    if (!item) {
      throw new NotFoundError('Content item not found');
    }
    return { item };
  });

  app.post('/admin/content', admin, async (request, reply) => {
    const { body } = validateRequest(request, { body: createSchema });
    let slug = body.slug;
    if (!slug) {
      try {
        slug = slugifyContentTitle(body.title);
      } catch {
        throw new ValidationError('Unable to derive a slug from title');
      }
    }
    const item = await getStore().create({
      slug,
      kind: body.kind,
      title: body.title,
      summary: body.summary,
      body: body.body,
      tags: body.tags,
      area: body.area,
      airportCode: body.airportCode,
      topic: body.topic,
      whenToUse: body.whenToUse,
      icon: body.icon,
      steps: body.steps,
      sortOrder: body.sortOrder,
      published: body.published,
    });
    return reply.status(201).send({ item });
  });

  app.patch('/admin/content/:id', admin, async (request) => {
    const { params, body } = validateRequest(request, { params: idParams, body: patchSchema });
    const item = await getStore().update(params.id, body);
    if (!item) {
      throw new NotFoundError('Content item not found');
    }
    return { item };
  });

  app.post('/admin/content/:id/publish', admin, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    const item = await getStore().setPublished(params.id, true);
    if (!item) {
      throw new NotFoundError('Content item not found');
    }
    await recordAdminAudit(request, resolveAuditStore, {
      action: 'content.publish',
      entityType: 'content',
      entityId: item.id,
      summary: `Published content ${item.title}`,
      metadata: {
        title: item.title,
        slug: item.slug,
        kind: item.kind,
        published: item.published,
      },
    });
    return { item };
  });

  app.post('/admin/content/:id/unpublish', admin, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    const item = await getStore().setPublished(params.id, false);
    if (!item) {
      throw new NotFoundError('Content item not found');
    }
    await recordAdminAudit(request, resolveAuditStore, {
      action: 'content.unpublish',
      entityType: 'content',
      entityId: item.id,
      summary: `Unpublished content ${item.title}`,
      metadata: {
        title: item.title,
        slug: item.slug,
        kind: item.kind,
        published: item.published,
      },
    });
    return { item };
  });

  app.delete('/admin/content/:id', admin, async (request, reply) => {
    const { params } = validateRequest(request, { params: idParams });
    const deleted = await getStore().delete(params.id);
    if (!deleted) {
      throw new NotFoundError('Content item not found');
    }
    return reply.status(204).send();
  });
}
