import { queryKnowledge } from '../knowledge/query.js';
import type { KnowledgeArticle } from '../knowledge/types.js';
import type { ClassifiedIntent } from './classify.js';
import type { ConciergeCitation, ConciergeLiveContext } from './types.js';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'at', 'is', 'this', 'that',
  'i', 'im', 'i\'m', 'me', 'my', 'we', 'our', 'you', 'with', 'near', 'now', 'what', 'how',
  'do', 'need', 'best', 'also', 'will', 'love', 'try',
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+']+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !STOPWORDS.has(part));
}

function scoreArticle(article: KnowledgeArticle, queryTokens: string[], intent: ClassifiedIntent, context: ConciergeLiveContext): number {
  if (intent.articleHint && article.id === intent.articleHint) {
    return 1000;
  }

  const blob = [
    article.title,
    article.summary,
    article.body,
    article.tags.join(' '),
    article.area ?? '',
    article.category,
    article.topic,
  ]
    .join(' ')
    .toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    if (article.tags.some((tag) => tag.toLowerCase() === token || tag.toLowerCase().includes(token))) {
      score += 6;
    } else if (article.title.toLowerCase().includes(token)) {
      score += 5;
    } else if (blob.includes(token)) {
      score += 2;
    }
  }

  if (article.category === intent.category) {
    score += 8;
  }

  const area = context.area?.toLowerCase().trim();
  if (area && article.area?.toLowerCase().includes(area)) {
    score += 10;
  }

  const destination = context.destination?.toLowerCase().trim();
  if (destination && article.area?.toLowerCase().includes(destination)) {
    score += 4;
  }

  const family = /family|kid/i.test(context.tripMode ?? '');
  if (family && (article.tags.includes('family') || article.tags.includes('kids'))) {
    score += 6;
  }

  return score;
}

export function retrieveAndRank(
  message: string,
  intent: ClassifiedIntent,
  context: ConciergeLiveContext,
  limit = 4,
  extraArticles: KnowledgeArticle[] = [],
): { articles: KnowledgeArticle[]; citations: ConciergeCitation[] } {
  // Same corpus as GET /knowledge (seed plus published CMS FAQs). Rank in-process;
  // do not pass the raw chat sentence as `q` (that filter is substring-on-full-needle).
  const catalog = queryKnowledge({}, extraArticles);
  const pool = catalog.articles;

  const queryTokens = tokens(message);
  const scored = pool
    .map((article) => ({
      article,
      score: scoreArticle(article, queryTokens, intent, context),
    }))
    .sort((a, b) => b.score - a.score || a.article.sortOrder - b.article.sortOrder);

  const hinted = intent.articleHint
    ? pool.find((article) => article.id === intent.articleHint)
    : undefined;

  const picked: Array<{ article: KnowledgeArticle; score: number }> = [];
  if (hinted && !scored.some((row) => row.article.id === hinted.id && row.score > 0)) {
    picked.push({ article: hinted, score: 1000 });
  }

  for (const row of scored) {
    if (row.score <= 0 && !intent.articleHint) continue;
    if (picked.some((item) => item.article.id === row.article.id)) continue;
    picked.push(row);
    if (picked.length >= limit) break;
  }

  if (picked.length === 0 && hinted) {
    picked.push({ article: hinted, score: 1000 });
  }

  if (
    picked.length === 0 &&
    intent.escalationLevel !== 'sos' &&
    intent.escalationLevel !== 'out_of_bounds'
  ) {
    const fallback = queryKnowledge({ category: intent.category }, extraArticles).articles.slice(
      0,
      limit,
    );
    for (const article of fallback) {
      picked.push({ article, score: 1 });
    }
  }

  const articles = picked.map((row) => row.article);
  const citations = picked.map((row) => ({
    articleId: row.article.id,
    title: row.article.title,
    score: row.score,
  }));

  return { articles, citations };
}

export function filterFamilySafeChips(chips: string[], tripMode?: string): string[] {
  if (!/family|kid/i.test(tripMode ?? '')) {
    return chips;
  }
  return chips.filter((chip) => !/\b(nightlife|club|bar|alcohol|beer|wine|cocktail)\b/i.test(chip));
}

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
  }
  return out;
}

export function isFamilyTrip(context: ConciergeLiveContext): boolean {
  return /family|kid/i.test(context.tripMode ?? '');
}
