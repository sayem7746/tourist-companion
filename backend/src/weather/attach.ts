import type { Itinerary } from '../itinerary/types.js';
import { seedHintForDate } from './hints.js';
import type { WeatherClient } from './types.js';

export async function attachDayWeather(
  itinerary: Itinerary,
  destination: string,
  client: WeatherClient,
): Promise<Itinerary> {
  const dates = itinerary.days.map((day) => day.date);
  const hints = await client.hintsForDates(destination, dates);
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      weather: hints.get(day.date) ?? seedHintForDate(day.date),
    })),
  };
}
