import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ApiErrorKind } from '@/api/http'
import { ApiError, isAbortError } from '@/api/http'
import type { City, CurrentWeather, Forecast, Locale } from '@/api/models'
import { getCurrentWeather, getForecast } from '@/api/owm'
import { readSnapshot, writeSnapshot } from '@/api/snapshot'

export type WeatherStatus = 'idle' | 'loading' | 'success' | 'error'

/** Data older than this is refreshed in the background (matches the request cache lifetime). */
export const REFRESH_AFTER_MS = 10 * 60 * 1000
const CHECK_EVERY_MS = 60 * 1000

/**
 * Current weather and the 5-day forecast for a city, refetched when the city or language changes.
 * A new city clears the old data (the UI shows a skeleton); a language change keeps it on screen until the
 * translated descriptions arrive. Only the latest request can update the state.
 *
 * A snapshot of the last data for the same city and language (up to 3 hours old) is shown instantly and refreshed
 * in the background, so returning visitors do not wait for the network.
 *
 * While the page stays open the data is refreshed quietly once it is 10 minutes old (only when the tab is visible,
 * and right away when the user comes back to it), and a failed load is retried when the connection returns.
 */
export function useWeather(city: () => City | null | undefined, locale: () => Locale) {
  const current = shallowRef<CurrentWeather | null>(null)
  const forecast = shallowRef<Forecast | null>(null)
  const status = ref<WeatherStatus>('idle')
  const errorKind = ref<ApiErrorKind | null>(null)
  /** When the shown data was fetched (ms), for "updated 5 min ago". */
  const updatedAt = ref<number | null>(null)
  /** A user-requested refresh is running. */
  const refreshing = ref(false)

  let controller: AbortController | undefined
  let loadedCityId: string | null = null
  let loadedAt = 0

  /** `quiet` refreshes keep the current data and state on screen and ignore failures. */
  /** Returns whether fresh data arrived. */
  async function load(quiet = false, fresh = false): Promise<boolean> {
    controller?.abort()
    const target = city()
    if (!target) {
      current.value = null
      forecast.value = null
      status.value = 'idle'
      loadedCityId = null
      return false
    }

    const own = new AbortController()
    controller = own

    // Show the last known data at once and turn this into a background refresh.
    if (!quiet && !fresh) {
      const snapshot = readSnapshot(target.id, locale())
      if (snapshot) {
        current.value = snapshot.current
        forecast.value = snapshot.forecast
        loadedCityId = target.id
        loadedAt = snapshot.savedAt
        updatedAt.value = snapshot.savedAt
        status.value = 'success'
        errorKind.value = null
        quiet = true
      }
    }

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
        getCurrentWeather(target, locale(), own.signal, fresh),
        getForecast(target, locale(), own.signal, fresh),
      ])
      if (controller !== own) return false
      current.value = now
      forecast.value = next
      loadedCityId = target.id
      loadedAt = Date.now()
      updatedAt.value = loadedAt
      status.value = 'success'
      errorKind.value = null
      writeSnapshot(target.id, locale(), { current: now, forecast: next })
      return true
    } catch (error) {
      if (isAbortError(error) || controller !== own || quiet) return false
      errorKind.value = error instanceof ApiError ? error.kind : 'network'
      status.value = 'error'
      return false
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

  /** User-requested: bypass every cache, keep the current data on screen meanwhile; resolves to success. */
  async function refresh(): Promise<boolean> {
    if (refreshing.value) return false
    refreshing.value = true
    try {
      return await load(true, true)
    } finally {
      refreshing.value = false
    }
  }

  return { current, forecast, status, errorKind, updatedAt, refreshing, refresh, reload: () => load() }
}
