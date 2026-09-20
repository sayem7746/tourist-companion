import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { classifyIntent } from '../src/concierge/classify.js';
import { orchestrateConciergeChat } from '../src/concierge/orchestrate.js';
import { SOS_COPY } from '../src/concierge/prompts.js';
import { SlidingWindowLimiter } from '../src/concierge/rate-limit.js';
import { TRUST_LINE } from '../src/concierge/types.js';
import { loadConfig } from '../src/config.js';
import { queryKnowledge } from '../src/knowledge/query.js';

const app = buildApp(
  loadConfig({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-only-insecure-jwt-secret',
    CONCIERGE_RATE_LIMIT_MAX: '200',
  }),
);

interface ChatBody {
  conversationId: string;
  category: string;
  escalationLevel: string;
  mode: string;
  fallbackReason?: string;
  reply: {
    text: string;
    placeCards: Array<{ name: string }>;
    phraseTips: Array<{ phrase: string }>;
    followUpChips: string[];
    deepLink?: string;
    trustLine: string | null;
    sos: { color: string; path: string; numbers: Array<{ code: string }> } | null;
  };
  citations: Array<{ articleId: string; title: string; score: number }>;
  analytics: { category: string; escalationLevel: string };
}

describe('concierge API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /concierge/chat retrieve-and-ranks seed for Stitch chips without an LLM key', async () => {
    const spice = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Is this food spicy?' },
    });
    expect(spice.statusCode).toBe(200);
    const spiceBody = spice.json() as ChatBody;
    expect(spiceBody.mode).toBe('retrieve_and_rank');
    expect(spiceBody.category).toBe('food_spice_diet');
    expect(spiceBody.escalationLevel).toBe('none');
    expect(spiceBody.reply.text.toLowerCase()).toMatch(/tak pedas|sambal|chili/);
    expect(spiceBody.reply.phraseTips.some((tip) => /tak pedas/i.test(tip.phrase))).toBe(true);
    expect(spiceBody.citations.some((row) => row.articleId === 'my-food-spice')).toBe(true);
    expect(spiceBody.reply.text).not.toMatch(/\b(live fx|open now|87 minutes)\b/i);

    const lrt = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'How to ride the LRT?' },
    });
    const lrtBody = lrt.json() as ChatBody;
    expect(lrtBody.category).toBe('local_transport');
    expect(lrtBody.reply.text).toMatch(/Touch/i);
    expect(lrtBody.reply.trustLine).toBe(TRUST_LINE);
    expect(lrtBody.reply.deepLink).toBe('/arrival/transport');

    const cash = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Do I need cash for night market?' },
    });
    expect((cash.json() as ChatBody).reply.deepLink).toBe('/arrival/money');

    const dress = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Dress code for Batu Caves?' },
    });
    expect((dress.json() as ChatBody).category).toBe('culture_etiquette');
  });

  it('grounds family dinner in Bukit Bintang on knowledge seed cards and phrases', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: {
        message:
          "Hi! I'm near Bukit Bintang right now with my family. What are the best non-spicy Malaysian dishes to try for dinner that kids will also love?",
        context: { firstName: 'Alex' },
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as ChatBody;
    expect(body.reply.text).toMatch(/Welcome to Bukit Bintang, Alex!/);
    expect(body.reply.text.toLowerCase()).toMatch(/chicken rice|roti canai/);
    expect(body.reply.placeCards.length).toBeGreaterThan(0);
    expect(body.reply.followUpChips.join(' ')).toMatch(/Vegetarian|Jalan Alor|Food Map/i);
    expect(body.citations.every((row) => queryKnowledge({}).articles.some((a) => a.id === row.articleId))).toBe(
      true,
    );
  });

  it('escalates SOS without restaurant chips and refuses out-of-bounds medical and booking', async () => {
    const sos = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Someone grabbed my bag and I think they are still following me.' },
    });
    const sosBody = sos.json() as ChatBody;
    expect(sosBody.category).toBe('emergency');
    expect(sosBody.escalationLevel).toBe('sos');
    expect(sosBody.reply.text).toBe(SOS_COPY);
    expect(sosBody.reply.sos).toMatchObject({ color: '#E11D48', path: 'emergency-help' });
    expect(sosBody.reply.sos?.numbers.map((n) => n.code)).toEqual(['999', '112']);
    expect(sosBody.reply.followUpChips).toEqual([]);
    expect(sosBody.reply.placeCards).toEqual([]);
    expect(sosBody.analytics.escalationLevel).toBe('sos');

    const medical = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Which antibiotic should I take for this stomach bug?' },
    });
    const medicalBody = medical.json() as ChatBody;
    expect(medicalBody.escalationLevel).toBe('out_of_bounds');
    expect(medicalBody.reply.text).toMatch(/cannot diagnose|antibiotic/i);

    const booking = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Book me a table at that chicken rice shop for 7pm.' },
    });
    expect((booking.json() as ChatBody).reply.text).toMatch(/cannot book/i);
  });

  it('deep-links arrival ops and handoff for lost passport', async () => {
    const sim = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Where do I buy a SIM after KLIA customs?' },
    });
    const simBody = sim.json() as ChatBody;
    expect(simBody.category).toBe('arrival_ops');
    expect(simBody.reply.deepLink).toBe('/arrival/sim');
    expect(simBody.reply.text.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(6);

    const passport = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'I lost my passport at the mall.' },
    });
    expect((passport.json() as ChatBody).escalationLevel).toBe('handoff');
  });

  it('allows anonymous chat and injects JWT display name when present', async () => {
    const anon = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Best dinner near KLCC?', context: { area: 'KLCC' } },
    });
    expect(anon.statusCode).toBe(200);

    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'concierge-user@example.com', password: 'password12', displayName: 'Alex' },
    });
    expect(signup.statusCode).toBe(201);
    const token = (signup.json() as { token: string }).token;

    const authed = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        message: 'Hi! I am near Bukit Bintang with my family looking for non-spicy dinner kids will love.',
      },
    });
    expect(authed.statusCode).toBe(200);
    expect((authed.json() as ChatBody).reply.text).toMatch(/Welcome to Bukit Bintang, Alex!/);

    const bad = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers: { authorization: 'Bearer not-a-real-token' },
      payload: { message: 'How to ride the LRT?' },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('validates the chat body', async () => {
    const empty = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: '' },
    });
    expect(empty.statusCode).toBe(400);

    const extra = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'hello', unknown: true },
    });
    expect(extra.statusCode).toBe(400);
  });

  it('rate limits concierge chat', async () => {
    const limited = buildApp(
      loadConfig({
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: '3001',
        LOG_LEVEL: 'silent',
        JWT_SECRET: 'test-only-insecure-jwt-secret',
        CONCIERGE_RATE_LIMIT_MAX: '2',
        CONCIERGE_RATE_LIMIT_WINDOW_MS: '60000',
      }),
    );
    await limited.ready();
    try {
      const first = await limited.inject({
        method: 'POST',
        url: '/concierge/chat',
        payload: { message: 'How to ride the LRT?' },
      });
      const second = await limited.inject({
        method: 'POST',
        url: '/concierge/chat',
        payload: { message: 'Is this food spicy?' },
      });
      const third = await limited.inject({
        method: 'POST',
        url: '/concierge/chat',
        payload: { message: 'Dress code for Batu Caves?' },
      });
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(third.statusCode).toBe(429);
      expect(third.headers['retry-after']).toBeTruthy();
      const err = third.json() as { error: { code: string } };
      expect(err.error.code).toBe('RATE_LIMITED');
    } finally {
      await limited.close();
    }
  });

  it('falls back to retrieve-and-rank when the LLM fails', async () => {
    const result = await orchestrateConciergeChat(
      { message: 'How to ride the LRT?' },
      {
        useLlm: true,
        llm: {
          async complete() {
            throw new Error('upstream timeout');
          },
        },
      },
    );
    expect(result.mode).toBe('retrieve_and_rank');
    expect(result.fallbackReason).toBe('llm_error');
    expect(result.reply.text).toMatch(/Touch/i);
  });

  it('uses LLM text when JSON is valid but keeps seed place cards', async () => {
    const result = await orchestrateConciergeChat(
      { message: 'Best dinner near KLCC?' },
      {
        useLlm: true,
        llm: {
          async complete() {
            return JSON.stringify({
              text: 'From the seed: Suria KLCC food court is the easy family option.',
              followUpChips: ['Bukit Bintang Food Map', 'Invented nightlife crawl'],
            });
          },
        },
      },
    );
    expect(result.mode).toBe('llm');
    expect(result.reply.text).toMatch(/Suria KLCC/);
    expect(result.reply.followUpChips).toContain('Bukit Bintang Food Map');
    expect(result.reply.followUpChips.join(' ')).not.toMatch(/Invented/);
    expect(result.reply.placeCards.some((card) => /Suria KLCC/i.test(card.name))).toBe(true);
  });
});

describe('concierge classifiers and limiter', () => {
  it('classifies chips and SOS first', () => {
    expect(classifyIntent('How to ride the LRT?').articleHint).toBe('my-transport-lrt');
    expect(classifyIntent('call the police I am being followed').escalationLevel).toBe('sos');
  });

  it('counts a sliding window', () => {
    let now = 1_000;
    const limiter = new SlidingWindowLimiter(1, 1_000, () => now);
    expect(limiter.take('ip:1')).toEqual({ ok: true });
    expect(limiter.take('ip:1').ok).toBe(false);
    now = 2_100;
    expect(limiter.take('ip:1')).toEqual({ ok: true });
  });
});
