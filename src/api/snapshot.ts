import type { CurrentWeather, Forecast, Locale } from './models'
import { isRecord } from '@/utils/storage'

/**
 * Last weather shown for a city, kept in localStorage so a returning visitor sees it instantly while fresh data
 * loads in the background. Snapshots older than MAX_AGE_MS are ignored and pruned (no yesterday's weather).
 */
export interface WeatherSnapshot {
  savedAt: number
  current: CurrentWeather
  forecast: Forecast
}

const PREFIX = 'wd:wx:'
export const MAX_AGE_MS = 3 * 60 * 60 * 1000

function key(cityId: string, locale: Locale): string {
  return `${PREFIX}${cityId}|${locale}`
}

export function readSnapshot(cityId: string, locale: Locale, now = Date.now()): WeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(key(cityId, locale))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || typeof value.savedAt !== 'number' || now - value.savedAt > MAX_AGE_MS) return null
    if (!isRecord(value.current) || !isRecord(value.forecast) || !Array.isArray(value.forecast.points))
      return null
    return value as unknown as WeatherSnapshot
  } catch {
    return null
  }
}

/** Drop expired snapshots so storage never fills up with cities the user no longer shows. */
function prune(now: number) {
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const name = localStorage.key(index)
    if (!name?.startsWith(PREFIX)) continue
    try {
      const value: unknown = JSON.parse(localStorage.getItem(name) ?? 'null')
      if (!isRecord(value) || typeof value.savedAt !== 'number' || now - value.savedAt > MAX_AGE_MS) {
        localStorage.removeItem(name)
      }
    } catch {
      localStorage.removeItem(name)
    }
  }
}

export function writeSnapshot(
  cityId: string,
  locale: Locale,
  data: { current: CurrentWeather; forecast: Forecast },
  now = Date.now(),
): void {
  try {
    prune(now)
    localStorage.setItem(key(cityId, locale), JSON.stringify({ savedAt: now, ...data }))
  } catch {
    // Storage full or unavailable: the snapshot is only a speed-up.
  }
}
