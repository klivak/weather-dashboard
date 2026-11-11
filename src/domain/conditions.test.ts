import { describe, expect, it } from 'vitest'
import { conditionKind, isDayIcon } from './conditions'

describe('conditionKind', () => {
  it.each([
    [211, 'thunder'],
    [301, 'drizzle'],
    [500, 'rain'],
    [511, 'sleet'],
    [522, 'rain'],
    [601, 'snow'],
    [613, 'sleet'],
    [741, 'mist'],
    [800, 'clear'],
    [801, 'partly'],
    [802, 'partly'],
    [803, 'cloudy'],
    [804, 'overcast'],
    [999, 'clear'],
  ] as const)('%i → %s', (id, kind) => {
    expect(conditionKind(id)).toBe(kind)
  })

  it('reads day or night from the icon code', () => {
    expect(isDayIcon('01d')).toBe(true)
    expect(isDayIcon('04n')).toBe(false)
  })
})
