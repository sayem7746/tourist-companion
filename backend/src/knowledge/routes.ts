import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { validateRequest } from '../validate.js';
import { MALAYSIA_KNOWLEDGE_SEED } from './content.js';
import { CONCIERGE_CATEGORIES, KNOWLEDGE_TOPICS } from './types.js';

const querySchema = z
  .object({
    topic: z.enum(KNOWLEDGE_TOPICS).optional(),
    category: z.enum(CONCIERGE_CATEGORIES).optional(),
    q: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

function matchesQuery(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export async function registerKnowledgeRoutes(
  app: FastifyInstance,
  _config: AppConfig,
): Promise<void> {
  app.get('/knowledge', async (request) => {
    const { query } = validateRequest(request, { query: querySchema });
    const needle = query.q?.trim();

    const articles = MALAYSIA_KNOWLEDGE_SEED.articles
      .filter((article) => (query.topic ? article.topic === query.topic : true))
      .filter((article) => (query.category ? article.category === query.category : true))
      .filter((article) => {
        if (!needle) return true;
        const blob = [article.title, article.summary, article.body, article.tags.join(' '), article.area ?? ''].join(
          ' ',
        );
        return matchesQuery(blob, needle);
      })
      .sort((a, b) => a.topic.localeCompare(b.topic) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

    return {
      country: MALAYSIA_KNOWLEDGE_SEED.country,
      destination: MALAYSIA_KNOWLEDGE_SEED.destination,
      version: MALAYSIA_KNOWLEDGE_SEED.version,
      topic: query.topic ?? null,
      category: query.category ?? null,
      q: needle ?? null,
      topics: [...KNOWLEDGE_TOPICS],
      categories: [...CONCIERGE_CATEGORIES],
      chips: MALAYSIA_KNOWLEDGE_SEED.chips,
      articles,
    };
  });
}
