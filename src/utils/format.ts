import type { Locale } from '@/api/models'

const INTL_LOCALE: Record<Locale, string> = { en: 'en-GB', uk: 'uk-UA' }

/** Rounded temperature with a real minus sign, e.g. "−3°". */
export function formatTemp(celsius: number): string {
  const rounded = Math.round(celsius)
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded)}°`
}

/** Date for a unix time shown in the city's timezone (offset in seconds); formatting runs in UTC on the shifted time. */
function shifted(dt: number, timezone: number): Date {
  return new Date((dt + timezone) * 1000)
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let cached = formatters.get(key)
  if (!cached) {
    cached = new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: 'UTC' })
    formatters.set(key, cached)
  }
  return cached
}

/** "14:00" in the city's local time. */
export function formatTime(dt: number, timezone: number, locale: Locale): string {
  return formatter(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    shifted(dt, timezone),
  )
}

/** "Tue 11 Nov" / "вт, 11 лист." in the city local time. */
export function formatDayDate(dt: number, timezone: number, locale: Locale): string {
  return formatter(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(shifted(dt, timezone))
}

/** "Tuesday" / "вівторок". */
export function formatWeekday(dt: number, timezone: number, locale: Locale): string {
  return formatter(locale, { weekday: 'long' }).format(shifted(dt, timezone))
}

const numberFormats = new Map<string, Intl.NumberFormat>()

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 0): string {
  const key = `${locale}|${maximumFractionDigits}`
  let cached = numberFormats.get(key)
  if (!cached) {
    cached = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits })
    numberFormats.set(key, cached)
  }
  return cached.format(value)
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type CompassPoint = (typeof COMPASS)[number]

/** Nearest of 8 compass points for a meteorological wind direction (where the wind comes from). */
export function compassPoint(degrees: number): CompassPoint {
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8
  return COMPASS[index] ?? 'N'
}
