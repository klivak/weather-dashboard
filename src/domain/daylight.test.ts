import { describe, expect, it } from 'vitest'
import { isDaylight, isDaylightByClock } from './daylight'

const TZ = 7200
/** 2026-11-11 00:00 in Kyiv. */
const MIDNIGHT = Date.UTC(2026, 10, 11) / 1000 - TZ
const at = (hours: number) => MIDNIGHT + hours * 3600
const kyiv = { sunrise: at(7.08), sunset: at(16.3), timezone: TZ }

describe('isDaylight', () => {
  it.each([
    [6.9, false],
    [7.1, true],
    [12, true],
    [16.29, true],
    [16.31, false],
    [23.5, false],
  ])('Kyiv at %f h → %s', (hours, expected) => {
    expect(isDaylight(at(hours), kyiv)).toBe(expected)
  })

  it('still works days after the sun times were fetched', () => {
    expect(isDaylight(at(48 + 12), kyiv)).toBe(true)
    expect(isDaylight(at(72 + 2), kyiv)).toBe(false)
  })

  it('handles a daylight window that crosses UTC midnight in local time', () => {
    // Sunrise 20:00, sunset 04:00 local (only possible with a large offset mismatch); must not invert.
    const odd = { sunrise: at(20), sunset: at(28), timezone: TZ }
    expect(isDaylight(at(22), odd)).toBe(true)
    expect(isDaylight(at(12), odd)).toBe(false)
  })

  it('treats polar day or night as day', () => {
    expect(isDaylight(at(3), { sunrise: at(0), sunset: at(0), timezone: TZ })).toBe(true)
  })
})

describe('isDaylightByClock', () => {
  it('uses 07:00–19:00', () => {
    expect(isDaylightByClock(new Date(2026, 10, 11, 6, 59))).toBe(false)
    expect(isDaylightByClock(new Date(2026, 10, 11, 7, 0))).toBe(true)
    expect(isDaylightByClock(new Date(2026, 10, 11, 19, 0))).toBe(false)
  })
})
