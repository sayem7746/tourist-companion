export const WEATHER_DISCLAIMER =
  'Planning hint only — not a forecast guarantee. Conditions can change.';

export const WEATHER_SOURCES = ['open-meteo', 'seed'] as const;
export type WeatherSource = (typeof WEATHER_SOURCES)[number];

export const WEATHER_CONDITIONS = ['storm', 'rain', 'heat', 'haze_season', 'typical'] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export interface DayWeatherHint {
  source: WeatherSource;
  condition: WeatherCondition;
  summary: string;
  hint: string;
  indoorSafe: boolean;
  disclaimer: string;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  temperatureMaxC: number;
  temperatureMinC: number;
  precipitationProbabilityMax: number | null;
  precipitationSumMm: number | null;
}

export interface WeatherClient {
  hintsForDates(destination: string, dates: string[]): Promise<Map<string, DayWeatherHint>>;
}
