import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { City } from '@/api/models'
import { FAVOURITES_KEY, useFavouritesStore } from './favourites'

const completeCityNames = vi.hoisted(() => vi.fn())
vi.mock('@/api/cities', () => ({ completeCityNames }))

function city(n: number): City {
  return { id: `c${n}`, name: `City ${n}`, names: { en: `City ${n}` }, country: 'UA', lat: n, lon: n }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  completeCityNames.mockReset().mockImplementation((c: City) => Promise.resolve(c))
})

describe('favourites store', () => {
  it('toggles a city in and out', () => {
    const store = useFavouritesStore()
    expect(store.toggle(city(1))).toBe('added')
    expect(store.isFavourite('c1')).toBe(true)
    expect(store.add(city(1))).toBe('exists')
    expect(store.toggle(city(1))).toBe('removed')
    expect(store.isFavourite('c1')).toBe(false)
    expect(store.isFavourite(undefined)).toBe(false)
  })

  it('holds a sixth city as pending instead of adding it', () => {
    const store = useFavouritesStore()
    for (let n = 1; n <= 5; n++) store.add(city(n))
    expect(store.isFull).toBe(true)

    expect(store.toggle(city(6))).toBe('full')
    expect(store.cities).toHaveLength(5)
    expect(store.pending?.id).toBe('c6')

    store.cancelPending()
    expect(store.pending).toBeNull()
    expect(store.cities).toHaveLength(5)
  })

  it('swaps a saved city for the pending one', () => {
    const store = useFavouritesStore()
    for (let n = 1; n <= 5; n++) store.add(city(n))
    store.add(city(6))

    expect(store.replace('missing')).toBe(false)
    expect(store.replace('c2')).toBe(true)
    expect(store.cities.map((c) => c.id)).toEqual(['c1', 'c3', 'c4', 'c5', 'c6'])
    expect(store.pending).toBeNull()
    expect(store.replace('c1')).toBe(false)
  })

  it('fills in a missing translation after adding', async () => {
    completeCityNames.mockImplementation((c: City) =>
      Promise.resolve({ ...c, names: { ...c.names, uk: 'Місто' } }),
    )
    const store = useFavouritesStore()
    store.add(city(1))
    await flushPromises()
    expect(store.cities[0]?.names).toEqual({ en: 'City 1', uk: 'Місто' })
  })

  it('persists, and drops invalid, duplicate and extra entries on load', async () => {
    const store = useFavouritesStore()
    store.add(city(1))
    await nextTick()
    expect(JSON.parse(localStorage.getItem(FAVOURITES_KEY)!)).toEqual({ v: 1, cities: [city(1)] })

    localStorage.setItem(
      FAVOURITES_KEY,
      JSON.stringify({ v: 1, cities: [city(1), city(1), { bad: true }, ...[2, 3, 4, 5, 6, 7].map(city)] }),
    )
    setActivePinia(createPinia())
    expect(useFavouritesStore().cities.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5'])
  })
})
