import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ApiErrorKind } from '@/api/http'
import { ApiError, isAbortError } from '@/api/http'
import type { City, CurrentWeather, Forecast, Locale } from '@/api/models'
import { getCurrentWeather, getForecast } from '@/api/owm'

export type WeatherStatus = 'idle' | 'loading' | 'success' | 'error'

/** Data older than this is refreshed in the background (matches the request cache lifetime). */
export const REFRESH_AFTER_MS = 10 * 60 * 1000
const CHECK_EVERY_MS = 60 * 1000

/**
 * Current weather and the 5-day forecast for a city, refetched when the city or language changes.
 * A new city clears the old data (the UI shows a skeleton); a language change keeps it on screen until the
 * translated descriptions arrive. Only the latest request can update the state.
 *
 * While the page stays open the data is refreshed quietly once it is 10 minutes old (only when the tab is visible,
 * and right away when the user comes back to it), and a failed load is retried when the connection returns.
 */
export function useWeather(city: () => City | null | undefined, locale: () => Locale) {
  const current = shallowRef<CurrentWeather | null>(null)
  const forecast = shallowRef<Forecast | null>(null)
  const status = ref<WeatherStatus>('idle')
  const errorKind = ref<ApiErrorKind | null>(null)

  let controller: AbortController | undefined
  let loadedCityId: string | null = null
  let loadedAt = 0

  /** `quiet` refreshes keep the current data and state on screen and ignore failures. */
  async function load(quiet = false) {
    controller?.abort()
    const target = city()
    if (!target) {
      current.value = null
      forecast.value = null
      status.value = 'idle'
      loadedCityId = null
      return
    }

    const own = new AbortController()
    controller = own
    if (!quiet) {
      if (loadedCityId !== target.id) {
        current.value = null
        forecast.value = null
      }
      status.value = 'loading'
      errorKind.value = null
    }

    try {
      const [now, next] = await Promise.all([
        getCurrentWeather(target, locale(), own.signal),
        getForecast(target, locale(), own.signal),
      ])
      if (controller !== own) return
      current.value = now
      forecast.value = next
      loadedCityId = target.id
      loadedAt = Date.now()
      status.value = 'success'
      errorKind.value = null
    } catch (error) {
      if (isAbortError(error) || controller !== own || quiet) return
      errorKind.value = error instanceof ApiError ? error.kind : 'network'
      status.value = 'error'
    }
  }

  function refreshIfStale() {
    if (document.visibilityState !== 'visible' || status.value !== 'success') return
    if (Date.now() - loadedAt >= REFRESH_AFTER_MS) void load(true)
  }

  function onOnline() {
    if (status.value === 'error') void load()
  }

  watch([() => city()?.id, locale], () => void load(), { immediate: true })

  const timer = setInterval(refreshIfStale, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', refreshIfStale)
  window.addEventListener('online', onOnline)

  onScopeDispose(() => {
    controller?.abort()
    clearInterval(timer)
    document.removeEventListener('visibilitychange', refreshIfStale)
    window.removeEventListener('online', onOnline)
  })

  return { current, forecast, status, errorKind, reload: () => load() }
}
