import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MALAYSIA_KNOWLEDGE_SEED } from '../src/knowledge/content.js';
import { CONCIERGE_CATEGORIES, KNOWLEDGE_TOPICS } from '../src/knowledge/types.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const app = buildApp(
  loadConfig({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-only-insecure-jwt-secret',
  }),
);

interface KnowledgeResponse {
  country: string;
  destination: string;
  version: string;
  topic: string | null;
  category: string | null;
  topics: string[];
  categories: string[];
  chips: Array<{ id: string; label: string; category: string; articleId?: string }>;
  articles: Array<{
    id: string;
    topic: string;
    category: string;
    title: string;
    body: string;
    escalation: string;
  }>;
}

describe('Malaysia knowledge base', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('JSON seed matches TypeScript seed', () => {
    const jsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/malaysia-knowledge.json');
    const fromJson = JSON.parse(readFileSync(jsonPath, 'utf8')) as typeof MALAYSIA_KNOWLEDGE_SEED;
    expect(fromJson).toEqual(MALAYSIA_KNOWLEDGE_SEED);
  });

  it('covers MVP topics and concierge categories', () => {
    const topics = new Set(MALAYSIA_KNOWLEDGE_SEED.articles.map((article) => article.topic));
    const categories = new Set(MALAYSIA_KNOWLEDGE_SEED.articles.map((article) => article.category));
    expect([...KNOWLEDGE_TOPICS].every((topic) => topics.has(topic))).toBe(true);
    expect(categories.has('food_spice_diet')).toBe(true);
    expect(categories.has('local_transport')).toBe(true);
    expect(categories.has('nearby_dining')).toBe(true);
    expect(categories.has('money_payments')).toBe(true);
    expect(categories.has('culture_etiquette')).toBe(true);
    expect(categories.has('safety_non_emergency')).toBe(true);
    expect(categories.has('emergency')).toBe(true);
    expect(MALAYSIA_KNOWLEDGE_SEED.chips.map((chip) => chip.label)).toEqual([
      'Is this food spicy?',
      'How to ride the LRT?',
      'Best dinner near KLCC?',
      'Do I need cash for night market?',
      'Dress code for Batu Caves?',
    ]);
  });

  it('GET /knowledge returns Malaysia seed and Stitch chips', async () => {
    const response = await app.inject({ method: 'GET', url: '/knowledge' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as KnowledgeResponse;
    expect(body.country).toBe('MY');
    expect(body.destination).toBe('Malaysia');
    expect(body.topics).toEqual([...KNOWLEDGE_TOPICS]);
    expect(body.categories).toEqual([...CONCIERGE_CATEGORIES]);
    expect(body.chips).toHaveLength(5);
    expect(body.articles.length).toBe(MALAYSIA_KNOWLEDGE_SEED.articles.length);
    expect(body.articles.find((article) => article.id === 'my-transport-lrt')?.body).toContain('Touch');
    expect(body.articles.find((article) => article.id === 'my-faq-emergency')?.escalation).toBe('sos');
  });

  it('filters by topic, category, and search', async () => {
    const byTopic = await app.inject({ method: 'GET', url: '/knowledge?topic=etiquette' });
    expect(byTopic.statusCode).toBe(200);
    const etiquette = byTopic.json() as KnowledgeResponse;
    expect(etiquette.topic).toBe('etiquette');
    expect(etiquette.articles.every((article) => article.topic === 'etiquette')).toBe(true);
    expect(etiquette.articles.some((article) => article.id === 'my-etiq-batu-caves')).toBe(true);

    const byCategory = await app.inject({
      method: 'GET',
      url: '/knowledge?category=money_payments',
    });
    expect(byCategory.statusCode).toBe(200);
    const money = byCategory.json() as KnowledgeResponse;
    expect(money.articles.every((article) => article.category === 'money_payments')).toBe(true);

    const search = await app.inject({ method: 'GET', url: '/knowledge?q=tak%20pedas' });
    expect(search.statusCode).toBe(200);
    const spice = search.json() as KnowledgeResponse;
    expect(spice.articles.some((article) => article.id === 'my-food-spice')).toBe(true);
  });

  it('rejects unknown topic or category', async () => {
    const topic = await app.inject({ method: 'GET', url: '/knowledge?topic=nightlife' });
    expect(topic.statusCode).toBe(400);

    const category = await app.inject({ method: 'GET', url: '/knowledge?category=visa' });
    expect(category.statusCode).toBe(400);
  });
});
