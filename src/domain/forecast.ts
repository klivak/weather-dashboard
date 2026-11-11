import type { CurrentWeather, Forecast } from '@/api/models'

export interface TempPoint {
  /** Unix seconds (UTC). */
  dt: number
  temp: number
  /** True for the live reading, false for forecast points. */
  now: boolean
}

/** YYYY-MM-DD of a moment in a city whose offset from UTC is `timezone` seconds. */
export function localDateKey(dt: number, timezone: number): string {
  return new Date((dt + timezone) * 1000).toISOString().slice(0, 10)
}

/**
 * Temperatures for "today" in the city's own timezone: the live reading first, then the 3-hour forecast points left
 * in the local day. Late in the evening only one or two points remain, so the series continues into the next day
 * until it has at least `minPoints`, which keeps the chart meaningful at any hour.
 */
export function todaySeries(current: CurrentWeather, forecast: Forecast, minPoints = 8): TempPoint[] {
  const today = localDateKey(current.dt, current.timezone)
  const upcoming = forecast.points.filter((point) => point.dt > current.dt)
  const series: TempPoint[] = [{ dt: current.dt, temp: current.temp, now: true }]
  for (const point of upcoming) {
    if (localDateKey(point.dt, forecast.timezone) !== today && series.length >= minPoints) break
    series.push({ dt: point.dt, temp: point.temp, now: false })
  }
  return series
}
