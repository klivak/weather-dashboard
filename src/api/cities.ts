import { completeCityNames, searchPlaces } from './geocoding'
import { isAbortError } from './http'
import type { City, Locale } from './models'
import { findCitiesByName } from './owm'

export { completeCityNames }

/**
 * Autocomplete suggestions: Open-Meteo prefix search first; OpenWeatherMap's exact-name geocoder when Open-Meteo is
 * unreachable or finds nothing. Aborts propagate; an OpenWeatherMap failure after an Open-Meteo failure surfaces as
 * the error.
 */
export async function searchCities(query: string, locale: Locale, signal?: AbortSignal): Promise<City[]> {
  const q = query.trim()
  if (q.length < 2) return []
  try {
    const found = await searchPlaces(q, locale, signal)
    if (found.length) return found
  } catch (error) {
    if (isAbortError(error)) throw error
  }
  return findCitiesByName(q, signal)
}
