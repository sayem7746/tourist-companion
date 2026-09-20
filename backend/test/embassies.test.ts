import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MALAYSIA_EMBASSY_SEED } from '../src/embassies/content.js';
import { isOfficialMissionWebsite, MISSION_KINDS } from '../src/embassies/types.js';
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

interface EmbassyResponse {
  country: string;
  destination: string;
  version: string;
  q: string | null;
  kind: string | null;
  kinds: string[];
  disclaimer: string;
  missions: Array<{
    id: string;
    name: string;
    sendingCountry: string;
    sendingCountryCode: string;
    kind: string;
    city: string;
    officialWebsite: string;
    sourceUrl: string;
    tags: string[];
    sortOrder: number;
  }>;
}

describe('Malaysia embassy directory', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('JSON seed matches TypeScript seed', () => {
    const jsonPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../db/malaysia-embassies.json',
    );
    const fromJson = JSON.parse(readFileSync(jsonPath, 'utf8')) as typeof MALAYSIA_EMBASSY_SEED;
    expect(fromJson).toEqual(MALAYSIA_EMBASSY_SEED);
  });

  it('seeds major KL missions with official websites only', () => {
    const codes = new Set(
      MALAYSIA_EMBASSY_SEED.missions.map((mission) => mission.sendingCountryCode),
    );
    expect(codes.has('US')).toBe(true);
    expect(codes.has('GB')).toBe(true);
    expect(codes.has('SG')).toBe(true);
    expect(codes.has('CN')).toBe(true);
    expect(codes.has('AU')).toBe(true);
    expect(MALAYSIA_EMBASSY_SEED.missions.every((mission) => mission.city === 'Kuala Lumpur')).toBe(
      true,
    );
    expect(
      MALAYSIA_EMBASSY_SEED.missions.every(
        (mission) =>
          isOfficialMissionWebsite(mission.officialWebsite) &&
          mission.sourceUrl === mission.officialWebsite,
      ),
    ).toBe(true);
    expect(isOfficialMissionWebsite('https://en.wikipedia.org/wiki/List_of_diplomatic_missions')).toBe(
      false,
    );
    expect(isOfficialMissionWebsite('http://my.usembassy.gov/')).toBe(false);
  });

  it('GET /embassies returns the KL seed and searches by country', async () => {
    const response = await app.inject({ method: 'GET', url: '/embassies' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as EmbassyResponse;
    expect(body.country).toBe('MY');
    expect(body.destination).toBe('Malaysia');
    expect(body.q).toBeNull();
    expect(body.kind).toBeNull();
    expect(body.kinds).toEqual([...MISSION_KINDS]);
    expect(body.missions.length).toBe(MALAYSIA_EMBASSY_SEED.missions.length);
    expect(body.missions.every((mission) => mission.officialWebsite.startsWith('https://'))).toBe(
      true,
    );
    expect(body.disclaimer).toContain('official mission websites only');

    const search = await app.inject({ method: 'GET', url: '/embassies?q=united%20states' });
    expect(search.statusCode).toBe(200);
    const found = search.json() as EmbassyResponse;
    expect(found.q).toBe('united states');
    expect(found.missions.map((mission) => mission.id)).toEqual(['kl-mission-us']);
  });

  it('filters by kind and rejects unofficial query values', async () => {
    const highCommissions = await app.inject({
      method: 'GET',
      url: '/embassies?kind=high_commission',
    });
    expect(highCommissions.statusCode).toBe(200);
    const hcBody = highCommissions.json() as EmbassyResponse;
    expect(hcBody.kind).toBe('high_commission');
    expect(hcBody.missions.length).toBeGreaterThan(0);
    expect(hcBody.missions.every((mission) => mission.kind === 'high_commission')).toBe(true);
    expect(hcBody.missions.some((mission) => mission.id === 'kl-mission-gb')).toBe(true);

    const consulates = await app.inject({ method: 'GET', url: '/embassies?kind=consulate' });
    expect(consulates.statusCode).toBe(200);
    expect((consulates.json() as EmbassyResponse).missions).toEqual([]);

    const unknownKind = await app.inject({ method: 'GET', url: '/embassies?kind=honorary' });
    expect(unknownKind.statusCode).toBe(400);

    const shortQuery = await app.inject({ method: 'GET', url: '/embassies?q=u' });
    expect(shortQuery.statusCode).toBe(400);
  });
});
