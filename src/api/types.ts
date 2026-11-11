// Raw OpenWeatherMap response shapes, limited to the fields the app reads. Components never use these directly; see models.ts.

export interface OwmGeoItem {
  name: string
  local_names?: Record<string, string>
  lat: number
  lon: number
  country: string
  state?: string
}

export interface OwmCondition {
  id: number
  main: string
  description: string
  icon: string
}

export interface OwmMain {
  temp: number
  feels_like: number
  temp_min: number
  temp_max: number
  pressure: number
  humidity: number
}

export interface OwmCurrent {
  coord: { lat: number; lon: number }
  weather: OwmCondition[]
  main: OwmMain
  visibility?: number
  wind: { speed: number; deg: number; gust?: number }
  clouds: { all: number }
  dt: number
  sys: { country?: string; sunrise: number; sunset: number }
  timezone: number
  name: string
}

export interface OwmForecastItem {
  dt: number
  main: OwmMain
  weather: OwmCondition[]
  clouds: { all: number }
  wind: { speed: number; deg: number; gust?: number }
  pop?: number
  sys: { pod: 'd' | 'n' }
}

export interface OwmForecast {
  list: OwmForecastItem[]
  city: {
    name: string
    coord: { lat: number; lon: number }
    country: string
    timezone: number
    sunrise: number
    sunset: number
  }
}

export interface OmPlace {
  id: number
  name: string
  latitude: number
  longitude: number
  feature_code?: string
  country_code?: string
  admin1?: string
}

export interface OmSearchResponse {
  results?: OmPlace[]
}
