import { describe, expect, it } from 'vitest'
import type { CurrentWeather, Forecast } from '@/api/models'
import { currentInUnits, forecastInUnits, toFahrenheit, visibilityInUnits } from './units'

const current = {
  temp: 0,
  feelsLike: -5,
  tempMin: -1,
  tempMax: 1,
  windSpeed: 10,
  visibility: 10000,
} as CurrentWeather

describe('units', () => {
  it('converts temperatures and wind for imperial and leaves metric untouched', () => {
    expect(toFahrenheit(100)).toBe(212)
    expect(currentInUnits(current, 'metric')).toBe(current)
    const imperial = currentInUnits(current, 'imperial')
    expect(imperial).toMatchObject({ temp: 32, feelsLike: 23, tempMin: 30.2, tempMax: 33.8 })
    expect(imperial.windSpeed).toBeCloseTo(22.37, 2)
    expect(imperial.visibility).toBe(10000)
  })

  it('converts every forecast point', () => {
    const forecast = {
      timezone: 0,
      sunrise: 0,
      sunset: 0,
      points: [{ temp: 10, feelsLike: 8, tempMin: 9, tempMax: 11, windSpeed: 1 }],
    } as Forecast
    expect(forecastInUnits(forecast, 'imperial').points[0]).toMatchObject({
      temp: 50,
      tempMin: 48.2,
      tempMax: 51.8,
    })
  })

  it('gives visibility in km or miles', () => {
    expect(visibilityInUnits(10000, 'metric')).toBe(10)
    expect(visibilityInUnits(10000, 'imperial')).toBeCloseTo(6.21, 2)
  })
})
