import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { ApiError } from '@/api/http'
import type { City, Locale } from '@/api/models'
import { REFRESH_AFTER_MS, useWeather } from './useWeather'

const api = vi.hoisted(() => ({ getCurrentWeather: vi.fn(), getForecast: vi.fn() }))
vi.mock('@/api/owm', () => api)

const kyiv: City = { id: 'k', name: 'Kyiv', names: {}, country: 'UA', lat: 50.45, lon: 30.52 }
const lviv: City = { id: 'l', name: 'Lviv', names: {}, country: 'UA', lat: 49.84, lon: 24.03 }

const scopes: ReturnType<typeof effectScope>[] = []

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

function setup(initial: City | null = kyiv) {
  const city = ref<City | null>(initial)
  const locale = ref<Locale>('en')
  const scope = effectScope()
  scopes.push(scope)
  const weather = scope.run(() =>
    useWeather(
      () => city.value,
      () => locale.value,
    ),
  )!
  return { city, locale, scope, weather }
}

beforeEach(() => {
  localStorage.clear()
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
    expect(api.getForecast).toHaveBeenCalledWith(kyiv, 'en', expect.any(AbortSignal), false)
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

describe('useWeather snapshots', () => {
  const condition = { id: 800, main: 'Clear', description: 'clear', icon: '01d' }
  const validCurrent = {
    dt: 1,
    timezone: 0,
    sunrise: 0,
    sunset: 0,
    temp: 5,
    feelsLike: 3,
    tempMin: 4,
    tempMax: 6,
    humidity: 50,
    pressure: 1010,
    windSpeed: 2,
    windDeg: 0,
    clouds: 0,
    visibility: 10000,
    condition,
  }
  const validForecast = {
    timezone: 0,
    sunrise: 0,
    sunset: 0,
    points: [
      {
        dt: 2,
        temp: 6,
        feelsLike: 5,
        tempMin: 5,
        tempMax: 7,
        humidity: 50,
        windSpeed: 2,
        pop: 0,
        isDay: true,
        condition,
      },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    api.getCurrentWeather.mockResolvedValue(validCurrent)
    api.getForecast.mockResolvedValue(validForecast)
  })

  it('shows the last data for the city instantly, then refreshes it quietly', async () => {
    const first = setup()
    await flushPromises()
    first.scope.stop()

    api.getCurrentWeather.mockImplementation(() => new Promise(() => {}))
    const { weather } = setup()
    expect(weather.status.value).toBe('success')
    expect(weather.current.value).toEqual(validCurrent)
    expect(api.getCurrentWeather).toHaveBeenCalledTimes(2)
  })

  it('ignores snapshots older than three hours', async () => {
    const first = setup()
    await flushPromises()
    first.scope.stop()

    const later = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3 * 60 * 60 * 1000 + 1)
    api.getCurrentWeather.mockImplementation(() => new Promise(() => {}))
    const { weather } = setup()
    expect(weather.status.value).toBe('loading')
    expect(weather.current.value).toBeNull()
    later.mockRestore()
  })
})

describe('useWeather freshness', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('refreshes quietly once the data is ten minutes old, only while the tab is visible', async () => {
    vi.useFakeTimers()
    const { weather } = setup()
    await flushPromises()
    expect(api.getCurrentWeather).toHaveBeenCalledTimes(1)

    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(REFRESH_AFTER_MS + 60_000)
    expect(api.getCurrentWeather).toHaveBeenCalledTimes(1)

    api.getCurrentWeather.mockImplementationOnce(() => Promise.resolve({ temp: 6, lang: 'en' }))
    setVisibility('visible')
    expect(weather.status.value).toBe('success')
    await flushPromises()
    expect(api.getCurrentWeather).toHaveBeenCalledTimes(2)
    expect(weather.current.value).toEqual({ temp: 6, lang: 'en' })
  })

  it('keeps the shown data when a background refresh fails', async () => {
    vi.useFakeTimers()
    const { weather } = setup()
    await flushPromises()
    api.getCurrentWeather.mockRejectedValueOnce(new ApiError('network', 'offline'))
    await vi.advanceTimersByTimeAsync(REFRESH_AFTER_MS + 60_000)
    await flushPromises()
    expect(weather.status.value).toBe('success')
    expect(weather.current.value).toEqual({ temp: 5, lang: 'en' })
  })

  it('retries a failed load when the connection comes back', async () => {
    api.getCurrentWeather.mockRejectedValueOnce(new ApiError('network', 'offline'))
    const { weather } = setup()
    await flushPromises()
    expect(weather.status.value).toBe('error')

    window.dispatchEvent(new Event('online'))
    await flushPromises()
    expect(weather.status.value).toBe('success')
  })

  it('stops listening when disposed', async () => {
    vi.useFakeTimers()
    const { scope } = setup()
    await flushPromises()
    scope.stop()
    await vi.advanceTimersByTimeAsync(REFRESH_AFTER_MS * 2)
    expect(api.getCurrentWeather).toHaveBeenCalledTimes(1)
  })
})

describe('useWeather manual refresh', () => {
  beforeEach(() => localStorage.clear())

  it('bypasses caches, keeps the data on screen and records the time', async () => {
    const { weather } = setup()
    await flushPromises()
    const first = weather.updatedAt.value
    expect(first).not.toBeNull()

    api.getCurrentWeather.mockImplementationOnce(() => Promise.resolve({ temp: 8, lang: 'en' }))
    const pending = weather.refresh()
    expect(weather.refreshing.value).toBe(true)
    expect(weather.status.value).toBe('success')
    await pending
    expect(weather.refreshing.value).toBe(false)
    expect(api.getCurrentWeather).toHaveBeenLastCalledWith(kyiv, 'en', expect.any(AbortSignal), true)
    expect(weather.current.value).toEqual({ temp: 8, lang: 'en' })
    expect(weather.updatedAt.value).toBeGreaterThanOrEqual(first!)
  })
})
