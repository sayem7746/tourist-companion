import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signAccessToken } from '../src/auth/tokens.js';
import { isContentKind, slugifyContentTitle } from '../src/content/map.js';
import { CONTENT_KINDS } from '../src/content/types.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

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

interface ContentBody {
  item: {
    id: string;
    slug: string;
    kind: string;
    title: string;
    summary: string;
    body: string;
    tags: string[];
    area: string | null;
    airportCode: string | null;
    topic: string | null;
    whenToUse: string | null;
    icon: string | null;
    steps: string[];
    sortOrder: number;
    published: boolean;
  };
}

describe('content management model', () => {
  it('accepts the five CMS kinds and slugs titles', () => {
    expect(CONTENT_KINDS).toEqual(['arrival_guide', 'faq', 'etiquette', 'payment', 'safety']);
    expect(isContentKind('etiquette')).toBe(true);
    expect(isContentKind('knowledge')).toBe(false);
    expect(slugifyContentTitle('Dress code for Batu Caves')).toBe('dress-code-for-batu-caves');
  });
});

describe('content admin APIs', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createItem(payload: Record<string, unknown>) {
    const created = await app.inject({
      method: 'POST',
      url: '/admin/content',
      headers: adminHeaders,
      payload,
    });
    expect(created.statusCode).toBe(201);
    return created.json() as ContentBody;
  }

  it('rejects anonymous and tourist sessions', async () => {
    const missing = await app.inject({ method: 'GET', url: '/admin/content' });
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
      url: '/admin/content',
      headers: { authorization: `Bearer ${tourist}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('creates, lists, edits, publishes, and deletes content', async () => {
    const created = await createItem({
      kind: 'faq',
      title: 'Do people speak English?',
      body: 'Yes in tourist KL, hotels, malls, and Grab; Malay phrases still help at markets.',
      tags: ['english', 'malay'],
    });
    expect(created.item.slug).toBe('do-people-speak-english');
    expect(created.item.published).toBe(false);
    expect(created.item.kind).toBe('faq');

    const listed = await app.inject({
      method: 'GET',
      url: '/admin/content?kind=faq&q=english',
      headers: adminHeaders,
    });
    expect(listed.statusCode).toBe(200);
    const listBody = listed.json() as { kinds: string[]; items: Array<{ id: string; kind: string }> };
    expect(listBody.kinds).toEqual([...CONTENT_KINDS]);
    expect(listBody.items.some((item) => item.id === created.item.id)).toBe(true);
    expect(listBody.items.every((item) => item.kind === 'faq')).toBe(true);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/admin/content/${created.item.id}`,
      headers: adminHeaders,
      payload: { summary: 'English is common in tourist KL.', sortOrder: 3 },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      item: { summary: 'English is common in tourist KL.', sortOrder: 3 },
    });

    const published = await app.inject({
      method: 'POST',
      url: `/admin/content/${created.item.id}/publish`,
      headers: adminHeaders,
    });
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ item: { published: true } });

    const adminJwt = signAccessToken(
      {
        id: '00000000-0000-4000-8000-000000000099',
        email: 'ops@example.com',
        displayName: 'Ops',
        role: 'admin',
      },
      config,
    );
    const fetched = await app.inject({
      method: 'GET',
      url: `/admin/content/${created.item.id}`,
      headers: { authorization: `Bearer ${adminJwt}` },
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({ item: { id: created.item.id, published: true } });

    const unpublished = await app.inject({
      method: 'POST',
      url: `/admin/content/${created.item.id}/unpublish`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(unpublished.statusCode).toBe(200);
    expect(unpublished.json()).toMatchObject({ item: { published: false } });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/admin/content',
      headers: adminHeaders,
      payload: {
        kind: 'etiquette',
        title: 'Other',
        slug: 'do-people-speak-english',
        body: 'Duplicate slug should fail.',
      },
    });
    expect(duplicate.statusCode).toBe(409);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/admin/content/${created.item.id}`,
      headers: adminHeaders,
    });
    expect(removed.statusCode).toBe(204);

    const missing = await app.inject({
      method: 'GET',
      url: `/admin/content/${created.item.id}`,
      headers: adminHeaders,
    });
    expect(missing.statusCode).toBe(404);
  });

  it('stores arrival, etiquette, payment, and safety fields', async () => {
    const arrival = await createItem({
      kind: 'arrival_guide',
      title: 'Passport control at KLIA (main)',
      body: 'Join the foreign-passport queues unless you hold a Malaysian passport.',
      airportCode: 'KUL',
      topic: 'immigration',
      sortOrder: 2,
      published: true,
    });
    expect(arrival.item).toMatchObject({
      kind: 'arrival_guide',
      airportCode: 'KUL',
      topic: 'immigration',
      published: true,
    });

    const etiquette = await createItem({
      kind: 'etiquette',
      title: 'Visiting mosques',
      summary: 'Modest clothing, shoes off, speak softly.',
      body: 'Cover shoulders and knees; women may be asked to wear a robe or scarf.',
      area: 'Kuala Lumpur',
      tags: ['mosque', 'dress'],
    });
    expect(etiquette.item.area).toBe('Kuala Lumpur');

    const payment = await createItem({
      kind: 'payment',
      title: 'Airport ATMs',
      body: 'Use a Visa or Mastercard at a branded bank ATM and choose MYR.',
      airportCode: 'KUL',
      topic: 'atm',
    });
    expect(payment.item.topic).toBe('atm');

    const safety = await createItem({
      kind: 'safety',
      title: 'Everyday scams and touts',
      body: 'Ignore unsolicited gem and “closed temple” stories.',
      topic: 'scams',
      whenToUse: 'Use for touts and street pressure in tourist belts.',
      icon: 'policy',
      steps: ['Walk on if someone says your attraction is closed.', 'Skip unofficial airport greeters.'],
    });
    expect(safety.item.steps).toHaveLength(2);
    expect(safety.item.topic).toBe('scams');

    const badTopic = await app.inject({
      method: 'POST',
      url: '/admin/content',
      headers: adminHeaders,
      payload: {
        kind: 'safety',
        title: 'Bad topic',
        body: 'Topic must match a safety topic.',
        topic: 'immigration',
      },
    });
    expect(badTopic.statusCode).toBe(400);

    const empty = await app.inject({
      method: 'PATCH',
      url: `/admin/content/${safety.item.id}`,
      headers: adminHeaders,
      payload: {},
    });
    expect(empty.statusCode).toBe(400);
  });
});
