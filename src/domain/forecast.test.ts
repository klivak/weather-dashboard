import { describe, expect, it } from 'vitest'
import type { CurrentWeather, Forecast, ForecastPoint } from '@/api/models'
import { compassPoint, formatDayDate, formatTemp, formatTime } from '@/utils/format'
import { localDateKey, todaySeries } from './forecast'

const KYIV_TZ = 7200
const HOUR = 3600
/** 2026-11-11 00:00 in Kyiv (UTC+2). */
const MIDNIGHT = Date.UTC(2026, 10, 11, 0, 0) / 1000 - KYIV_TZ

function point(dt: number, temp: number): ForecastPoint {
  return {
    dt,
    temp,
    feelsLike: temp,
    tempMin: temp,
    tempMax: temp,
    humidity: 50,
    windSpeed: 1,
    pop: 0,
    isDay: true,
    condition: { id: 800, main: 'Clear', description: '', icon: '01d' },
  }
}

function current(dt: number, temp = 5): CurrentWeather {
  return {
    dt,
    timezone: KYIV_TZ,
    sunrise: 0,
    sunset: 0,
    temp,
    feelsLike: temp,
    tempMin: temp,
    tempMax: temp,
    humidity: 50,
    pressure: 1010,
    windSpeed: 1,
    windDeg: 0,
    clouds: 0,
    visibility: 10000,
    condition: { id: 800, main: 'Clear', description: '', icon: '01d' },
  }
}

/** Forecast points every 3 h from 00:00 local for two days (UTC 3-hour grid shifted by 2 h in Kyiv). */
const forecast: Forecast = {
  timezone: KYIV_TZ,
  sunrise: 0,
  sunset: 0,
  points: Array.from({ length: 16 }, (_, i) => point(MIDNIGHT + HOUR + i * 3 * HOUR, i)),
}

describe('localDateKey', () => {
  it('uses the city offset, not the browser timezone', () => {
    expect(localDateKey(MIDNIGHT - 1, KYIV_TZ)).toBe('2026-11-10')
    expect(localDateKey(MIDNIGHT, KYIV_TZ)).toBe('2026-11-11')
    expect(localDateKey(MIDNIGHT, 0)).toBe('2026-11-10')
  })
})

describe('todaySeries', () => {
  it('starts with the live reading and keeps the rest of the local day', () => {
    const series = todaySeries(current(MIDNIGHT + 8 * HOUR, 3.4), forecast)
    expect(series[0]).toEqual({ dt: MIDNIGHT + 8 * HOUR, temp: 3.4, now: true })
    // Points at 10, 13, 16, 19, 22 h local remain today; then it continues into tomorrow to reach 8 points.
    expect(series.map((p) => formatTime(p.dt, KYIV_TZ, 'en'))).toEqual([
      '08:00',
      '10:00',
      '13:00',
      '16:00',
      '19:00',
      '22:00',
      '01:00',
      '04:00',
    ])
  })

  it('in the morning shows the whole local day even beyond the minimum', () => {
    const series = todaySeries(current(MIDNIGHT + 0.5 * HOUR), forecast)
    expect(series).toHaveLength(9)
    expect(series.slice(1).every((p) => localDateKey(p.dt, KYIV_TZ) === '2026-11-11')).toBe(true)
  })

  it('late at night continues into tomorrow', () => {
    const series = todaySeries(current(MIDNIGHT + 23 * HOUR), forecast)
    expect(series).toHaveLength(8)
    expect(series.slice(1).every((p) => localDateKey(p.dt, KYIV_TZ) === '2026-11-12')).toBe(true)
  })
})

describe('format', () => {
  it('formats temperatures with a real minus and no "-0"', () => {
    expect(formatTemp(-3.4)).toBe('−3°')
    expect(formatTemp(-0.4)).toBe('0°')
    expect(formatTemp(12.5)).toBe('13°')
  })

  it('formats time and date in the city timezone', () => {
    expect(formatTime(MIDNIGHT + 14 * HOUR, KYIV_TZ, 'uk')).toBe('14:00')
    expect(formatDayDate(MIDNIGHT, KYIV_TZ, 'en')).toBe('Wed 11 Nov')
    expect(formatDayDate(MIDNIGHT, KYIV_TZ, 'uk')).toMatch(/^ср, 11 лист/)
  })

  it.each([
    [0, 'N'],
    [44, 'NE'],
    [180, 'S'],
    [250, 'W'],
    [337.6, 'N'],
    [-90, 'W'],
  ] as const)('%d° → %s', (degrees, expected) => {
    expect(compassPoint(degrees)).toBe(expected)
  })
})
