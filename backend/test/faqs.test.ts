import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signAccessToken } from '../src/auth/tokens.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { faqArticleId, toFaqKnowledgeArticle } from '../src/faqs/map.js';
import { CONCIERGE_CATEGORIES } from '../src/knowledge/types.js';
import { MALAYSIA_KNOWLEDGE_SEED } from '../src/knowledge/content.js';

const ADMIN_TOKEN = 'test-only-admin-token';
const config = loadConfig({
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3000',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'test-only-insecure-jwt-secret',
  ADMIN_TOKEN,
});
const app = buildApp(config);
const adminHeaders = { 'x-admin-token': ADMIN_TOKEN };

interface FaqBody {
  item: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    body: string;
    tags: string[];
    topic: string | null;
    sortOrder: number;
    published: boolean;
  };
}

describe('FAQ mapping', () => {
  it('maps CMS FAQs onto knowledge articles', () => {
    const article = toFaqKnowledgeArticle({
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'dew-kiosk-hours',
      kind: 'faq',
      title: 'Are dew kiosks open overnight in PJ?',
      summary: '',
      body: 'Dew kiosks in Petaling Jaya stay closed overnight.',
      tags: ['dew-kiosk'],
      area: null,
      airportCode: null,
      topic: 'safety_non_emergency',
      whenToUse: null,
      icon: null,
      steps: [],
      sortOrder: 4,
      published: true,
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
    });
    expect(article.id).toBe(faqArticleId('dew-kiosk-hours'));
    expect(article.topic).toBe('faq');
    expect(article.category).toBe('safety_non_emergency');
    expect(article.summary).toContain('Dew kiosks');
    expect(article.escalation).toBe('none');
  });
});

