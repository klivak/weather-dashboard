import { createCachedJson } from './cache'
import type { City, Locale } from './models'
import { cityId } from './models'
import type { OmPlace, OmSearchResponse } from './types'

/**
 * Open-Meteo geocoding (free, no key, CORS-enabled). Unlike OpenWeatherMap's geocoder it matches name prefixes
 * ("Lond" → London, "Хар" → Харків), so it powers the autocomplete; weather itself still comes from OpenWeatherMap.
 */
export const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1'

const TTL_MS = 24 * 60 * 60 * 1000
const MAX_RESULTS = 5
const CYRILLIC = /[Ѐ-ӿ]/
/** GeoNames populated-place codes that are not a city to show weather for (districts, historical, abandoned, destroyed). */
const EXCLUDED_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH'])

const cachedJson = createCachedJson(TTL_MS)

export function clearGeocodingCache(): void {
  cachedJson.clear()
}

function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'uk' : 'en'
}

export function isCity(place: OmPlace): boolean {
  if (!place.country_code) return false
  const code = place.feature_code
  return !code || (code.startsWith('PPL') && !EXCLUDED_CODES.has(code))
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

export function placeToCity(place: OmPlace, locale: Locale, other?: OmPlace): City {
  const second = otherLocale(locale)
  const city: City = {
    id: cityId({ lat: place.latitude, lon: place.longitude }),
    geonameId: place.id,
    name: place.name,
    names: { [locale]: place.name },
    country: place.country_code ?? '',
    lat: round(place.latitude),
    lon: round(place.longitude),
  }
  if (other) city.names[second] = other.name
  if (place.admin1) {
    city.state = place.admin1
    city.states = { [locale]: place.admin1 }
    if (other?.admin1) city.states[second] = other.admin1
  }
  return city
}

async function search(name: string, language: Locale, signal?: AbortSignal): Promise<OmPlace[]> {
  const params = new URLSearchParams({ name, count: '10', language, format: 'json' })
  const body = await cachedJson<OmSearchResponse>(`${GEOCODING_BASE}/search?${params.toString()}`, { signal })
  return body.results ?? []
}

/**
 * Cities whose name starts with the query, ranked by Open-Meteo (population first). The query is matched in the
 * script it is typed in (Cyrillic → Ukrainian names), and the same places are looked up in the other language so
 * each city carries both names.
 */
export async function searchPlaces(query: string, locale: Locale, signal?: AbortSignal): Promise<City[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const primary: Locale = CYRILLIC.test(q) ? 'uk' : locale
  const [main, other] = await Promise.all([
    search(q, primary, signal),
    search(q, otherLocale(primary), signal).catch(() => [] as OmPlace[]),
  ])
  const otherById = new Map(other.map((place) => [place.id, place]))
  const seen = new Set<string>()
  const cities: City[] = []
  for (const place of main) {
    if (!isCity(place)) continue
    const city = placeToCity(place, primary, otherById.get(place.id))
    // Same coordinates, or same name in the same region: the user could not tell them apart, keep the higher-ranked one.
    const label = `${place.name}|${place.admin1 ?? ''}|${city.country}`
    if (seen.has(city.id) || seen.has(label)) continue
    seen.add(city.id)
    seen.add(label)
    cities.push(city)
    if (cities.length === MAX_RESULTS) break
  }
  return cities
}

/** Fill in a city's name for any locale it lacks (one cached request per missing locale). Never throws. */
export async function completeCityNames(city: City, signal?: AbortSignal): Promise<City> {
  if (!city.geonameId) return city
  const missing = (['en', 'uk'] as const).filter((locale) => !city.names[locale])
  if (!missing.length) return city
  const updated: City = { ...city, names: { ...city.names }, states: { ...city.states } }
  await Promise.all(
    missing.map(async (locale) => {
      try {
        const params = new URLSearchParams({ id: String(city.geonameId), language: locale })
        const place = await cachedJson<OmPlace>(`${GEOCODING_BASE}/get?${params.toString()}`, { signal })
        if (place.name) updated.names[locale] = place.name
        if (place.admin1 && updated.states) updated.states[locale] = place.admin1
      } catch {
        // Keep the city as it is; the default name is a fine fallback.
      }
    }),
  )
  return updated
}
