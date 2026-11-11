import type { Condition, CurrentWeather, Forecast, ForecastPoint } from '@/api/models'

/** What a weather block shows: today (card + hourly chart) or five days (daily list + daily chart). */
export type ForecastView = 'day' | 'week'

export function isForecastView(value: unknown): value is ForecastView {
  return value === 'day' || value === 'week'
}

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

export interface DaySummary {
  /** Local date, YYYY-MM-DD. */
  date: string
  /** A moment inside that local day (its first forecast point), for formatting. */
  dt: number
  /** Mean of the day's 3-hour temperatures. */
  avg: number
  min: number
  max: number
  /** Highest chance of precipitation in the day, 0..1. */
  pop: number
  humidity: number
  windSpeed: number
  condition: Condition
  /** How many 3-hour points the day is based on (the first day is often partial). */
  samples: number
}

function mostFrequent(conditions: Condition[]): Condition | undefined {
  const counts = new Map<number, { condition: Condition; count: number }>()
  for (const condition of conditions) {
    const entry = counts.get(condition.id)
    if (entry) entry.count += 1
    else counts.set(condition.id, { condition, count: 1 })
  }
  let best: { condition: Condition; count: number } | undefined
  // Ties go to the more severe condition: precipitation (2xx thunder first, then drizzle, rain, snow) outranks
  // clouds (804 > 801), which outrank mist and clear sky.
  const severity = (id: number) => (id < 700 ? 2000 - id : id >= 801 ? id : id === 800 ? 0 : 1)
  for (const entry of counts.values()) {
    if (
      !best ||
      entry.count > best.count ||
      (entry.count === best.count && severity(entry.condition.id) > severity(best.condition.id))
    ) {
      best = entry
    }
  }
  return best?.condition
}

/**
 * One summary per local day of the 5-day / 3-hour forecast, at most `days` of them, starting with today when it
 * still has points. The day's temperature is the mean of its points; its icon is the most frequent daytime
 * condition (any condition when the day has no daytime points left).
 */
export function dailySummaries(forecast: Forecast, days = 5): DaySummary[] {
  const groups = new Map<string, ForecastPoint[]>()
  for (const point of forecast.points) {
    const key = localDateKey(point.dt, forecast.timezone)
    const group = groups.get(key)
    if (group) group.push(point)
    else groups.set(key, [point])
  }

  const summaries: DaySummary[] = []
  for (const [date, points] of groups) {
    if (summaries.length === days) break
    const temps = points.map((point) => point.temp)
    const daytime = points.filter((point) => point.isDay).map((point) => point.condition)
    const condition = mostFrequent(daytime.length ? daytime : points.map((point) => point.condition))
    summaries.push({
      date,
      dt: points[0]!.dt,
      avg: temps.reduce((sum, temp) => sum + temp, 0) / temps.length,
      min: Math.min(...points.map((point) => point.tempMin), ...temps),
      max: Math.max(...points.map((point) => point.tempMax), ...temps),
      pop: Math.max(...points.map((point) => point.pop)),
      humidity: Math.round(points.reduce((sum, point) => sum + point.humidity, 0) / points.length),
      windSpeed: points.reduce((sum, point) => sum + point.windSpeed, 0) / points.length,
      condition: condition ?? points[0]!.condition,
      samples: points.length,
    })
  }
  return summaries
}
