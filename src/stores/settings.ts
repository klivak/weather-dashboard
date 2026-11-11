import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Locale } from '@/api/models'
import { detectLocale, isLocale } from '@/i18n/locale'
import { isRecord, readStorage, writeStorage } from '@/utils/storage'

export type Theme = 'day' | 'night'

export const SETTINGS_KEY = 'wd:settings'

interface SavedSettings {
  v: 1
  locale: Locale
  theme: Theme
}

function isTheme(value: unknown): value is Theme {
  return value === 'day' || value === 'night'
}

function parseSettings(value: unknown): Partial<SavedSettings> | null {
  if (!isRecord(value) || value.v !== 1) return null
  const parsed: Partial<SavedSettings> = {}
  if (isLocale(value.locale)) parsed.locale = value.locale
  if (isTheme(value.theme)) parsed.theme = value.theme
  return parsed
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = readStorage(SETTINGS_KEY, parseSettings)

  const locale = ref<Locale>(saved?.locale ?? detectLocale())
  const theme = ref<Theme>(saved?.theme ?? 'day')

  function setLocale(next: Locale) {
    locale.value = next
  }

  function setTheme(next: Theme) {
    theme.value = next
  }

  watch([locale, theme], () => {
    writeStorage(SETTINGS_KEY, { v: 1, locale: locale.value, theme: theme.value } satisfies SavedSettings)
  })

  return { locale, theme, setLocale, setTheme }
})
