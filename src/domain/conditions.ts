export type ConditionKind =
  'clear' | 'partly' | 'cloudy' | 'overcast' | 'drizzle' | 'rain' | 'sleet' | 'snow' | 'thunder' | 'mist'

/** Map an OpenWeatherMap condition id (https://openweathermap.org/weather-conditions) to an icon kind. */
export function conditionKind(id: number): ConditionKind {
  if (id >= 200 && id < 300) return 'thunder'
  if (id >= 300 && id < 400) return 'drizzle'
  if (id === 511) return 'sleet'
  if (id >= 500 && id < 600) return 'rain'
  if (id >= 611 && id <= 616) return 'sleet'
  if (id >= 600 && id < 700) return 'snow'
  if (id >= 700 && id < 800) return 'mist'
  if (id === 801 || id === 802) return 'partly'
  if (id === 803) return 'cloudy'
  if (id === 804) return 'overcast'
  return 'clear'
}

/** OpenWeatherMap icon codes end in "d" or "n". */
export function isDayIcon(icon: string): boolean {
  return !icon.endsWith('n')
}
