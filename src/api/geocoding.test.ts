import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchCities } from './cities'
import { clearGeocodingCache, completeCityNames, searchPlaces } from './geocoding'
import { ApiError } from './http'
import { clearOwmCache } from './owm'
import type { OmPlace } from './types'

const lvivUk: OmPlace = {
  id: 702550,
  name: 'Львів',
  latitude: 49.83826,
  longitude: 24.02324,
  feature_code: 'PPLA',
  country_code: 'UA',
  admin1: 'Львівська область',
}
const lvivEn: OmPlace = { ...lvivUk, name: 'Lviv', admin1: 'Lviv Oblast' }
const district: OmPlace = { ...lvivUk, id: 1, name: 'Львівський район', feature_code: 'PPLX', latitude: 1 }
const noCountry: OmPlace = { ...lvivUk, id: 2, country_code: undefined, latitude: 2 }
const lvove: OmPlace = {
  id: 702545,
  name: 'Львове',
  latitude: 46.5,
  longitude: 33.1,
  feature_code: 'PPL',
  country_code: 'UA',
}

let fetchMock: ReturnType<typeof vi.fn>

function respond(routes: Record<string, unknown>) {
  fetchMock.mockImplementation((input: string) => {
    const url = new URL(input, 'http://localhost')
    const key = `${url.pathname}?${url.searchParams.get('language') ?? ''}`
    const body = routes[key] ?? routes[url.pathname]
    if (body === undefined) return Promise.resolve(new Response('{}', { status: 500 }))
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  })
}

beforeEach(() => {
  clearGeocodingCache()
  clearOwmCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchPlaces', () => {
  it('matches Cyrillic in Ukrainian, adds English names and drops districts and broken places', async () => {
    respond({
      '/v1/search?uk': { results: [lvivUk, district, noCountry, lvove] },
      '/v1/search?en': { results: [lvivEn] },
    })
    const cities = await searchPlaces('Льв', 'en')

    expect(cities.map((city) => city.names)).toEqual([{ uk: 'Львів', en: 'Lviv' }, { uk: 'Львове' }])
    expect(cities[0]).toMatchObject({
      id: '49.84,24.02',
      geonameId: 702550,
      country: 'UA',
      state: 'Львівська область',
      states: { uk: 'Львівська область', en: 'Lviv Oblast' },
      lat: 49.8383,
      lon: 24.0232,
    })
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(requested.origin).toBe('https://geocoding-api.open-meteo.com')
    expect(requested.searchParams.get('name')).toBe('Льв')
  })

  it('searches Latin text in the interface language', async () => {
    respond({ '/v1/search?uk': { results: [lvivUk] }, '/v1/search?en': { results: [lvivEn] } })
    await searchPlaces('Lviv', 'uk')
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get('language')).toBe('uk')
  })

  it('keeps results when the second-language lookup fails', async () => {
    respond({ '/v1/search?en': { results: [lvivEn] } })
    const cities = await searchPlaces('Lviv', 'en')
    expect(cities.map((city) => city.names)).toEqual([{ en: 'Lviv' }])
  })
})

describe('completeCityNames', () => {
  it('fetches only the missing locale by GeoNames id', async () => {
    respond({
      '/v1/search?uk': { results: [lvivUk] },
      '/v1/search?en': { results: [] },
      '/v1/get?en': lvivEn,
    })
    const [city] = await searchPlaces('Льв', 'uk')
    expect(city?.names).toEqual({ uk: 'Львів' })

    const complete = await completeCityNames(city!)
    expect(complete.names).toEqual({ uk: 'Львів', en: 'Lviv' })
    expect(complete.states).toEqual({ uk: 'Львівська область', en: 'Lviv Oblast' })
    const lastUrl = new URL(String(fetchMock.mock.calls.at(-1)?.[0]))
    expect(lastUrl.pathname).toBe('/v1/get')
    expect(lastUrl.searchParams.get('id')).toBe('702550')
  })

  it('returns the city untouched when nothing is missing or lookup fails', async () => {
    const full = {
      id: 'x',
      geonameId: 1,
      name: 'A',
      names: { en: 'A', uk: 'А' },
      country: 'UA',
      lat: 0,
      lon: 0,
    }
    await expect(completeCityNames(full)).resolves.toBe(full)

    respond({})
    const partial = { ...full, names: { en: 'A' } }
    await expect(completeCityNames(partial)).resolves.toMatchObject({ names: { en: 'A' } })
  })
})

describe('searchCities', () => {
  it('falls back to OpenWeatherMap when Open-Meteo finds nothing', async () => {
    respond({
      '/v1/search?en': { results: [] },
      '/v1/search?uk': { results: [] },
      '/api/owm/geo/1.0/direct': [{ name: 'Lviv', lat: 49.84, lon: 24.03, country: 'UA' }],
    })
    const cities = await searchCities('Lviv', 'en')
    expect(cities).toHaveLength(1)
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('/api/owm/geo/1.0/direct')
  })

  it('falls back when Open-Meteo is down and surfaces the error when both fail', async () => {
    respond({ '/api/owm/geo/1.0/direct': [{ name: 'Lviv', lat: 49.84, lon: 24.03, country: 'UA' }] })
    await expect(searchCities('Lviv', 'en')).resolves.toHaveLength(1)

    clearGeocodingCache()
    clearOwmCache()
    respond({})
    await expect(searchCities('Lviv', 'en')).rejects.toBeInstanceOf(ApiError)
  })

  it('propagates aborts without falling back', async () => {
    fetchMock.mockImplementation(
      (_input: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
        ),
    )
    const controller = new AbortController()
    const pending = searchCities('Lviv', 'en', controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' })
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/api/owm'))).toBe(true)
  })
})
