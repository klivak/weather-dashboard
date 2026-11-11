import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ApiErrorKind } from '@/api/http'
import { ApiError, isAbortError } from '@/api/http'
import type { City, CurrentWeather, Forecast, Locale } from '@/api/models'
import { getCurrentWeather, getForecast } from '@/api/owm'

export type WeatherStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * Current weather and the 5-day forecast for a city, refetched when the city or language changes.
 * A new city clears the old data (the UI shows a skeleton); a language change keeps it on screen until the
 * translated descriptions arrive. Only the latest request can update the state.
 */
export function useWeather(city: () => City | null | undefined, locale: () => Locale) {
  const current = shallowRef<CurrentWeather | null>(null)
  const forecast = shallowRef<Forecast | null>(null)
  const status = ref<WeatherStatus>('idle')
  const errorKind = ref<ApiErrorKind | null>(null)

  let controller: AbortController | undefined
  let loadedCityId: string | null = null

  async function load() {
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
    if (loadedCityId !== target.id) {
      current.value = null
      forecast.value = null
    }
    status.value = 'loading'
    errorKind.value = null

    try {
      const [now, next] = await Promise.all([
        getCurrentWeather(target, locale(), own.signal),
        getForecast(target, locale(), own.signal),
      ])
      if (controller !== own) return
      current.value = now
      forecast.value = next
      loadedCityId = target.id
      status.value = 'success'
    } catch (error) {
      if (isAbortError(error) || controller !== own) return
      errorKind.value = error instanceof ApiError ? error.kind : 'network'
      status.value = 'error'
    }
  }

  watch([() => city()?.id, locale], () => void load(), { immediate: true })
  onScopeDispose(() => controller?.abort())

  return { current, forecast, status, errorKind, reload: load }
}
