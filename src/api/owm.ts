import { createCachedJson } from './cache'
import { ApiError } from './http'
import type { City, Condition, Coords, CurrentWeather, Forecast, ForecastPoint, Locale } from './models'
import { cityId } from './models'
import type { OwmCondition, OwmCurrent, OwmForecast, OwmGeoItem } from './types'

/** Same-origin proxy that adds the API key (Vite proxy in dev, Pages Function in prod). */
export const OWM_BASE = '/api/owm'

const WEATHER_TTL_MS = 10 * 60 * 1000
const GEO_TTL_MS = 24 * 60 * 60 * 1000

const cachedJson = createCachedJson(WEATHER_TTL_MS)

export function clearOwmCache(): void {
  cachedJson.clear()
}

function url(path: string, params: Record<string, string | number>): string {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  return `${OWM_BASE}${path}?${query.toString()}`
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

const FALLBACK_CONDITION: Condition = { id: 800, main: 'Clear', description: '', icon: '01d' }

function toCondition(list: OwmCondition[]): Condition {
  const first = list[0]
  return first
    ? { id: first.id, main: first.main, description: first.description, icon: first.icon }
    : FALLBACK_CONDITION
}

export function toCity(item: OwmGeoItem): City {
  const names: City['names'] = {}
  const en = item.local_names?.en
  const uk = item.local_names?.uk
  if (en) names.en = en
  if (uk) names.uk = uk
  const city: City = {
    id: cityId(item),
    name: item.name,
    names,
    country: item.country,
    lat: round(item.lat),
    lon: round(item.lon),
  }
  if (item.state) city.state = item.state
  return city
}

export function toCurrent(raw: OwmCurrent): CurrentWeather {
  return {
    dt: raw.dt,
    timezone: raw.timezone,
    sunrise: raw.sys.sunrise,
    sunset: raw.sys.sunset,
    temp: raw.main.temp,
    feelsLike: raw.main.feels_like,
    tempMin: raw.main.temp_min,
    tempMax: raw.main.temp_max,
    humidity: raw.main.humidity,
    pressure: raw.main.pressure,
    windSpeed: raw.wind.speed,
    windDeg: raw.wind.deg,
    clouds: raw.clouds.all,
    visibility: raw.visibility ?? null,
    condition: toCondition(raw.weather),
  }
}

export function toForecast(raw: OwmForecast): Forecast {
  const points: ForecastPoint[] = raw.list.map((item) => ({
    dt: item.dt,
    temp: item.main.temp,
    feelsLike: item.main.feels_like,
    tempMin: item.main.temp_min,
    tempMax: item.main.temp_max,
    humidity: item.main.humidity,
    windSpeed: item.wind.speed,
    pop: item.pop ?? 0,
    isDay: item.sys.pod === 'd',
    condition: toCondition(item.weather),
  }))
  return { timezone: raw.city.timezone, sunrise: raw.city.sunrise, sunset: raw.city.sunset, points }
}

/** Cities whose name matches the query exactly (OpenWeatherMap does not match prefixes), deduplicated by rounded coordinates. */
export async function findCitiesByName(query: string, signal?: AbortSignal): Promise<City[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const raw = await cachedJson<OwmGeoItem[]>(url('/geo/1.0/direct', { q, limit: 5 }), {
    signal,
    ttlMs: GEO_TTL_MS,
  })
  const seen = new Set<string>()
  return raw.map(toCity).filter((city) => {
    if (seen.has(city.id)) return false
    seen.add(city.id)
    return true
  })
}

export async function reverseGeocode(coords: Coords, signal?: AbortSignal): Promise<City> {
  const raw = await cachedJson<OwmGeoItem[]>(
    url('/geo/1.0/reverse', { lat: round(coords.lat), lon: round(coords.lon), limit: 1 }),
    { signal, ttlMs: GEO_TTL_MS },
  )
  const first = raw[0]
  if (!first) throw new ApiError('not-found', 'No place at these coordinates')
  return toCity(first)
}

export async function getCurrentWeather(
  coords: Coords,
  lang: Locale,
  signal?: AbortSignal,
): Promise<CurrentWeather> {
  const raw = await cachedJson<OwmCurrent>(
    url('/data/2.5/weather', { lat: coords.lat, lon: coords.lon, units: 'metric', lang }),
    { signal },
  )
  return toCurrent(raw)
}

export async function getForecast(coords: Coords, lang: Locale, signal?: AbortSignal): Promise<Forecast> {
  const raw = await cachedJson<OwmForecast>(
    url('/data/2.5/forecast', { lat: coords.lat, lon: coords.lon, units: 'metric', lang }),
    { signal },
  )
  return toForecast(raw)
}
