import type { AppConfig } from '../config.js';
import { coordinatesForDestination } from './geo.js';
import { hintFromForecast, seedHintForDate } from './hints.js';
import type { DailyForecast, DayWeatherHint, WeatherClient } from './types.js';

export function resolveWeatherProviderKind(config: AppConfig): 'open-meteo' | 'seed' {
  if (config.WEATHER_PROVIDER === 'seed') return 'seed';
  if (config.WEATHER_PROVIDER === 'open-meteo') return 'open-meteo';
  return config.NODE_ENV === 'test' ? 'seed' : 'open-meteo';
}

interface OpenMeteoDaily {
  time?: string[];
  weather_code?: number[];
  weathercode?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
}

interface OpenMeteoResponse {
  daily?: OpenMeteoDaily;
}

export interface WeatherClientOptions {
  provider: 'open-meteo' | 'seed';
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function uniqueSortedDates(dates: string[]): string[] {
  return [...new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

function parseDaily(payload: OpenMeteoResponse): DailyForecast[] {
  const daily = payload.daily;
  if (!daily?.time?.length) return [];
  const codes = daily.weather_code ?? daily.weathercode ?? [];
  const max = daily.temperature_2m_max ?? [];
  const min = daily.temperature_2m_min ?? [];
  const pop = daily.precipitation_probability_max ?? [];
  const precip = daily.precipitation_sum ?? [];
  const rows: DailyForecast[] = [];
  for (let index = 0; index < daily.time.length; index += 1) {
    const date = daily.time[index];
    const weatherCode = codes[index];
    const temperatureMaxC = max[index];
    const temperatureMinC = min[index];
    if (
      !date ||
      typeof weatherCode !== 'number' ||
      typeof temperatureMaxC !== 'number' ||
      typeof temperatureMinC !== 'number'
    ) {
      continue;
    }
    rows.push({
      date,
      weatherCode,
      temperatureMaxC,
      temperatureMinC,
      precipitationProbabilityMax: typeof pop[index] === 'number' ? pop[index] : null,
      precipitationSumMm: typeof precip[index] === 'number' ? precip[index] : null,
    });
  }
  return rows;
}

export function createWeatherClient(options: WeatherClientOptions): WeatherClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 2_500;
  const baseUrl = (options.baseUrl ?? 'https://api.open-meteo.com').replace(/\/$/, '');

  const seedMap = (dates: string[]): Map<string, DayWeatherHint> => {
    const hints = new Map<string, DayWeatherHint>();
    for (const date of dates) {
      hints.set(date, seedHintForDate(date));
    }
    return hints;
  };

  return {
    async hintsForDates(destination, dates) {
      const wanted = uniqueSortedDates(dates);
      if (wanted.length === 0) return new Map();
      if (options.provider !== 'open-meteo') {
        return seedMap(wanted);
      }

      const point = coordinatesForDestination(destination);
      const url = new URL('/v1/forecast', `${baseUrl}/`);
      url.searchParams.set('latitude', String(point.latitude));
      url.searchParams.set('longitude', String(point.longitude));
      url.searchParams.set(
        'daily',
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
      );
      url.searchParams.set('timezone', 'Asia/Kuala_Lumpur');
      url.searchParams.set('start_date', wanted[0]);
      url.searchParams.set('end_date', wanted[wanted.length - 1]);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) {
          return seedMap(wanted);
        }
        const payload = (await response.json()) as OpenMeteoResponse;
        const live = new Map(parseDaily(payload).map((row) => [row.date, hintFromForecast(row)]));
        const hints = new Map<string, DayWeatherHint>();
        for (const date of wanted) {
          hints.set(date, live.get(date) ?? seedHintForDate(date));
        }
        return hints;
      } catch {
        return seedMap(wanted);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function createWeatherClientFromConfig(
  config: AppConfig,
  deps: { fetchImpl?: typeof fetch } = {},
): WeatherClient {
  return createWeatherClient({
    provider: resolveWeatherProviderKind(config),
    baseUrl: config.OPEN_METEO_BASE_URL,
    timeoutMs: config.WEATHER_TIMEOUT_MS,
    fetchImpl: deps.fetchImpl,
  });
}