describe('FAQ admin and public APIs', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createFaq(payload: Record<string, unknown>) {
    const created = await app.inject({
      method: 'POST',
      url: '/admin/faqs',
      headers: adminHeaders,
      payload,
    });
    expect(created.statusCode).toBe(201);
    return created.json() as FaqBody;
  }

  it('rejects anonymous and tourist sessions on admin FAQ routes', async () => {
    const missing = await app.inject({ method: 'GET', url: '/admin/faqs' });
    expect(missing.statusCode).toBe(401);

    const tourist = signAccessToken(
      {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'ada@example.com',
        displayName: 'Ada',
        role: 'tourist',
      },
      config,
    );
    const forbidden = await app.inject({
      method: 'GET',
      url: '/admin/faqs',
      headers: { authorization: `Bearer ${tourist}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('creates, searches, publishes, and deletes FAQs', async () => {
    const created = await createFaq({
      title: 'Are dew kiosks open overnight in PJ?',
      body: 'Dew kiosks in Petaling Jaya stay closed overnight. Buy sealed water before 22:00.',
      tags: ['dew-kiosk', 'pj'],
      topic: 'safety_non_emergency',
    });
    expect(created.item.slug).toBe('are-dew-kiosks-open-overnight-in-pj');
    expect(created.item.published).toBe(false);
    expect(created.item.topic).toBe('safety_non_emergency');

    const listed = await app.inject({
      method: 'GET',
      url: '/admin/faqs?q=dew-kiosk&published=false',
      headers: adminHeaders,
    });
    expect(listed.statusCode).toBe(200);
    const listBody = listed.json() as { topics: string[]; items: Array<{ id: string; published: boolean }> };
    expect(listBody.topics).toEqual([...CONCIERGE_CATEGORIES]);
    expect(listBody.items.some((item) => item.id === created.item.id)).toBe(true);
    expect(listBody.items.every((item) => item.published === false)).toBe(true);

    const publicDraft = await app.inject({ method: 'GET', url: '/faqs?q=dew-kiosk' });
    expect(publicDraft.statusCode).toBe(200);
    expect(
      (publicDraft.json() as { items: Array<{ id: string }> }).items.some((item) => item.id === created.item.id),
    ).toBe(false);

    const published = await app.inject({
      method: 'POST',
      url: `/admin/faqs/${created.item.id}/publish`,
      headers: adminHeaders,
    });
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ item: { published: true } });

    const publicLive = await app.inject({ method: 'GET', url: '/faqs?q=dew-kiosk' });
    expect(publicLive.statusCode).toBe(200);
    const publicBody = publicLive.json() as { items: Array<{ id: string; title: string }> };
    expect(publicBody.items.some((item) => item.id === created.item.id)).toBe(true);

    const knowledge = await app.inject({ method: 'GET', url: '/knowledge?q=dew-kiosk' });
    expect(knowledge.statusCode).toBe(200);
    const knowledgeBody = knowledge.json() as { articles: Array<{ id: string }> };
    expect(knowledgeBody.articles.some((article) => article.id === faqArticleId(created.item.slug))).toBe(
      true,
    );
    expect(knowledgeBody.articles.length).toBeGreaterThan(0);

    const chat = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: {
        message: 'Are dew kiosks open overnight in PJ?',
        categoryHint: 'safety_non_emergency',
      },
    });
    expect(chat.statusCode).toBe(200);
    const chatBody = chat.json() as {
      citations: Array<{ articleId: string }>;
      reply: { text: string };
    };
    expect(chatBody.citations.some((row) => row.articleId === faqArticleId(created.item.slug))).toBe(true);
    expect(chatBody.reply.text.toLowerCase()).toMatch(/dew kiosk/);

    const unpublished = await app.inject({
      method: 'POST',
      url: `/admin/faqs/${created.item.id}/unpublish`,
      headers: adminHeaders,
    });
    expect(unpublished.statusCode).toBe(200);

    const chatDraft = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: {
        message: 'Are dew kiosks open overnight in PJ?',
        categoryHint: 'safety_non_emergency',
      },
    });
    const draftBody = chatDraft.json() as { citations: Array<{ articleId: string }> };
    expect(draftBody.citations.some((row) => row.articleId === faqArticleId(created.item.slug))).toBe(
      false,
    );

    const removed = await app.inject({
      method: 'DELETE',
      url: `/admin/faqs/${created.item.id}`,
      headers: adminHeaders,
    });
    expect(removed.statusCode).toBe(204);
  });

  it('ignores non-FAQ content ids and rejects empty patches', async () => {
    const etiquette = await app.inject({
      method: 'POST',
      url: '/admin/content',
      headers: adminHeaders,
      payload: {
        kind: 'etiquette',
        title: 'Mosque visit reminder',
        body: 'Cover shoulders and knees.',
      },
    });
    expect(etiquette.statusCode).toBe(201);
    const etiquetteId = (etiquette.json() as { item: { id: string } }).item.id;

    const missing = await app.inject({
      method: 'GET',
      url: `/admin/faqs/${etiquetteId}`,
      headers: adminHeaders,
    });
    expect(missing.statusCode).toBe(404);

    const faq = await createFaq({
      title: 'Power plugs at dew kiosks',
      body: 'Type G only.',
    });
    const empty = await app.inject({
      method: 'PATCH',
      url: `/admin/faqs/${faq.item.id}`,
      headers: adminHeaders,
      payload: {},
    });
    expect(empty.statusCode).toBe(400);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/admin/faqs/${faq.item.id}`,
      headers: adminHeaders,
      payload: { summary: 'Type G plugs at dew kiosks.', topic: 'culture_etiquette' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      item: { summary: 'Type G plugs at dew kiosks.', topic: 'culture_etiquette' },
    });
  });

  it('keeps the knowledge seed length until a FAQ is published', async () => {
    const response = await app.inject({ method: 'GET', url: '/knowledge' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { articles: unknown[] };
    expect(body.articles.length).toBeGreaterThanOrEqual(MALAYSIA_KNOWLEDGE_SEED.articles.length);
  });
});
