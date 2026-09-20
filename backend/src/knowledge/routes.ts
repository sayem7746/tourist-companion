import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
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
): Promise<void> {
  app.get('/knowledge', async (request) => {
    const { query } = validateRequest(request, { query: querySchema });
    return queryKnowledge({
      topic: query.topic,
      category: query.category,
      q: query.q,
    });
  });
}
