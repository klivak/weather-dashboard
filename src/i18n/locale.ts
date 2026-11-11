import type { Locale } from '@/api/models'

export const LOCALES: readonly Locale[] = ['en', 'uk']

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** Ukrainian for browsers that prefer Ukrainian (or Russian, common in Ukraine), English otherwise. */
export function detectLocale(
  languages: readonly string[] = navigator.languages ?? [navigator.language],
): Locale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0]
    if (base === 'uk' || base === 'ru') return 'uk'
    if (base === 'en') return 'en'
  }
  return 'en'
}
