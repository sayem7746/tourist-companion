import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { attachDayWeather } from '../src/weather/attach.js';
import { createWeatherClient, resolveWeatherProviderKind } from '../src/weather/client.js';
import { coordinatesForDestination } from '../src/weather/geo.js';
import { hintFromForecast, seedHintForDate } from '../src/weather/hints.js';
import { WEATHER_DISCLAIMER } from '../src/weather/types.js';
import type { Itinerary } from '../src/itinerary/types.js';

function itineraryFor(dates: string[]): Itinerary {
  return {
    id: 'itin',
    tripId: 'trip',
    dayCount: dates.length,
    status: 'draft',
    generatedAt: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    days: dates.map((date, index) => ({
      id: `day-${index + 1}`,
      itineraryId: 'itin',
      dayNumber: index + 1,
      date,
      items: [],
    })),
  };
}

describe('weather hints', () => {
  it('uses climate seed language that is not a forecast guarantee', () => {
    const monsoon = seedHintForDate('2026-12-15');
    expect(monsoon.source).toBe('seed');
    expect(monsoon.condition).toBe('rain');
    expect(monsoon.indoorSafe).toBe(true);
    expect(monsoon.hint).toMatch(/climate pattern/i);
    expect(monsoon.disclaimer).toBe(WEATHER_DISCLAIMER);

    const haze = seedHintForDate('2026-08-01');
    expect(haze.condition).toBe('haze_season');
    expect(haze.indoorSafe).toBe(false);

    const typical = seedHintForDate('2026-04-10');
    expect(typical.condition).toBe('typical');
    expect(typical.disclaimer).toContain('not a forecast guarantee');
  });

  it('maps Open-Meteo daily values to indoor-safe rain and heat hints', () => {
    const rain = hintFromForecast({
      date: '2026-09-22',
      weatherCode: 61,
      temperatureMaxC: 31,
      temperatureMinC: 24,
      precipitationProbabilityMax: 80,
      precipitationSumMm: 8,
    });
    expect(rain.source).toBe('open-meteo');
    expect(rain.condition).toBe('rain');
    expect(rain.indoorSafe).toBe(true);
    expect(rain.disclaimer).toBe(WEATHER_DISCLAIMER);

    const storm = hintFromForecast({
      date: '2026-09-23',
      weatherCode: 95,
      temperatureMaxC: 30,
      temperatureMinC: 24,
      precipitationProbabilityMax: 90,
      precipitationSumMm: 20,
    });
    expect(storm.condition).toBe('storm');
    expect(storm.indoorSafe).toBe(true);

    const heat = hintFromForecast({
      date: '2026-09-24',
      weatherCode: 1,
      temperatureMaxC: 34,
      temperatureMinC: 25,
      precipitationProbabilityMax: 10,
      precipitationSumMm: 0,
    });
    expect(heat.condition).toBe('heat');
    expect(heat.indoorSafe).toBe(false);
    expect(heat.hint).not.toMatch(/guarantee that/i);
  });

  it('resolves Malaysia destinations to coordinates', () => {
    expect(coordinatesForDestination('Bukit Bintang')).toMatchObject({
      latitude: 3.1466,
      longitude: 101.711,
    });
    expect(coordinatesForDestination('Langkawi')).toMatchObject({
      latitude: 6.35,
      longitude: 99.8,
    });
    expect(coordinatesForDestination('Somewhere unknown')).toMatchObject({
      latitude: 3.15785,
      longitude: 101.71165,
    });
  });

  it('defaults tests to the seed provider and production-like configs to Open-Meteo', () => {
    expect(
      resolveWeatherProviderKind(
        loadConfig({
          NODE_ENV: 'test',
          HOST: '127.0.0.1',
          PORT: '3000',
          JWT_SECRET: 'test-only-insecure-jwt-secret',
        }),
      ),
    ).toBe('seed');
    expect(
      resolveWeatherProviderKind(
        loadConfig({
          NODE_ENV: 'development',
          HOST: '127.0.0.1',
          PORT: '3000',
          JWT_SECRET: 'test-only-insecure-jwt-secret',
        }),
      ),
    ).toBe('open-meteo');
  });

  it('fetches Open-Meteo daily data and falls back per missing day', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain('/v1/forecast');
      expect(url).toContain('timezone=Asia%2FKuala_Lumpur');
      expect(url).toContain('start_date=2026-09-21');
      return new Response(
        JSON.stringify({
          daily: {
            time: ['2026-09-21'],
            weather_code: [95],
            temperature_2m_max: [31.2],
            temperature_2m_min: [24.1],
            precipitation_probability_max: [90],
            precipitation_sum: [18],
          },
        }),
        { status: 200 },
      );
    });
    const client = createWeatherClient({
      provider: 'open-meteo',
      baseUrl: 'https://api.open-meteo.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const hints = await client.hintsForDates('Kuala Lumpur', ['2026-09-21', '2026-09-22']);
    expect(hints.get('2026-09-21')?.source).toBe('open-meteo');
    expect(hints.get('2026-09-21')?.indoorSafe).toBe(true);
    expect(hints.get('2026-09-22')?.source).toBe('seed');
    expect(hints.get('2026-09-22')?.disclaimer).toBe(WEATHER_DISCLAIMER);
  });

  it('falls back to seed when Open-Meteo is unavailable', async () => {
    const client = createWeatherClient({
      provider: 'open-meteo',
      fetchImpl: async () => new Response('nope', { status: 503 }),
    });
    const hints = await client.hintsForDates('Kuala Lumpur', ['2026-12-01']);
    expect(hints.get('2026-12-01')).toMatchObject({
      source: 'seed',
      indoorSafe: true,
      disclaimer: WEATHER_DISCLAIMER,
    });
  });

  it('attaches hints onto itinerary days', async () => {
    const client = createWeatherClient({ provider: 'seed' });
    const result = await attachDayWeather(itineraryFor(['2026-12-01', '2026-08-02']), 'Kuala Lumpur', client);
    expect(result.days[0].weather?.indoorSafe).toBe(true);
    expect(result.days[1].weather?.condition).toBe('haze_season');
    expect(result.days.every((day) => day.weather?.disclaimer === WEATHER_DISCLAIMER)).toBe(true);
  });
});
