import { beforeEach, describe, expect, it } from 'vitest'
import type { CurrentWeather, Forecast } from './models'
import { MAX_AGE_MS, readSnapshot, writeSnapshot } from './snapshot'

const condition = { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }
const current: CurrentWeather = {
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
  windDeg: 90,
  clouds: 0,
  visibility: null,
  condition,
}
const forecast: Forecast = {
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

beforeEach(() => localStorage.clear())

describe('weather snapshots', () => {
  it('round-trips valid data per city and language', () => {
    writeSnapshot('c', 'en', { current, forecast }, 1000)
    expect(readSnapshot('c', 'en', 2000)).toEqual({ savedAt: 1000, current, forecast })
    expect(readSnapshot('c', 'uk', 2000)).toBeNull()
  })

  it('expires after three hours', () => {
    writeSnapshot('c', 'en', { current, forecast }, 0)
    expect(readSnapshot('c', 'en', MAX_AGE_MS + 1)).toBeNull()
  })

  it('ignores data whose shape changed (e.g. written by an older build)', () => {
    writeSnapshot(
      'c',
      'en',
      { current: { ...current, temp: undefined } as unknown as CurrentWeather, forecast },
      1000,
    )
    expect(readSnapshot('c', 'en', 1000)).toBeNull()

    const brokenPoint = {
      ...forecast,
      points: [{ ...forecast.points[0], condition: null }],
    } as unknown as Forecast
    writeSnapshot('c', 'en', { current, forecast: brokenPoint }, 1000)
    expect(readSnapshot('c', 'en', 1000)).toBeNull()
  })

  it('removes snapshots of other versions and expired ones when writing', () => {
    localStorage.setItem('wd:wx:old|en', '{}')
    writeSnapshot('a', 'en', { current, forecast }, 0)
    writeSnapshot('b', 'en', { current, forecast }, MAX_AGE_MS + 10)
    const keys = Object.keys(localStorage).filter((key) => key.startsWith('wd:wx:'))
    expect(keys).toEqual(['wd:wx:v1:b|en'])
  })
})
