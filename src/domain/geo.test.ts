import { describe, expect, it } from 'vitest'
import { distanceKm, nearestWithin } from './geo'

const kyiv = { lat: 50.4501, lon: 30.5234 }
const lviv = { lat: 49.8397, lon: 24.0297 }

describe('geo', () => {
  it('measures great-circle distance', () => {
    expect(distanceKm(kyiv, lviv)).toBeGreaterThan(465)
    expect(distanceKm(kyiv, lviv)).toBeLessThan(475)
    expect(distanceKm(kyiv, kyiv)).toBe(0)
  })

  it('picks the nearest candidate only within the radius', () => {
    const candidates = [
      { name: 'Kyiv, North Dakota', lat: 48.25, lon: -101.5 },
      { name: 'Kyiv', lat: 50.45, lon: 30.52 },
    ]
    expect(nearestWithin(candidates, { lat: 50.458, lon: 30.53 }, 75)?.name).toBe('Kyiv')
    expect(nearestWithin(candidates, lviv, 75)).toBeUndefined()
    expect(nearestWithin([], kyiv, 75)).toBeUndefined()
  })
})
