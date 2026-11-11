import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { SETTINGS_KEY, useSettingsStore } from './settings'
import { useThemeStore } from './theme'

const TZ = 7200
const MIDNIGHT_MS = Date.UTC(2026, 10, 11) - TZ * 1000
const at = (hours: number) => MIDNIGHT_MS + hours * 3_600_000
const kyivSun = { sunrise: at(7) / 1000, sunset: at(16.5) / 1000, timezone: TZ }

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('theme store', () => {
  it('defaults to auto and follows the sun in the first city', () => {
    const theme = useThemeStore()
    expect(useSettingsStore().themeMode).toBe('auto')
    theme.setSun(kyivSun)
    theme.tick(at(12))
    expect(theme.theme).toBe('day')
    theme.tick(at(17))
    expect(theme.theme).toBe('night')
  })

  it('uses the device clock until a city reports its sun times', () => {
    const theme = useThemeStore()
    theme.tick(new Date(2026, 10, 11, 23, 0).getTime())
    expect(theme.theme).toBe('night')
    theme.tick(new Date(2026, 10, 11, 10, 0).getTime())
    expect(theme.theme).toBe('day')
  })

  it('lets a fixed choice override the sun and persists it', async () => {
    const settings = useSettingsStore()
    const theme = useThemeStore()
    theme.setSun(kyivSun)
    theme.tick(at(12))
    settings.setThemeMode('night')
    expect(theme.theme).toBe('night')
    await nextTick()
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).theme).toBe('night')

    settings.setThemeMode('auto')
    expect(theme.theme).toBe('day')
  })

  it('keeps settings saved before auto mode existed', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ v: 1, locale: 'uk', theme: 'day' }))
    expect(useSettingsStore().themeMode).toBe('day')
  })
})
