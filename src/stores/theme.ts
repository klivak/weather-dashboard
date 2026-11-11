import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { isDaylight, isDaylightByClock, type SunTimes } from '@/domain/daylight'
import { useSettingsStore, type Theme } from './settings'

/**
 * The applied day/night look. In `auto` mode it follows the sun in the first home city (reported by that block once
 * its weather loads), falling back to the device clock; `tick` keeps it current as the sun sets or rises.
 */
export const useThemeStore = defineStore('theme', () => {
  const settings = useSettingsStore()
  const sun = shallowRef<SunTimes | null>(null)
  const now = ref(Date.now())

  const autoTheme = computed<Theme>(() => {
    const daylight = sun.value
      ? isDaylight(now.value / 1000, sun.value)
      : isDaylightByClock(new Date(now.value))
    return daylight ? 'day' : 'night'
  })

  const theme = computed<Theme>(() => (settings.themeMode === 'auto' ? autoTheme.value : settings.themeMode))

  function setSun(next: SunTimes | null) {
    sun.value = next
  }

  function tick(at = Date.now()) {
    now.value = at
  }

  return { sun, theme, autoTheme, setSun, tick }
})
