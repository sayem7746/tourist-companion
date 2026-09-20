import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAdminAudit } from '../audit/record.js';
import type { AuditStore } from '../audit/types.js';
import { requireAdmin } from '../auth/middleware.js';
import type { AppConfig } from '../config.js';
import type { ContentItem, ContentStore } from '../content/types.js';
import { slugifyContentTitle } from '../content/map.js';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../errors.js';
import { CONCIERGE_CATEGORIES } from '../knowledge/types.js';
import { validateRequest } from '../validate.js';
import { toFaqItem } from './map.js';

const optionalTopic = z.union([z.enum(CONCIERGE_CATEGORIES), z.null()]).optional();
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(16).optional();
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
    summary: z.string().trim().max(500).optional(),
    body: z.string().trim().min(1).max(20000),
    tags: tagsSchema,
    topic: optionalTopic,
    sortOrder: z.number().int().min(0).max(9999).optional(),
    published: z.boolean().optional(),
  })
  .strict();

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    slug: slugSchema.optional(),
    summary: z.string().trim().max(500).optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    tags: tagsSchema,
    topic: optionalTopic,
    sortOrder: z.number().int().min(0).max(9999).optional(),
    published: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one FAQ field is required',
  });

const idParams = z.object({
  id: z.string().uuid(),
});

const adminListQuery = z
  .object({
    published: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    topic: z.enum(CONCIERGE_CATEGORIES).optional(),
    q: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

const publicListQuery = z
  .object({
    topic: z.enum(CONCIERGE_CATEGORIES).optional(),
    q: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

function filterTopic(items: ContentItem[], topic?: (typeof CONCIERGE_CATEGORIES)[number]) {
  if (!topic) return items;
  return items.filter((item) => item.topic === topic);
}

export async function registerFaqRoutes(
  app: FastifyInstance,
  config: AppConfig,
  resolveStore: () => ContentStore | undefined,
  resolveAuditStore: () => AuditStore | undefined = () => undefined,
): Promise<void> {
  const getStore = (): ContentStore => {
    const store = resolveStore();
    if (!store) {
      throw new ServiceUnavailableError('FAQ store is not configured');
    }
    return store;
  };

  const requireFaq = async (id: string): Promise<ContentItem> => {
    const item = await getStore().get(id);
    if (!item || item.kind !== 'faq') {
      throw new NotFoundError('FAQ not found');
    }
    return item;
  };

  const admin = { preHandler: requireAdmin(config) };

  app.get('/faqs', async (request) => {
    const { query } = validateRequest(request, { query: publicListQuery });
    const items = filterTopic(
      await getStore().list({ kind: 'faq', published: true, q: query.q }),
      query.topic,
    );
    return {
      published: true,
      topic: query.topic ?? null,
      q: query.q ?? null,
      items: items.map(toFaqItem),
    };
  });

  app.get('/admin/faqs', admin, async (request) => {
    const { query } = validateRequest(request, { query: adminListQuery });
    const items = filterTopic(
      await getStore().list({
        kind: 'faq',
        published: query.published,
        q: query.q,
      }),
      query.topic,
    );
    return {
      topics: [...CONCIERGE_CATEGORIES],
      published: query.published ?? null,
      topic: query.topic ?? null,
      q: query.q ?? null,
      items: items.map(toFaqItem),
    };
  });

  app.get('/admin/faqs/:id', admin, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    const item = await requireFaq(params.id);
    return { item: toFaqItem(item) };
  });

  app.post('/admin/faqs', admin, async (request, reply) => {
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
      kind: 'faq',
      title: body.title,
      summary: body.summary,
      body: body.body,
      tags: body.tags,
      topic: body.topic,
      sortOrder: body.sortOrder,
      published: body.published,
    });
    return reply.status(201).send({ item: toFaqItem(item) });
  });

  app.patch('/admin/faqs/:id', admin, async (request) => {
    const { params, body } = validateRequest(request, { params: idParams, body: patchSchema });
    await requireFaq(params.id);
    const item = await getStore().update(params.id, body);
    if (!item) {
      throw new NotFoundError('FAQ not found');
    }
    return { item: toFaqItem(item) };
  });

  app.post('/admin/faqs/:id/publish', admin, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    await requireFaq(params.id);
    const item = await getStore().setPublished(params.id, true);
    if (!item) {
      throw new NotFoundError('FAQ not found');
    }
    await recordAdminAudit(request, resolveAuditStore, {
      action: 'faq.publish',
      entityType: 'faq',
      entityId: item.id,
      summary: `Published FAQ ${item.title}`,
      metadata: {
        title: item.title,
        slug: item.slug,
        topic: item.topic,
        published: item.published,
      },
    });
    return { item: toFaqItem(item) };
  });

  app.post('/admin/faqs/:id/unpublish', admin, async (request) => {
    const { params } = validateRequest(request, { params: idParams });
    await requireFaq(params.id);
    const item = await getStore().setPublished(params.id, false);
    if (!item) {
      throw new NotFoundError('FAQ not found');
    }
    await recordAdminAudit(request, resolveAuditStore, {
      action: 'faq.unpublish',
      entityType: 'faq',
      entityId: item.id,
      summary: `Unpublished FAQ ${item.title}`,
      metadata: {
        title: item.title,
        slug: item.slug,
        topic: item.topic,
        published: item.published,
      },
    });
    return { item: toFaqItem(item) };
  });

  app.delete('/admin/faqs/:id', admin, async (request, reply) => {
    const { params } = validateRequest(request, { params: idParams });
    await requireFaq(params.id);
    const deleted = await getStore().delete(params.id);
    if (!deleted) {
      throw new NotFoundError('FAQ not found');
    }
    return reply.status(204).send();
  });
}
