import type { Page, Route } from '@playwright/test'

/** Deterministic stand-ins for OpenWeatherMap, Open-Meteo and the IP service. */

interface Place {
  id: number
  en: string
  uk: string
  lat: number
  lon: number
  country: string
  admin1: [string, string]
  temp: number
  timezone: number
}

export const PLACES: Place[] = [
  {
    id: 703448,
    en: 'Kyiv',
    uk: 'Київ',
    lat: 50.4501,
    lon: 30.5234,
    country: 'UA',
    admin1: ['Kyiv City', 'Місто Київ'],
    temp: 4,
    timezone: 7200,
  },
  {
    id: 2643743,
    en: 'London',
    uk: 'Лондон',
    lat: 51.5085,
    lon: -0.1257,
    country: 'GB',
    admin1: ['England', 'Англія'],
    temp: 11,
    timezone: 0,
  },
  {
    id: 702550,
    en: 'Lviv',
    uk: 'Львів',
    lat: 49.8383,
    lon: 24.0232,
    country: 'UA',
    admin1: ['Lviv Oblast', 'Львівська область'],
    temp: 2,
    timezone: 7200,
  },
]

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  })
}

function placeAt(lat: number, lon: number): Place {
  return PLACES.reduce((best, place) =>
    Math.hypot(place.lat - lat, place.lon - lon) < Math.hypot(best.lat - lat, best.lon - lon) ? place : best,
  )
}

function omPlace(place: Place, language: string) {
  const uk = language === 'uk'
  return {
    id: place.id,
    name: uk ? place.uk : place.en,
    latitude: place.lat,
    longitude: place.lon,
    feature_code: 'PPLC',
    country_code: place.country,
    admin1: place.admin1[uk ? 1 : 0],
  }
}

function current(place: Place, now: number) {
  const day = Math.floor((now + place.timezone) / 86400) * 86400 - place.timezone
  return {
    coord: { lat: place.lat, lon: place.lon },
    weather: [{ id: 803, main: 'Clouds', description: 'broken clouds', icon: '04d' }],
    main: {
      temp: place.temp,
      feels_like: place.temp - 3,
      temp_min: place.temp - 1,
      temp_max: place.temp + 1,
      pressure: 1012,
      humidity: 78,
    },
    visibility: 10000,
    wind: { speed: 3.4, deg: 250 },
    clouds: { all: 75 },
    dt: now,
    sys: { country: place.country, sunrise: day + 7 * 3600, sunset: day + 16.5 * 3600 },
    timezone: place.timezone,
    name: place.en,
  }
}

function forecast(place: Place, now: number) {
  const start = Math.ceil(now / 10800) * 10800
  return {
    list: Array.from({ length: 40 }, (_, i) => ({
      dt: start + i * 10800,
      main: {
        temp: place.temp + Math.round(3 * Math.sin(i / 2)),
        feels_like: place.temp - 2,
        temp_min: place.temp - 2,
        temp_max: place.temp + 2,
        pressure: 1012,
        humidity: 70,
      },
      weather: [
        i % 5 === 0
          ? { id: 500, main: 'Rain', description: 'light rain', icon: '10d' }
          : { id: 803, main: 'Clouds', description: 'broken clouds', icon: '04d' },
      ],
      clouds: { all: 70 },
      wind: { speed: 3, deg: 200 },
      pop: i % 5 === 0 ? 0.6 : 0.1,
      sys: { pod: i % 8 < 4 ? 'd' : 'n' },
    })),
    city: {
      name: place.en,
      coord: { lat: place.lat, lon: place.lon },
      country: place.country,
      timezone: place.timezone,
      sunrise: 0,
      sunset: 0,
    },
  }
}

/** Route every external call of the app to fixtures. The IP service places the visitor in Kyiv. */
export async function mockApis(page: Page, { now = Math.floor(Date.now() / 1000) } = {}) {
  await page.route('https://get.geojs.io/**', (route) =>
    json(route, { latitude: '50.458', longitude: '30.530', city: 'Kyiv' }),
  )
  await page.route('https://ipapi.co/**', (route) => route.abort())
  await page.route('https://geocoding-api.open-meteo.com/v1/search?**', (route) => {
    const url = new URL(route.request().url())
    const name = (url.searchParams.get('name') ?? '').toLocaleLowerCase()
    const language = url.searchParams.get('language') ?? 'en'
    const results = PLACES.filter(
      (place) => place.en.toLowerCase().startsWith(name) || place.uk.toLocaleLowerCase().startsWith(name),
    )
    return json(route, results.length ? { results: results.map((place) => omPlace(place, language)) } : {})
  })
  await page.route('https://geocoding-api.open-meteo.com/v1/get?**', (route) => {
    const url = new URL(route.request().url())
    const place = PLACES.find((p) => String(p.id) === url.searchParams.get('id'))
    return place
      ? json(route, omPlace(place, url.searchParams.get('language') ?? 'en'))
      : route.fulfill({ status: 404 })
  })
  await page.route('**/api/owm/**', (route) => {
    const url = new URL(route.request().url())
    const lat = Number(url.searchParams.get('lat'))
    const lon = Number(url.searchParams.get('lon'))
    if (url.pathname.endsWith('/data/2.5/weather')) return json(route, current(placeAt(lat, lon), now))
    if (url.pathname.endsWith('/data/2.5/forecast')) return json(route, forecast(placeAt(lat, lon), now))
    if (url.pathname.endsWith('/geo/1.0/reverse')) {
      const place = placeAt(lat, lon)
      return json(route, [
        {
          name: place.en,
          local_names: { en: place.en, uk: place.uk },
          lat: place.lat,
          lon: place.lon,
          country: place.country,
        },
      ])
    }
    if (url.pathname.endsWith('/geo/1.0/direct')) return json(route, [])
    return route.fulfill({ status: 404 })
  })
}
