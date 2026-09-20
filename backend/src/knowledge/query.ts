import { MALAYSIA_KNOWLEDGE_SEED } from './content.js';
import type { ConciergeCategory, KnowledgeArticle, KnowledgeTopic } from './types.js';
import { CONCIERGE_CATEGORIES, KNOWLEDGE_TOPICS } from './types.js';

export interface KnowledgeQuery {
  topic?: KnowledgeTopic;
  category?: ConciergeCategory;
  q?: string;
}

export interface KnowledgeQueryResult {
  country: string;
  destination: string;
  version: string;
  topic: KnowledgeTopic | null;
  category: ConciergeCategory | null;
  q: string | null;
  topics: KnowledgeTopic[];
  categories: ConciergeCategory[];
  chips: typeof MALAYSIA_KNOWLEDGE_SEED.chips;
  articles: KnowledgeArticle[];
}

function matchesQuery(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function mergeKnowledgeArticles(
  seed: KnowledgeArticle[],
  extra: KnowledgeArticle[] = [],
): KnowledgeArticle[] {
  if (extra.length === 0) return seed;
  const byId = new Map<string, KnowledgeArticle>();
  for (const article of seed) {
    byId.set(article.id, article);
  }
  for (const article of extra) {
    byId.set(article.id, article);
  }
  return [...byId.values()];
}

/** Same contract as GET /knowledge — concierge retrieve-and-rank uses this, not a second corpus. */
export function queryKnowledge(
  filters: KnowledgeQuery = {},
  extraArticles: KnowledgeArticle[] = [],
): KnowledgeQueryResult {
  const needle = filters.q?.trim();

  const articles = mergeKnowledgeArticles(MALAYSIA_KNOWLEDGE_SEED.articles, extraArticles)
    .filter((article) => (filters.topic ? article.topic === filters.topic : true))
    .filter((article) => (filters.category ? article.category === filters.category : true))
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
    topic: filters.topic ?? null,
    category: filters.category ?? null,
    q: needle ?? null,
    topics: [...KNOWLEDGE_TOPICS],
    categories: [...CONCIERGE_CATEGORIES],
    chips: MALAYSIA_KNOWLEDGE_SEED.chips,
    articles,
  };
}
