import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MALAYSIA_SAFETY_SEED } from '../src/safety/content.js';
import { SAFETY_ACCENT, SAFETY_TOPICS } from '../src/safety/types.js';
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

interface SafetyResponse {
  country: string;
  destination: string;
  version: string;
  topic: string | null;
  topics: string[];
  disclaimer: string;
  accent: string;
  emergencyPath: string;
  embassyPath: string;
  tips: Array<{
    id: string;
    topic: string;
    title: string;
    summary: string;
    steps: string[];
    whenToUse: string;
    icon: string;
    links: Array<{ label: string; path: string }>;
    sortOrder: number;
  }>;
}

describe('Malaysia tourist safety guide', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('JSON seed matches TypeScript seed', () => {
    const jsonPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../db/malaysia-safety.json',
    );
    const fromJson = JSON.parse(readFileSync(jsonPath, 'utf8')) as typeof MALAYSIA_SAFETY_SEED;
    expect(fromJson).toEqual(MALAYSIA_SAFETY_SEED);
  });

  it('covers lost items, scams, transport disputes, and document loss', () => {
    const topics = new Set(MALAYSIA_SAFETY_SEED.tips.map((tip) => tip.topic));
    expect([...SAFETY_TOPICS].every((topic) => topics.has(topic))).toBe(true);
    expect(MALAYSIA_SAFETY_SEED.tips.every((tip) => tip.steps.length >= 4)).toBe(true);
    expect(
      MALAYSIA_SAFETY_SEED.tips.every((tip) =>
        tip.links.some((link) => link.path === '/emergency' || link.path === '/embassies'),
      ),
    ).toBe(true);
  });

  it('GET /safety returns emerald-accent tips with embassy and emergency paths', async () => {
    const response = await app.inject({ method: 'GET', url: '/safety' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as SafetyResponse;
    expect(body.country).toBe('MY');
    expect(body.destination).toBe('Malaysia');
    expect(body.topic).toBeNull();
    expect(body.topics).toEqual([...SAFETY_TOPICS]);
    expect(body.accent).toBe(SAFETY_ACCENT);
    expect(body.accent).toBe('#0D7652');
    expect(body.emergencyPath).toBe('/emergency');
    expect(body.embassyPath).toBe('/embassies');
    expect(body.tips.length).toBe(MALAYSIA_SAFETY_SEED.tips.length);
    expect(body.tips.map((tip) => tip.id)).toEqual([
      'my-safety-lost-items',
      'my-safety-scams',
      'my-safety-transport',
      'my-safety-documents',
    ]);
    expect(body.tips.find((tip) => tip.id === 'my-safety-documents')?.links).toEqual(
      expect.arrayContaining([
        { label: 'Emergency help', path: '/emergency' },
        { label: 'Find your embassy', path: '/embassies' },
      ]),
    );
    expect(body.disclaimer).toContain('999');
    expect(body.tips.every((tip) => tip.whenToUse.length > 20)).toBe(true);
  });

  it('filters by topic and rejects unknown values', async () => {
    const scams = await app.inject({ method: 'GET', url: '/safety?topic=scams' });
    expect(scams.statusCode).toBe(200);
    const scamBody = scams.json() as SafetyResponse;
    expect(scamBody.topic).toBe('scams');
    expect(scamBody.tips).toHaveLength(1);
    expect(scamBody.tips[0]?.id).toBe('my-safety-scams');
    expect(scamBody.accent).toBe('#0D7652');

    const documents = await app.inject({ method: 'GET', url: '/safety?topic=document_loss' });
    expect(documents.statusCode).toBe(200);
    expect((documents.json() as SafetyResponse).tips[0]?.id).toBe('my-safety-documents');

    const unknown = await app.inject({ method: 'GET', url: '/safety?topic=crime_map' });
    expect(unknown.statusCode).toBe(400);
  });
});
