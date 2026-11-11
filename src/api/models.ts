// App-level models produced by the API layer. All times are unix seconds (UTC); `timezone` is the city's offset from UTC in seconds.

export type Locale = 'en' | 'uk'

export interface Coords {
  lat: number
  lon: number
}

export interface City extends Coords {
  /** Stable id from rounded coordinates, so the same place found twice is one city. */
  id: string
  name: string
  names: Partial<Record<Locale, string>>
  country: string
  state?: string
}

export interface Condition {
  id: number
  main: string
  description: string
  icon: string
}

export interface CurrentWeather {
  dt: number
  timezone: number
  sunrise: number
  sunset: number
  temp: number
  feelsLike: number
  tempMin: number
  tempMax: number
  humidity: number
  pressure: number
  windSpeed: number
  windDeg: number
  clouds: number
  visibility: number | null
  condition: Condition
}

export interface ForecastPoint {
  dt: number
  temp: number
  feelsLike: number
  tempMin: number
  tempMax: number
  humidity: number
  windSpeed: number
  pop: number
  isDay: boolean
  condition: Condition
}

export interface Forecast {
  timezone: number
  sunrise: number
  sunset: number
  points: ForecastPoint[]
}

export function cityId({ lat, lon }: Coords): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

export function cityName(city: City, locale: Locale): string {
  return city.names[locale] ?? city.name
}
