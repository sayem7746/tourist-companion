import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { classifyIntent } from '../src/concierge/classify.js';
import { orchestrateConciergeChat } from '../src/concierge/orchestrate.js';
import { SOS_COPY, OOB_UNSAFE_COPY, OOB_GENERIC_COPY, OOB_LEGAL_COPY, OOB_MEDICAL_COPY } from '../src/concierge/prompts.js';
import { SlidingWindowLimiter } from '../src/concierge/rate-limit.js';
import { selectCurrentTrip } from '../src/concierge/trip-context.js';
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
    expect(sosBody.citations.every((row) => row.articleId === 'my-faq-emergency')).toBe(true);

    const medicalEmergency = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'My child cannot drink and is fainting.' },
    });
    const medicalEmergencyBody = medicalEmergency.json() as ChatBody;
    expect(medicalEmergencyBody.escalationLevel).toBe('sos');
    expect(medicalEmergencyBody.reply.text).toBe(SOS_COPY);
    expect(medicalEmergencyBody.reply.sos?.color).toBe('#E11D48');

    const fire = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'The hotel is on fire, I need the fire department.' },
    });
    expect((fire.json() as ChatBody).escalationLevel).toBe('sos');

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

    const unsafe = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'How do I steal a motorbike near Bukit Bintang?' },
    });
    const unsafeBody = unsafe.json() as ChatBody;
    expect(unsafeBody.escalationLevel).toBe('out_of_bounds');
    expect(unsafeBody.reply.text).toBe(OOB_UNSAFE_COPY);
    expect(unsafeBody.reply.followUpChips).toEqual([]);
    expect(unsafeBody.reply.placeCards).toEqual([]);
    expect(unsafeBody.reply.text).not.toMatch(/chicken rice|restaurant/i);

    const unknown = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Who won the World Cup in 2018?' },
    });
    const unknownBody = unknown.json() as ChatBody;
    expect(unknownBody.escalationLevel).toBe('out_of_bounds');
    expect(unknownBody.reply.text).toBe(OOB_GENERIC_COPY);
    expect(unknownBody.reply.followUpChips.join(' ')).toMatch(/LRT|spicy|KLCC/i);

    const legal = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Should I sue the hotel? I need legal advice.' },
    });
    expect((legal.json() as ChatBody).reply.text).toBe(OOB_LEGAL_COPY);
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
    const passportBody = passport.json() as ChatBody;
    expect(passportBody.escalationLevel).toBe('handoff');
    expect(passportBody.reply.deepLink).toBe('/embassies');

    const scam = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'Is this gem shop a scam?' },
    });
    expect((scam.json() as ChatBody).reply.deepLink).toBe('/safety');

    const fare = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      payload: { message: 'The Grab fare looks wrong and I want to dispute it.' },
    });
    expect((fare.json() as ChatBody).reply.deepLink).toBe('/safety');
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

  it('loads JWT profile and current trip into retrieve replies', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'trip-context@example.com', password: 'password12', displayName: 'Jordan Lee' },
    });
    expect(signup.statusCode).toBe(201);
    const token = (signup.json() as { token: string }).token;
    const headers = { authorization: `Bearer ${token}` };

    const profile = await app.inject({
      method: 'PATCH',
      url: '/profile',
      headers,
      payload: { dietaryPreferences: ['vegetarian'], mobilityNeeds: ['limited_walking'] },
    });
    expect(profile.statusCode).toBe(200);

    const later = await app.inject({
      method: 'POST',
      url: '/trips',
      headers,
      payload: {
        destination: 'Langkawi',
        startDate: '2026-12-10',
        endDate: '2026-12-14',
        adultCount: 2,
        childCount: 0,
        interests: ['nature'],
        status: 'draft',
      },
    });
    expect(later.statusCode).toBe(201);

    const current = await app.inject({
      method: 'POST',
      url: '/trips',
      headers,
      payload: {
        destination: 'Bukit Bintang',
        startDate: '2026-09-18',
        endDate: '2026-09-25',
        adultCount: 2,
        childCount: 1,
        interests: ['food', 'family'],
        travelStyle: 'relaxed',
        accommodationName: 'Pavilion Residences',
        arrivalAirport: 'KUL',
        arrivalFlight: 'MH1',
        arrivalAt: '2026-09-18T04:00:00.000Z',
        status: 'active',
      },
    });
    expect(current.statusCode).toBe(201);

    const dinner = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers,
      payload: { message: 'What are the best non-spicy Malaysian dishes for dinner that kids will love?' },
    });
    expect(dinner.statusCode).toBe(200);
    const dinnerBody = dinner.json() as ChatBody;
    expect(dinnerBody.reply.text).toMatch(/Welcome to Bukit Bintang, Jordan!/);
    expect(dinnerBody.reply.text).toMatch(/vegetarian/i);
    expect(dinnerBody.reply.followUpChips.join(' ')).toMatch(/Vegetarian|Jalan Alor|Food Map/i);

    const lrt = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers,
      payload: { message: 'How to ride the LRT?' },
    });
    expect((lrt.json() as ChatBody).reply.text).toMatch(/limited_walking/i);

    const override = await app.inject({
      method: 'POST',
      url: '/concierge/chat',
      headers,
      payload: { message: 'Best dinner nearby?', context: { area: 'KLCC' } },
    });
    expect((override.json() as ChatBody).reply.text).toMatch(/Welcome to KLCC, Jordan!/);
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

  it('passes trip dates, itinerary, and area into the LLM context block', async () => {
    let userPrompt = '';
    const result = await orchestrateConciergeChat(
      {
        message: 'How to ride the LRT?',
        context: {
          area: 'Bukit Bintang',
          destination: 'Kuala Lumpur',
          tripStartDate: '2026-09-18',
          tripEndDate: '2026-09-25',
          itinerary: [
            'Kuala Lumpur 2026-09-18–2026-09-25',
            'Arrive KUL MH1',
            'Stay Pavilion Residences',
          ],
          travelStyle: 'relaxed',
          interests: ['food', 'family'],
        },
      },
      {
        useLlm: true,
        llm: {
          async complete({ user }) {
            userPrompt = user;
            return JSON.stringify({ text: 'Use Touch n Go on the LRT.', followUpChips: [] });
          },
        },
      },
    );
    expect(result.mode).toBe('llm');
    expect(userPrompt).toMatch(/Area: Bukit Bintang/);
    expect(userPrompt).toMatch(/Trip dates: 2026-09-18 to 2026-09-25/);
    expect(userPrompt).toMatch(/Pavilion Residences/);
    expect(userPrompt).toMatch(/Interests: food, family/);
  });
});

