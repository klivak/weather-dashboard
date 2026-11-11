export interface SunTimes {
  /** Unix seconds (UTC). */
  sunrise: number
  sunset: number
  /** City offset from UTC in seconds. */
  timezone: number
}

const DAY = 86_400

function timeOfDay(unix: number, timezone: number): number {
  return (((unix + timezone) % DAY) + DAY) % DAY
}

/**
 * Whether it is daytime in the city at `now` (unix seconds). Compares local time of day with the sunrise and sunset
 * times, so a forecast fetched yesterday still gives the right answer today. Polar day or night (sunrise equal to
 * sunset) counts as day.
 */
export function isDaylight(now: number, sun: SunTimes): boolean {
  const current = timeOfDay(now, sun.timezone)
  const rise = timeOfDay(sun.sunrise, sun.timezone)
  const set = timeOfDay(sun.sunset, sun.timezone)
  if (rise === set) return true
  return rise < set ? current >= rise && current < set : current >= rise || current < set
}

/** Without sun data: daytime from 07:00 to 19:00 on the device clock. */
export function isDaylightByClock(date: Date): boolean {
  const hour = date.getHours()
  return hour >= 7 && hour < 19
}
