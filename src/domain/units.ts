import type { CurrentWeather, Forecast } from '@/api/models'

/** Metric: °C, m/s, km. Imperial: °F, mph, miles. Data always arrives metric and is converted for display. */
export type Units = 'metric' | 'imperial'

export function isUnits(value: unknown): value is Units {
  return value === 'metric' || value === 'imperial'
}

export const toFahrenheit = (celsius: number) => (celsius * 9) / 5 + 32
const toMph = (metresPerSecond: number) => metresPerSecond * 2.236936

export function currentInUnits(weather: CurrentWeather, units: Units): CurrentWeather {
  if (units === 'metric') return weather
  return {
    ...weather,
    temp: toFahrenheit(weather.temp),
    feelsLike: toFahrenheit(weather.feelsLike),
    tempMin: toFahrenheit(weather.tempMin),
    tempMax: toFahrenheit(weather.tempMax),
    windSpeed: toMph(weather.windSpeed),
  }
}

export function forecastInUnits(forecast: Forecast, units: Units): Forecast {
  if (units === 'metric') return forecast
  return {
    ...forecast,
    points: forecast.points.map((point) => ({
      ...point,
      temp: toFahrenheit(point.temp),
      feelsLike: toFahrenheit(point.feelsLike),
      tempMin: toFahrenheit(point.tempMin),
      tempMax: toFahrenheit(point.tempMax),
      windSpeed: toMph(point.windSpeed),
    })),
  }
}

/** Visibility arrives in metres. */
export function visibilityInUnits(metres: number, units: Units): number {
  return units === 'imperial' ? metres / 1609.344 : metres / 1000
}
