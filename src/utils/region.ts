import type { City, Locale } from '@/api/models'

const displayNames = new Map<Locale, Intl.DisplayNames>()

/** Localised country name for an ISO 3166 code; the code itself when the browser can't name it. */
export function countryName(code: string, locale: Locale): string {
  let names = displayNames.get(locale)
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: 'region' })
    displayNames.set(locale, names)
  }
  try {
    return names.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** "Lviv Oblast, Ukraine" style line to tell same-name cities apart. */
export function cityRegion(city: City, locale: Locale): string {
  return [city.states?.[locale] ?? city.state, countryName(city.country, locale)].filter(Boolean).join(', ')
}
