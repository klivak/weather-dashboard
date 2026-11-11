import { describe, expect, it } from 'vitest'
import { highlightParts } from './highlight'

describe('highlightParts', () => {
  it('marks the first case-insensitive match', () => {
    expect(highlightParts('Lviv', 'lv')).toEqual([
      { text: 'Lv', match: true },
      { text: 'iv', match: false },
    ])
    expect(highlightParts('Біла Церква', ' церк')).toEqual([
      { text: 'Біла ', match: false },
      { text: 'Церк', match: true },
      { text: 'ва', match: false },
    ])
  })

  it('returns the whole text when nothing matches', () => {
    expect(highlightParts('Kyiv', 'Київ')).toEqual([{ text: 'Kyiv', match: false }])
    expect(highlightParts('Kyiv', '  ')).toEqual([{ text: 'Kyiv', match: false }])
  })
})
