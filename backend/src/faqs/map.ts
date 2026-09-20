import type { ContentItem, ContentStore } from '../content/types.js';
import {
  CONCIERGE_CATEGORIES,
  type ConciergeCategory,
  type KnowledgeArticle,
} from '../knowledge/types.js';
import type { FaqItem } from './types.js';

export function isConciergeCategory(value: string | null | undefined): value is ConciergeCategory {
  return Boolean(value && (CONCIERGE_CATEGORIES as readonly string[]).includes(value));
}

export function faqArticleId(slug: string): string {
  return `faq:${slug}`;
}

export function toFaqItem(item: ContentItem): FaqItem {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    body: item.body,
    tags: [...item.tags],
    topic: isConciergeCategory(item.topic) ? item.topic : null,
    sortOrder: item.sortOrder,
    published: item.published,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function toFaqKnowledgeArticle(item: ContentItem): KnowledgeArticle {
  const category: ConciergeCategory = isConciergeCategory(item.topic)
    ? item.topic
    : 'safety_non_emergency';
  const summary = item.summary.trim() || item.body.trim().slice(0, 180);
  return {
    id: faqArticleId(item.slug),
    topic: 'faq',
    category,
    title: item.title,
    summary,
    body: item.body,
    tags: [...item.tags],
    area: item.area ?? undefined,
    trustLineEligible: category !== 'emergency',
    escalation: category === 'emergency' ? 'handoff' : 'none',
    sortOrder: item.sortOrder,
  };
}

export async function publishedFaqArticles(
  store?: Pick<ContentStore, 'list'>,
): Promise<KnowledgeArticle[]> {
  if (!store) return [];
  try {
    const items = await store.list({ kind: 'faq', published: true });
    return items.map(toFaqKnowledgeArticle);
  } catch {
    return [];
  }
}
