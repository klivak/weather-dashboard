import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Locale } from '@/api/models'
import { isUnits, type Units } from '@/domain/units'
import { detectLocale, isLocale } from '@/i18n/locale'
import { isRecord, readStorage, writeStorage } from '@/utils/storage'

/** The look actually applied to the page. */
export type Theme = 'day' | 'night'
/** The user's choice: a fixed look, or `auto` to follow the sun in the first city. */
export type ThemeMode = Theme | 'auto'

export const SETTINGS_KEY = 'wd:settings'

interface SavedSettings {
  v: 1
  locale: Locale
  theme: ThemeMode
  units?: Units
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'day' || value === 'night' || value === 'auto'
}

function parseSettings(value: unknown): Partial<SavedSettings> | null {
  if (!isRecord(value) || value.v !== 1) return null
  const parsed: Partial<SavedSettings> = {}
  if (isLocale(value.locale)) parsed.locale = value.locale
  if (isThemeMode(value.theme)) parsed.theme = value.theme
  if (isUnits(value.units)) parsed.units = value.units
  return parsed
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = readStorage(SETTINGS_KEY, parseSettings)

  const locale = ref<Locale>(saved?.locale ?? detectLocale())
  const themeMode = ref<ThemeMode>(saved?.theme ?? 'auto')
  const units = ref<Units>(saved?.units ?? 'metric')

  function setLocale(next: Locale) {
    locale.value = next
  }

  function setThemeMode(next: ThemeMode) {
    themeMode.value = next
  }

  function setUnits(next: Units) {
    units.value = next
  }

  watch([locale, themeMode, units], () => {
    writeStorage(SETTINGS_KEY, {
      v: 1,
      locale: locale.value,
      theme: themeMode.value,
      units: units.value,
    } satisfies SavedSettings)
  })

  return { locale, themeMode, units, setLocale, setThemeMode, setUnits }
})
