import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SOS_CARD } from '../src/concierge/types.js';
import { MALAYSIA_EMERGENCY_SEED, MALAYSIA_SOS_NUMBERS } from '../src/emergency/content.js';
import { EMERGENCY_CATEGORIES } from '../src/emergency/types.js';
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

interface EmergencyResponse {
  country: string;
  destination: string;
  version: string;
  category: string | null;
  urgency: string | null;
  categories: string[];
  disclaimer: string;
  sos: {
    color: string;
    path: string;
    numbers: Array<{ code: string; label: string }>;
  };
  contacts: Array<{
    id: string;
    name: string;
    category: string;
    urgency: string;
    numbers: Array<{ code: string; label: string; display?: string }>;
    summary: string;
    whenToUse: string;
    area: string;
    hours: string;
    source: string;
    sortOrder: number;
  }>;
}

function allCodes(body: EmergencyResponse): string[] {
  return body.contacts.flatMap((contact) => contact.numbers.map((number) => number.code));
}

function allDisplays(body: EmergencyResponse): string[] {
  return body.contacts.flatMap((contact) =>
    contact.numbers.map((number) => number.display ?? number.code),
  );
}

describe('Malaysia emergency directory', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('JSON seed matches TypeScript seed', () => {
    const jsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/malaysia-emergency.json');
    const fromJson = JSON.parse(readFileSync(jsonPath, 'utf8')) as typeof MALAYSIA_EMERGENCY_SEED;
    expect(fromJson).toEqual(MALAYSIA_EMERGENCY_SEED);
  });

  it('covers police, ambulance, fire, and tourist assistance', () => {
    const categories = new Set(MALAYSIA_EMERGENCY_SEED.contacts.map((contact) => contact.category));
    expect([...EMERGENCY_CATEGORIES].every((category) => categories.has(category))).toBe(true);
    expect(MALAYSIA_SOS_NUMBERS.map((number) => number.code)).toEqual(['999', '112']);
  });

  it('GET /emergency returns Malaysia seed with 999, 112, and tourist police', async () => {
    const response = await app.inject({ method: 'GET', url: '/emergency' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as EmergencyResponse;
    expect(body.country).toBe('MY');
    expect(body.destination).toBe('Malaysia');
    expect(body.category).toBeNull();
    expect(body.urgency).toBeNull();
    expect(body.categories).toEqual([...EMERGENCY_CATEGORIES]);
    expect(body.contacts.length).toBe(MALAYSIA_EMERGENCY_SEED.contacts.length);
    expect(allCodes(body)).toEqual(expect.arrayContaining(['999', '112']));
    expect(allDisplays(body)).toEqual(
      expect.arrayContaining(['03-2149 6590', '03-2115 9999']),
    );
    expect(body.contacts.find((contact) => contact.id === 'my-em-police')).toMatchObject({
      category: 'police',
      urgency: 'sos',
    });
    expect(body.contacts.find((contact) => contact.id === 'my-em-ambulance')).toMatchObject({
      category: 'ambulance',
      urgency: 'sos',
    });
    expect(body.contacts.find((contact) => contact.id === 'my-em-fire')).toMatchObject({
      category: 'fire',
      urgency: 'sos',
    });
    expect(body.contacts.find((contact) => contact.id === 'my-em-tourist-police')).toMatchObject({
      category: 'tourist_assistance',
      urgency: 'assistance',
      name: 'Tourist Police (Bukit Bintang)',
    });
    expect(body.disclaimer).toContain('999');
    expect(body.sos).toEqual(SOS_CARD);
    expect(body.contacts.every((contact) => contact.whenToUse.length > 20)).toBe(true);
  });

  it('filters by category and urgency', async () => {
    const police = await app.inject({ method: 'GET', url: '/emergency?category=police' });
    expect(police.statusCode).toBe(200);
    const policeBody = police.json() as EmergencyResponse;
    expect(policeBody.category).toBe('police');
    expect(policeBody.contacts).toHaveLength(1);
    expect(policeBody.contacts[0]?.id).toBe('my-em-police');
    expect(policeBody.sos.numbers.map((number) => number.code)).toEqual(['999', '112']);

    const assistance = await app.inject({
      method: 'GET',
      url: '/emergency?urgency=assistance',
    });
    expect(assistance.statusCode).toBe(200);
    const assistanceBody = assistance.json() as EmergencyResponse;
    expect(assistanceBody.urgency).toBe('assistance');
    expect(assistanceBody.contacts.every((contact) => contact.urgency === 'assistance')).toBe(true);
    expect(assistanceBody.contacts.some((contact) => contact.id === 'my-em-tourist-police')).toBe(
      true,
    );
  });

  it('rejects unknown category or urgency', async () => {
    const category = await app.inject({ method: 'GET', url: '/emergency?category=hospital' });
    expect(category.statusCode).toBe(400);

    const urgency = await app.inject({ method: 'GET', url: '/emergency?urgency=critical' });
    expect(urgency.statusCode).toBe(400);
  });
});
