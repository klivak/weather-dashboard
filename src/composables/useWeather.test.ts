import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { ApiError } from '@/api/http'
import type { City, Locale } from '@/api/models'
import { useWeather } from './useWeather'

const api = vi.hoisted(() => ({ getCurrentWeather: vi.fn(), getForecast: vi.fn() }))
vi.mock('@/api/owm', () => api)

const kyiv: City = { id: 'k', name: 'Kyiv', names: {}, country: 'UA', lat: 50.45, lon: 30.52 }
const lviv: City = { id: 'l', name: 'Lviv', names: {}, country: 'UA', lat: 49.84, lon: 24.03 }

function setup(initial: City | null = kyiv) {
  const city = ref<City | null>(initial)
  const locale = ref<Locale>('en')
  const scope = effectScope()
  const weather = scope.run(() =>
    useWeather(
      () => city.value,
      () => locale.value,
    ),
  )!
  return { city, locale, scope, weather }
}

beforeEach(() => {
  api.getCurrentWeather
    .mockReset()
    .mockImplementation((c: City, lang: Locale) => Promise.resolve({ temp: c.id === 'k' ? 5 : 9, lang }))
  api.getForecast.mockReset().mockResolvedValue({ points: [] })
})

describe('useWeather', () => {
  it('loads current weather and forecast for the city in the interface language', async () => {
    const { weather } = setup()
    expect(weather.status.value).toBe('loading')
    await flushPromises()
    expect(weather.status.value).toBe('success')
    expect(weather.current.value).toEqual({ temp: 5, lang: 'en' })
    expect(api.getForecast).toHaveBeenCalledWith(kyiv, 'en', expect.any(AbortSignal))
  })

  it('clears data for a new city but keeps it while the language changes', async () => {
    const { city, locale, weather } = setup()
    await flushPromises()

    locale.value = 'uk'
    await Promise.resolve()
    expect(weather.status.value).toBe('loading')
    expect(weather.current.value).not.toBeNull()
    await flushPromises()
    expect(weather.current.value).toEqual({ temp: 5, lang: 'uk' })

    city.value = lviv
    await Promise.resolve()
    expect(weather.current.value).toBeNull()
    await flushPromises()
    expect(weather.current.value).toEqual({ temp: 9, lang: 'uk' })
  })

  it('ignores a slow answer for a city the user already left', async () => {
    let resolveKyiv: (value: unknown) => void = () => {}
    api.getCurrentWeather.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveKyiv = resolve
        }),
    )
    const { city, weather } = setup()
    const firstSignal = api.getCurrentWeather.mock.calls[0]?.[2] as AbortSignal

    city.value = lviv
    await flushPromises()
    expect(firstSignal.aborted).toBe(true)
    resolveKyiv({ temp: 5 })
    await flushPromises()
    expect(weather.current.value).toEqual({ temp: 9, lang: 'en' })
  })

  it('reports the error kind and recovers on reload', async () => {
    api.getForecast.mockRejectedValueOnce(new ApiError('rate-limit', 'slow down'))
    const { weather } = setup()
    await flushPromises()
    expect(weather.status.value).toBe('error')
    expect(weather.errorKind.value).toBe('rate-limit')

    await weather.reload()
    expect(weather.status.value).toBe('success')
  })

  it('stays idle without a city and aborts on dispose', async () => {
    const { weather } = setup(null)
    expect(weather.status.value).toBe('idle')
    expect(api.getCurrentWeather).not.toHaveBeenCalled()

    const other = setup()
    const signal = api.getCurrentWeather.mock.calls[0]?.[2] as AbortSignal
    other.scope.stop()
    expect(signal.aborted).toBe(true)
  })
})
