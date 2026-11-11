import { describe, expect, it } from 'vitest'
import type { CurrentWeather, Forecast, ForecastPoint } from '@/api/models'
import { compassPoint, formatDayDate, formatShortWeekday, formatTemp, formatTime } from '@/utils/format'
import { dailySummaries, localDateKey, todaySeries } from './forecast'

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
    expect(series[0]).toEqual({ dt: MIDNIGHT + 8 * HOUR, temp: 3.4, now: true, nextDay: false })
    // Points at 10, 13, 16, 19, 22 h local remain today, which is enough: nothing from tomorrow.
    expect(series.map((p) => formatTime(p.dt, KYIV_TZ, 'en'))).toEqual([
      '08:00',
      '10:00',
      '13:00',
      '16:00',
      '19:00',
      '22:00',
    ])
    expect(series.some((p) => p.nextDay)).toBe(false)
  })

  it('in the morning shows the whole local day even beyond the minimum', () => {
    const series = todaySeries(current(MIDNIGHT + 0.5 * HOUR), forecast)
    expect(series).toHaveLength(9)
    expect(series.slice(1).every((p) => localDateKey(p.dt, KYIV_TZ) === '2026-11-11')).toBe(true)
  })

  it('keeps a short afternoon series to today only', () => {
    // 17:00: 19:00 and 22:00 remain, plus the live reading = 3 points < 4, so it borrows tomorrow.
    const afternoon = todaySeries(current(MIDNIGHT + 14 * HOUR), forecast)
    expect(afternoon.map((p) => formatTime(p.dt, KYIV_TZ, 'en'))).toEqual([
      '14:00',
      '16:00',
      '19:00',
      '22:00',
    ])
    expect(afternoon.some((p) => p.nextDay)).toBe(false)

    const evening = todaySeries(current(MIDNIGHT + 17 * HOUR), forecast)
    expect(evening).toHaveLength(8)
    expect(evening.findIndex((p) => p.nextDay)).toBe(3)
    expect(evening.slice(3).every((p) => p.nextDay && localDateKey(p.dt, KYIV_TZ) === '2026-11-12')).toBe(
      true,
    )
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

describe('dailySummaries', () => {
  const rain = { id: 500, main: 'Rain', description: 'light rain', icon: '10d' }
  const clouds = { id: 804, main: 'Clouds', description: 'overcast', icon: '04d' }
  const thunder = { id: 211, main: 'Thunderstorm', description: 'thunderstorm', icon: '11d' }

  function at(hoursFromMidnight: number, temp: number, extra: Partial<ForecastPoint> = {}): ForecastPoint {
    return { ...point(MIDNIGHT + hoursFromMidnight * HOUR, temp), ...extra }
  }

  it('groups by the city local date and averages the 3-hour temperatures', () => {
    const points = [
      at(19, 4, { tempMin: 3.5 }),
      at(22, 2),
      ...[1, 4, 7, 10, 13, 16, 19, 22].map((h, i) => at(24 + h, i * 2, { pop: i === 3 ? 0.6 : 0.1 })),
      at(48 + 1, -1, { tempMax: 0 }),
    ]
    const days = dailySummaries({ timezone: KYIV_TZ, sunrise: 0, sunset: 0, points })

    expect(days.map((day) => day.date)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13'])
    expect(days[0]).toMatchObject({ avg: 3, min: 2, max: 4, samples: 2 })
    expect(days[1]).toMatchObject({ avg: 7, min: 0, max: 14, pop: 0.6, samples: 8 })
    expect(days[2]).toMatchObject({ avg: -1, min: -1, max: 0, samples: 1 })
  })

  it('uses the min and max reported inside each point when they are wider than the readings', () => {
    const [day] = dailySummaries({
      timezone: KYIV_TZ,
      sunrise: 0,
      sunset: 0,
      points: [at(10, 5, { tempMin: 3, tempMax: 7 }), at(13, 6)],
    })
    expect(day).toMatchObject({ avg: 5.5, min: 3, max: 7 })
  })

  it('stops at the requested number of days', () => {
    const points = Array.from({ length: 40 }, (_, i) => at(1 + i * 3, i))
    const days = dailySummaries({ timezone: KYIV_TZ, sunrise: 0, sunset: 0, points })
    expect(days).toHaveLength(5)
    expect(days.at(-1)?.date).toBe('2026-11-15')
  })

  it('picks the most frequent daytime condition, breaking ties towards the more severe one', () => {
    const forecast = (conditions: [typeof rain, boolean][]) => ({
      timezone: KYIV_TZ,
      sunrise: 0,
      sunset: 0,
      points: conditions.map(([condition, isDay], i) => at(1 + i * 3, 0, { condition, isDay })),
    })
    expect(
      dailySummaries(
        forecast([
          [rain, true],
          [clouds, true],
          [clouds, true],
          [rain, false],
          [rain, false],
        ]),
      )[0]?.condition.id,
    ).toBe(804)
    expect(
      dailySummaries(
        forecast([
          [rain, true],
          [clouds, true],
        ]),
      )[0]?.condition.id,
    ).toBe(500)
    expect(
      dailySummaries(
        forecast([
          [clouds, true],
          [thunder, true],
        ]),
      )[0]?.condition.id,
    ).toBe(211)
    expect(
      dailySummaries(
        forecast([
          [rain, false],
          [clouds, false],
          [rain, false],
        ]),
      )[0]?.condition.id,
    ).toBe(500)
  })
})

describe('formatShortWeekday', () => {
  it('capitalises the weekday in both languages', () => {
    expect(formatShortWeekday(MIDNIGHT + 12 * HOUR, KYIV_TZ, 'uk')).toBe('Ср')
    expect(formatShortWeekday(MIDNIGHT + 12 * HOUR, KYIV_TZ, 'en')).toBe('Wed')
  })
})