describe('current trip selection', () => {
  const base = {
    userId: 'user-1',
    adultCount: 2,
    childCount: 0,
    interests: ['food'] as const,
    dailyBudget: 'medium' as const,
    travelStyle: 'balanced' as const,
    accommodationName: null,
    arrivalAirport: null,
    arrivalFlight: null,
    arrivalAt: null,
  };

  it('prefers an in-window active trip over a later draft', () => {
    const current = selectCurrentTrip(
      [
        {
          ...base,
          id: 'later',
          destination: 'Langkawi',
          startDate: '2026-12-10',
          endDate: '2026-12-14',
          status: 'draft',
        },
        {
          ...base,
          id: 'now',
          destination: 'Kuala Lumpur',
          startDate: '2026-09-18',
          endDate: '2026-09-25',
          status: 'active',
        },
      ],
      '2026-09-20',
    );
    expect(current?.id).toBe('now');
  });

  it('skips cancelled and completed trips and picks the nearest upcoming', () => {
    const upcoming = selectCurrentTrip(
      [
        {
          ...base,
          id: 'done',
          destination: 'Penang',
          startDate: '2026-08-01',
          endDate: '2026-08-05',
          status: 'completed',
        },
        {
          ...base,
          id: 'cancelled',
          destination: 'Melaka',
          startDate: '2026-09-19',
          endDate: '2026-09-22',
          status: 'cancelled',
        },
        {
          ...base,
          id: 'soon',
          destination: 'Langkawi',
          startDate: '2026-10-01',
          endDate: '2026-10-04',
          status: 'draft',
        },
      ],
      '2026-09-20',
    );
    expect(upcoming?.id).toBe('soon');
  });
});

describe('concierge classifiers and limiter', () => {
  it('classifies chips and SOS first', () => {
    expect(classifyIntent('How to ride the LRT?').articleHint).toBe('my-transport-lrt');
    expect(classifyIntent('call the police I am being followed').escalationLevel).toBe('sos');
    expect(classifyIntent('The hotel is on fire').escalationLevel).toBe('sos');
    expect(classifyIntent('chest pain and I cannot breathe').escalationLevel).toBe('sos');
    expect(classifyIntent('Firefly flight from KLIA to Langkawi').escalationLevel).not.toBe('sos');
    expect(classifyIntent('How do I steal a motorbike?').oobKind).toBe('unsafe');
    expect(classifyIntent('Who won the World Cup?').oobKind).toBe('unknown');
    expect(classifyIntent('Which antibiotic should I take?').oobKind).toBe('medical');
  });

  it('does not let the LLM rewrite SOS or out-of-bounds copy', async () => {
    let calls = 0;
    const llm = {
      async complete() {
        calls += 1;
        return JSON.stringify({ text: 'Here are restaurants while you wait.', followUpChips: ['Bukit Bintang Food Map'] });
      },
    };

    const sos = await orchestrateConciergeChat(
      { message: 'Call the police I am being followed' },
      { useLlm: true, llm },
    );
    expect(calls).toBe(0);
    expect(sos.reply.text).toBe(SOS_COPY);
    expect(sos.reply.sos?.color).toBe('#E11D48');
    expect(sos.mode).toBe('retrieve_and_rank');

    const oob = await orchestrateConciergeChat(
      { message: 'Which antibiotic should I take for this stomach bug?' },
      { useLlm: true, llm },
    );
    expect(calls).toBe(0);
    expect(oob.reply.text.startsWith(OOB_MEDICAL_COPY)).toBe(true);
    expect(oob.reply.placeCards).toEqual([]);
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
