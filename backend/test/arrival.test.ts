import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ARRIVAL_CHECKLIST_SEED } from '../src/arrival/content.js';
import { ARRIVAL_STAGES } from '../src/arrival/types.js';
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

interface ChecklistResponse {
  airportCode: string;
  stage: string | null;
  stages: string[];
  items: Array<{
    id: string;
    airportCode: string;
    stage: string;
    title: string;
    body: string;
    sortOrder: number;
    estimatedMinutes?: number;
  }>;
}

describe('arrival checklist endpoint', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('defaults to KUL and returns items in stage order', async () => {
    const response = await app.inject({ method: 'GET', url: '/arrival-checklist' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as ChecklistResponse;
    expect(body.airportCode).toBe('KUL');
    expect(body.stage).toBeNull();
    expect(body.stages).toEqual([...ARRIVAL_STAGES]);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.airportCode === 'KUL')).toBe(true);
    expect(body.items.map((item) => item.stage)).toEqual(
      ARRIVAL_CHECKLIST_SEED.filter((item) => item.airportCode === 'KUL').map((item) => item.stage),
    );
    expect(body.items[0]).toMatchObject({
      id: 'kul-immigration-mdac',
      stage: 'immigration',
      title: 'Complete MDAC before passport control',
    });
  });

  it('filters by airport and optional stage', async () => {
    const klia2 = await app.inject({
      method: 'GET',
      url: '/arrival-checklist?airport=KLIA2',
    });
    expect(klia2.statusCode).toBe(200);
    const klia2Body = klia2.json() as ChecklistResponse;
    expect(klia2Body.airportCode).toBe('KLIA2');
    expect(klia2Body.items.every((item) => item.airportCode === 'KLIA2')).toBe(true);
    expect(klia2Body.items.some((item) => item.stage === 'transport')).toBe(true);

    const sim = await app.inject({
      method: 'GET',
      url: '/arrival-checklist?airport=KUL&stage=sim',
    });
    expect(sim.statusCode).toBe(200);
    const simBody = sim.json() as ChecklistResponse;
    expect(simBody.stage).toBe('sim');
    expect(simBody.items).toHaveLength(1);
    expect(simBody.items[0]).toMatchObject({
      id: 'kul-sim-counters',
      stage: 'sim',
      airportCode: 'KUL',
    });
  });

  it('rejects unknown airport or stage', async () => {
    const airport = await app.inject({
      method: 'GET',
      url: '/arrival-checklist?airport=PEN',
    });
    expect(airport.statusCode).toBe(400);

    const stage = await app.inject({
      method: 'GET',
      url: '/arrival-checklist?airport=KUL&stage=hotel',
    });
    expect(stage.statusCode).toBe(400);
  });

  it('returns KLIA Ekspres, bus, e-hailing, and private transfer with when-to-use', async () => {
    const response = await app.inject({ method: 'GET', url: '/arrival-transport' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      airportCode: string;
      options: Array<{ mode: string; name: string; whenToUse: string; boarding: string }>;
    };
    expect(body.airportCode).toBe('KUL');
    expect(body.options.map((option) => option.mode)).toEqual(['ekspres', 'bus', 'e_hail', 'private']);
    expect(body.options[0]).toMatchObject({ name: 'KLIA Ekspres' });
    expect(body.options.every((option) => option.whenToUse.length > 20)).toBe(true);
    expect(body.options.find((option) => option.mode === 'e_hail')?.boarding).toContain('Grab');
  });

  it('filters transport by airport and rejects unknown codes', async () => {
    const klia2 = await app.inject({ method: 'GET', url: '/arrival-transport?airport=KLIA2' });
    expect(klia2.statusCode).toBe(200);
    const body = klia2.json() as { airportCode: string; options: Array<{ boarding: string }> };
    expect(body.airportCode).toBe('KLIA2');
    expect(body.options[0].boarding).toContain('Gateway@klia2');

    const unknown = await app.inject({ method: 'GET', url: '/arrival-transport?airport=PEN' });
    expect(unknown.statusCode).toBe(400);
  });
});
