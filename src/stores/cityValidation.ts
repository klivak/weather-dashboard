import type { City } from '@/api/models'
import { isLocale } from '@/i18n/locale'
import { isRecord } from '@/utils/storage'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function localeMap(value: unknown): Partial<Record<'en' | 'uk', string>> | null {
  if (value === undefined) return {}
  if (!isRecord(value)) return null
  const out: Partial<Record<'en' | 'uk', string>> = {}
  for (const [key, text] of Object.entries(value)) {
    if (isLocale(key) && typeof text === 'string' && text) out[key] = text
  }
  return out
}

/** Rebuild a City from untrusted storage data; null when anything essential is missing or malformed. */
export function parseCity(value: unknown): City | null {
  if (!isRecord(value)) return null
  const { id, name, country, lat, lon, geonameId, state } = value
  if (typeof id !== 'string' || typeof name !== 'string' || !name || typeof country !== 'string') return null
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  const names = localeMap(value.names)
  const states = localeMap(value.states)
  if (!names || !states) return null

  const city: City = { id, name, names, country, lat, lon }
  if (isFiniteNumber(geonameId)) city.geonameId = geonameId
  if (typeof state === 'string' && state) city.state = state
  if (Object.keys(states).length) city.states = states
  return city
}
