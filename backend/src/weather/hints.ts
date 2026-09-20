import { WEATHER_DISCLAIMER, type DailyForecast, type DayWeatherHint } from './types.js';

export function monthFromIsoDate(date: string): number {
  return Number(date.slice(5, 7));
}

export function seedHintForDate(date: string): DayWeatherHint {
  const month = monthFromIsoDate(date);
  if (month >= 11 || month <= 3) {
    return {
      source: 'seed',
      condition: 'rain',
      summary: 'Typical west-coast wet-season pattern',
      hint: 'Short heavy showers are common, often later in the day. Pack a compact umbrella and keep a mall or covered walkway as backup. This is a climate pattern, not a live forecast.',
      indoorSafe: true,
      disclaimer: WEATHER_DISCLAIMER,
    };
  }
  if (month >= 6 && month <= 10) {
    return {
      source: 'seed',
      condition: 'haze_season',
      summary: 'Hot, humid, and sometimes hazy in drier months',
      hint: 'Expect roughly 26–33°C and high humidity. If skies look milky, prefer shorter outdoor walks and indoor malls. This seed cannot report live air quality.',
      indoorSafe: false,
      disclaimer: WEATHER_DISCLAIMER,
    };
  }
  return {
    source: 'seed',
    condition: 'typical',
    summary: 'Equatorial heat and humidity',
    hint: 'Plan outdoor sights early, drink water, and use air-conditioned malls for midday breaks. Afternoon rain can still appear without warning.',
    indoorSafe: false,
    disclaimer: WEATHER_DISCLAIMER,
  };
}

export function hintFromForecast(daily: DailyForecast): DayWeatherHint {
  const code = daily.weatherCode;
  const storm = code >= 95 && code <= 99;
  const rain =
    storm ||
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (daily.precipitationProbabilityMax != null && daily.precipitationProbabilityMax >= 50) ||
    (daily.precipitationSumMm != null && daily.precipitationSumMm >= 4);
  const heat = daily.temperatureMaxC >= 33;
  const range = `${Math.round(daily.temperatureMinC)}–${Math.round(daily.temperatureMaxC)}°C`;

  if (storm) {
    return {
      source: 'open-meteo',
      condition: 'storm',
      summary: `Thunderstorms possible · about ${Math.round(daily.temperatureMaxC)}°C`,
      hint: 'Keep a covered backup (Suria KLCC, Pavilion, or a hotel lobby). Outdoor viewpoints may be delayed. Treat this as a planning hint, not a guarantee.',
      indoorSafe: true,
      disclaimer: WEATHER_DISCLAIMER,
    };
  }
  if (rain) {
    return {
      source: 'open-meteo',
      condition: 'rain',
      summary: `Rain likely · ${range}`,
      hint: 'A compact umbrella and indoor mall connectors help. Klang Valley showers are often brief — sequence outdoor stops around cover rather than cancelling the day.',
      indoorSafe: true,
      disclaimer: WEATHER_DISCLAIMER,
    };
  }
  if (heat) {
    return {
      source: 'open-meteo',
      condition: 'heat',
      summary: `Hot and humid · highs around ${Math.round(daily.temperatureMaxC)}°C`,
      hint: 'Start outdoor sights before late morning, carry water, and use malls or rail stations for midday shade. This is not medical advice.',
      indoorSafe: false,
      disclaimer: WEATHER_DISCLAIMER,
    };
  }
  return {
    source: 'open-meteo',
    condition: 'typical',
    summary: `Warm · ${range}`,
    hint: 'Typical Klang Valley weather: humid with a chance of a short burst of rain. Pack light layers and an umbrella just in case.',
    indoorSafe: false,
    disclaimer: WEATHER_DISCLAIMER,
  };
}
