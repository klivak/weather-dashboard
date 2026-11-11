import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { locateByIp } from './ipLocation'
import { cityName } from './models'
import { clearOwmCache, getCurrentWeather, getForecast, reverseGeocode, searchCities } from './owm'
import type { OwmCurrent, OwmForecast, OwmGeoItem } from './types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const lviv: OwmGeoItem = {
  name: 'Lviv',
  local_names: { en: 'Lviv', uk: 'Львів', de: 'Lemberg' },
  lat: 49.841952,
  lon: 24.0315921,
  country: 'UA',
  state: 'Lviv Oblast',
}

const current: OwmCurrent = {
  coord: { lat: 49.84, lon: 24.03 },
  weather: [{ id: 803, main: 'Clouds', description: 'хмарно', icon: '04d' }],
  main: { temp: 7.3, feels_like: 4.9, temp_min: 6.1, temp_max: 8.2, pressure: 1016, humidity: 81 },
  visibility: 10000,
  wind: { speed: 3.6, deg: 250 },
  clouds: { all: 75 },
  dt: 1_762_860_000,
  sys: { country: 'UA', sunrise: 1_762_838_000, sunset: 1_762_871_000 },
  timezone: 7200,
  name: 'Lviv',
}

const forecast: OwmForecast = {
  list: [
    {
      dt: 1_762_862_400,
      main: { temp: 7, feels_like: 5, temp_min: 6, temp_max: 8, pressure: 1016, humidity: 80 },
      weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }],
      clouds: { all: 90 },
      wind: { speed: 4, deg: 200 },
      pop: 0.4,
      sys: { pod: 'd' },
    },
    {
      dt: 1_762_873_200,
      main: { temp: 4, feels_like: 2, temp_min: 4, temp_max: 4, pressure: 1017, humidity: 88 },
      weather: [],
      clouds: { all: 20 },
      wind: { speed: 2, deg: 180 },
      sys: { pod: 'n' },
    },
  ],
  city: {
    name: 'Lviv',
    coord: { lat: 49.84, lon: 24.03 },
    country: 'UA',
    timezone: 7200,
    sunrise: 1,
    sunset: 2,
  },
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  clearOwmCache()
  sessionStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function requestedUrl(call = 0): URL {
  return new URL(String(fetchMock.mock.calls[call]?.[0]), 'http://localhost')
}

describe('searchCities', () => {
  it('skips queries shorter than 2 characters', async () => {
    await expect(searchCities(' l ')).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls the proxy without a key and maps cities with en/uk names', async () => {
    fetchMock.mockResolvedValue(jsonResponse([lviv, { ...lviv, lat: 49.8419 }]))
    const cities = await searchCities('  Lviv ')

    const requested = requestedUrl()
    expect(requested.pathname).toBe('/api/owm/geo/1.0/direct')
    expect(requested.searchParams.get('q')).toBe('Lviv')
    expect(requested.searchParams.get('limit')).toBe('5')
    expect(requested.searchParams.has('appid')).toBe(false)

    expect(cities).toHaveLength(1)
    expect(cities[0]).toEqual({
      id: '49.84,24.03',
      name: 'Lviv',
      names: { en: 'Lviv', uk: 'Львів' },
      country: 'UA',
      state: 'Lviv Oblast',
      lat: 49.842,
      lon: 24.0316,
    })
    expect(cityName(cities[0]!, 'uk')).toBe('Львів')
  })

  it('falls back to the default name when a locale is missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ ...lviv, local_names: undefined }]))
    const [city] = await searchCities('Lviv')
    expect(cityName(city!, 'uk')).toBe('Lviv')
  })
})

describe('reverseGeocode', () => {
  it('returns the first place or throws not-found', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([lviv])).mockResolvedValueOnce(jsonResponse([]))
    await expect(reverseGeocode({ lat: 49.84, lon: 24.03 })).resolves.toMatchObject({ name: 'Lviv' })
    await expect(reverseGeocode({ lat: 0, lon: 0 })).rejects.toMatchObject({ kind: 'not-found' })
  })
})

describe('weather', () => {
  it('requests metric units in the given language and maps the current weather', async () => {
    fetchMock.mockResolvedValue(jsonResponse(current))
    const weather = await getCurrentWeather({ lat: 49.84, lon: 24.03 }, 'uk')

    const requested = requestedUrl()
    expect(requested.pathname).toBe('/api/owm/data/2.5/weather')
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      lat: '49.84',
      lon: '24.03',
      units: 'metric',
      lang: 'uk',
    })
    expect(weather).toMatchObject({
      temp: 7.3,
      feelsLike: 4.9,
      timezone: 7200,
      sunrise: 1_762_838_000,
      visibility: 10000,
      condition: { id: 803, description: 'хмарно', icon: '04d' },
    })
  })

  it('maps forecast points with day flag, rain chance and a fallback condition', async () => {
    fetchMock.mockResolvedValue(jsonResponse(forecast))
    const result = await getForecast({ lat: 49.84, lon: 24.03 }, 'en')

    expect(requestedUrl().pathname).toBe('/api/owm/data/2.5/forecast')
    expect(result.timezone).toBe(7200)
    expect(result.points).toHaveLength(2)
    expect(result.points[0]).toMatchObject({ temp: 7, pop: 0.4, isDay: true })
    expect(result.points[1]).toMatchObject({ pop: 0, isDay: false, condition: { id: 800 } })
  })

  it('caches identical requests', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(current)))
    await getCurrentWeather({ lat: 1, lon: 2 }, 'en')
    await getCurrentWeather({ lat: 1, lon: 2 }, 'en')
    await getCurrentWeather({ lat: 1, lon: 2 }, 'uk')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('locateByIp', () => {
  it('uses the first provider that answers and caches the result for the session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ latitude: '49.84', longitude: '24.03', city: 'Lviv' }))
    await expect(locateByIp()).resolves.toEqual({ lat: 49.84, lon: 24.03 })
    await expect(locateByIp()).resolves.toEqual({ lat: 49.84, lon: 24.03 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls through to the next provider and returns null when all fail', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('blocked'))
      .mockResolvedValueOnce(jsonResponse({ latitude: 50.45, longitude: 30.52 }))
    await expect(locateByIp()).resolves.toEqual({ lat: 50.45, lon: 30.52 })

    sessionStorage.clear()
    fetchMock.mockReset()
    fetchMock
      .mockRejectedValueOnce(new TypeError('blocked'))
      .mockResolvedValueOnce(jsonResponse({ error: true }))
    await expect(locateByIp()).resolves.toBeNull()
  })
})
