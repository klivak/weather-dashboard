import type { City } from '@/api/models'
import { cityId } from '@/api/models'

function city(name: string, uk: string, country: string, lat: number, lon: number, geonameId: number): City {
  return { id: cityId({ lat, lon }), geonameId, name, names: { en: name, uk }, country, lat, lon }
}

/** One-click picks for an empty block; the ids match what the search would produce for the same places. */
export const POPULAR_CITIES: readonly City[] = [
  city('Kyiv', 'Київ', 'UA', 50.4501, 30.5234, 703448),
  city('Lviv', 'Львів', 'UA', 49.8383, 24.0232, 702550),
  city('Odesa', 'Одеса', 'UA', 46.4775, 30.7326, 698740),
  city('Kharkiv', 'Харків', 'UA', 49.9808, 36.2527, 706483),
  city('Dnipro', 'Дніпро', 'UA', 48.4593, 35.0387, 709930),
  city('Warsaw', 'Варшава', 'PL', 52.2298, 21.0118, 756135),
  city('London', 'Лондон', 'GB', 51.5085, -0.1257, 2643743),
  city('New York', 'Нью-Йорк', 'US', 40.7143, -74.006, 5128581),
]

/** Popular cities not already shown, at most `limit` of them. */
export function suggestCities(shownIds: Iterable<string>, limit = 6): City[] {
  const shown = new Set(shownIds)
  return POPULAR_CITIES.filter((item) => !shown.has(item.id)).slice(0, limit)
}
