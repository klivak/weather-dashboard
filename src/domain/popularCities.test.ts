import { describe, expect, it } from 'vitest'
import { POPULAR_CITIES, suggestCities } from './popularCities'

describe('popular cities', () => {
  it('have both names and unique ids', () => {
    expect(new Set(POPULAR_CITIES.map((city) => city.id)).size).toBe(POPULAR_CITIES.length)
    for (const city of POPULAR_CITIES) {
      expect(city.names.en).toBeTruthy()
      expect(city.names.uk).toBeTruthy()
    }
  })

  it('suggest only cities not already shown, up to the limit', () => {
    const kyiv = POPULAR_CITIES[0]!.id
    const suggestions = suggestCities([kyiv], 3)
    expect(suggestions).toHaveLength(3)
    expect(suggestions.map((city) => city.id)).not.toContain(kyiv)
  })
})
