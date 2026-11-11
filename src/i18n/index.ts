import { computed } from 'vue'
import type { Locale } from '@/api/models'
import { useSettingsStore } from '@/stores/settings'
import { en } from './en'
import type { MessageKey, MessageParams, Messages } from './types'
import { uk } from './uk'

export type { MessageKey, MessageParams, Messages } from './types'
export { detectLocale, isLocale, LOCALES } from './locale'

export const messages: Record<Locale, Messages> = { en, uk }

function lookup(dict: Messages, key: MessageKey): string | undefined {
  let node: unknown = dict
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

/** Translate a key for a locale, filling {placeholders}; falls back to English, then to the key itself. */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = lookup(messages[locale], key) ?? lookup(messages.en, key) ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export function useI18n() {
  const settings = useSettingsStore()
  const locale = computed(() => settings.locale)
  const t = (key: MessageKey, params?: MessageParams): string => translate(settings.locale, key, params)
  return { locale, t, setLocale: settings.setLocale }
}
