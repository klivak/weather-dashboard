import type { Condition, CurrentWeather, Forecast, ForecastPoint, Locale } from './models'
import { isRecord } from '@/utils/storage'

/**
 * Last weather shown for a city, kept in localStorage so a returning visitor sees it instantly while fresh data
 * loads in the background. Snapshots are versioned and fully validated (an older build's shape is ignored, not
 * rendered), and anything older than MAX_AGE_MS is ignored and pruned (no yesterday's weather).
 */
export interface WeatherSnapshot {
  savedAt: number
  current: CurrentWeather
  forecast: Forecast
}

/** Bump when CurrentWeather or Forecast change shape. */
const VERSION = 1
const PREFIX = 'wd:wx:'
export const MAX_AGE_MS = 3 * 60 * 60 * 1000

function key(cityId: string, locale: Locale): string {
  return `${PREFIX}v${VERSION}:${cityId}|${locale}`
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function hasNumbers(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => isNumber(value[field]))
}

function isCondition(value: unknown): value is Condition {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    typeof value.main === 'string' &&
    typeof value.description === 'string' &&
    typeof value.icon === 'string'
  )
}

const CURRENT_NUMBERS = [
  'dt',
  'timezone',
  'sunrise',
  'sunset',
  'temp',
  'feelsLike',
  'tempMin',
  'tempMax',
  'humidity',
  'pressure',
  'windSpeed',
  'windDeg',
  'clouds',
] as const

const POINT_NUMBERS = [
  'dt',
  'temp',
  'feelsLike',
  'tempMin',
  'tempMax',
  'humidity',
  'windSpeed',
  'pop',
] as const

function isCurrent(value: unknown): value is CurrentWeather {
  return (
    isRecord(value) &&
    hasNumbers(value, CURRENT_NUMBERS) &&
    (value.visibility === null || isNumber(value.visibility)) &&
    isCondition(value.condition)
  )
}

function isPoint(value: unknown): value is ForecastPoint {
  return (
    isRecord(value) &&
    hasNumbers(value, POINT_NUMBERS) &&
    typeof value.isDay === 'boolean' &&
    isCondition(value.condition)
  )
}

function isForecast(value: unknown): value is Forecast {
  return (
    isRecord(value) &&
    hasNumbers(value, ['timezone', 'sunrise', 'sunset']) &&
    Array.isArray(value.points) &&
    value.points.length > 0 &&
    value.points.every(isPoint)
  )
}

function isFresh(value: unknown, now: number): value is { savedAt: number } {
  return isRecord(value) && isNumber(value.savedAt) && now - value.savedAt <= MAX_AGE_MS
}

export function readSnapshot(cityId: string, locale: Locale, now = Date.now()): WeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(key(cityId, locale))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || !isFresh(value, now)) return null
    const { current, forecast } = value as Record<string, unknown>
    return isCurrent(current) && isForecast(forecast) ? { savedAt: value.savedAt, current, forecast } : null
  } catch {
    return null
  }
}

/** Drop expired or outdated snapshots (other versions included) so storage never fills up. */
function prune(now: number) {
  const current = `${PREFIX}v${VERSION}:`
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const name = localStorage.key(index)
    if (!name?.startsWith(PREFIX)) continue
    if (!name.startsWith(current)) {
      localStorage.removeItem(name)
      continue
    }
    try {
      if (!isFresh(JSON.parse(localStorage.getItem(name) ?? 'null'), now)) localStorage.removeItem(name)
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
