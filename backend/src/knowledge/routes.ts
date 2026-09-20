import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import type { ContentStore } from '../content/types.js';
import { publishedFaqArticles } from '../faqs/map.js';
import { validateRequest } from '../validate.js';
import { queryKnowledge } from './query.js';
import { CONCIERGE_CATEGORIES, KNOWLEDGE_TOPICS } from './types.js';

const querySchema = z
  .object({
    topic: z.enum(KNOWLEDGE_TOPICS).optional(),
    category: z.enum(CONCIERGE_CATEGORIES).optional(),
    q: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

export async function registerKnowledgeRoutes(
  app: FastifyInstance,
  _config: AppConfig,
  resolveContentStore?: () => ContentStore | undefined,
): Promise<void> {
  app.get('/knowledge', async (request) => {
    const { query } = validateRequest(request, { query: querySchema });
    const extraArticles = await publishedFaqArticles(resolveContentStore?.());
    return queryKnowledge(
      {
        topic: query.topic,
        category: query.category,
        q: query.q,
      },
      extraArticles,
    );
  });
}
