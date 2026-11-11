import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { City } from '@/api/models'
import { MAX_BLOCKS } from '@/domain/limits'
import { BLOCKS_KEY, useBlocksStore } from './blocks'
import { parseCity } from './cityValidation'

const completeCityNames = vi.hoisted(() => vi.fn())
vi.mock('@/api/cities', () => ({ completeCityNames }))

const lviv: City = {
  id: '49.84,24.03',
  geonameId: 702550,
  name: 'Львів',
  names: { uk: 'Львів' },
  country: 'UA',
  lat: 49.84,
  lon: 24.03,
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  completeCityNames.mockReset().mockImplementation((city: City) => Promise.resolve(city))
})

describe('blocks store', () => {
  it('starts with one empty block', () => {
    const store = useBlocksStore()
    expect(store.blocks).toHaveLength(1)
    expect(store.blocks[0]?.city).toBeNull()
    expect(store.restored).toBe(false)
    expect(store.canRemove).toBe(false)
  })

  it(`adds up to ${MAX_BLOCKS} blocks and never removes the last one`, () => {
    const store = useBlocksStore()
    for (let i = 1; i < MAX_BLOCKS; i++) expect(store.add()).not.toBeNull()
    expect(store.blocks).toHaveLength(MAX_BLOCKS)
    expect(store.canAdd).toBe(false)
    expect(store.add()).toBeNull()

    const ids = store.blocks.map((block) => block.id)
    expect(new Set(ids).size).toBe(MAX_BLOCKS)
    for (const id of ids.slice(1)) expect(store.remove(id)).toBe(true)
    expect(store.remove(ids[0]!)).toBe(false)
    expect(store.blocks).toHaveLength(1)
  })

  it('sets a city and fills in its missing translation', async () => {
    completeCityNames.mockImplementation((city: City) =>
      Promise.resolve({ ...city, names: { ...city.names, en: 'Lviv' } }),
    )
    const store = useBlocksStore()
    const id = store.blocks[0]!.id
    const pending = store.setCity(id, lviv)
    expect(store.blocks[0]?.city?.name).toBe('Львів')
    await pending
    expect(store.blocks[0]?.city?.names).toEqual({ uk: 'Львів', en: 'Lviv' })
  })

  it('does not overwrite a newer choice with a late translation', async () => {
    let finish: (city: City) => void = () => {}
    completeCityNames.mockImplementationOnce(
      () =>
        new Promise<City>((resolve) => {
          finish = resolve
        }),
    )
    const store = useBlocksStore()
    const id = store.blocks[0]!.id
    const first = store.setCity(id, lviv)
    const kyiv = { ...lviv, id: 'kyiv', name: 'Kyiv', names: { en: 'Kyiv' } }
    await store.setCity(id, kyiv)
    finish({ ...lviv, names: { uk: 'Львів', en: 'Lviv' } })
    await first
    expect(store.blocks[0]?.city?.id).toBe('kyiv')
  })

  it('persists and restores blocks', async () => {
    const store = useBlocksStore()
    await store.setCity(store.blocks[0]!.id, lviv)
    store.add()
    await nextTick()

    setActivePinia(createPinia())
    const restored = useBlocksStore()
    expect(restored.restored).toBe(true)
    expect(restored.blocks).toHaveLength(2)
    expect(restored.blocks[0]?.city).toEqual(lviv)
    expect(restored.blocks[1]?.city).toBeNull()
    await flushPromises()
  })

  it('drops corrupt entries, duplicates and anything past the limit', () => {
    localStorage.setItem(
      BLOCKS_KEY,
      JSON.stringify({
        v: 1,
        blocks: [
          { id: 'a', city: lviv },
          { id: 'a', city: null },
          { id: 'b', city: { ...lviv, lat: 'x' } },
          { nope: true },
          ...Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, city: null })),
        ],
      }),
    )
    const store = useBlocksStore()
    expect(store.blocks.map((block) => block.id)).toEqual(['a', 'b', 'n0', 'n1', 'n2'])
    expect(store.blocks[1]?.city).toBeNull()
  })

  it('remembers each block’s day / 5-day choice', async () => {
    const store = useBlocksStore()
    const id = store.blocks[0]!.id
    store.setView(id, 'week')
    await nextTick()

    setActivePinia(createPinia())
    expect(useBlocksStore().blocks[0]?.view).toBe('week')

    localStorage.setItem(
      BLOCKS_KEY,
      JSON.stringify({ v: 1, blocks: [{ id: 'a', city: null, view: 'month' }] }),
    )
    setActivePinia(createPinia())
    expect(useBlocksStore().blocks[0]?.view).toBeUndefined()
  })

  it('moves blocks up and down within the list', () => {
    const store = useBlocksStore()
    store.add()
    store.add()
    const [a, b, c] = store.blocks.map((block) => block.id)
    expect(store.move(c!, -1)).toBe(1)
    expect(store.blocks.map((block) => block.id)).toEqual([a, c, b])
    expect(store.move(a!, -1)).toBe(-1)
    expect(store.move(b!, 1)).toBe(-1)
    expect(store.move(a!, 1)).toBe(1)
    expect(store.blocks.map((block) => block.id)).toEqual([c, a, b])
  })

  it('falls back to one block when storage is unreadable', () => {
    localStorage.setItem(BLOCKS_KEY, '{"v":2}')
    expect(useBlocksStore().blocks).toHaveLength(1)
  })
})

describe('parseCity', () => {
  it('keeps only known locales and valid fields', () => {
    expect(
      parseCity({ ...lviv, names: { uk: 'Львів', de: 'Lemberg' }, states: { en: 'Lviv Oblast' } }),
    ).toEqual({
      ...lviv,
      states: { en: 'Lviv Oblast' },
    })
    expect(parseCity({ ...lviv, lat: 91 })).toBeNull()
    expect(parseCity({ ...lviv, names: 'x' })).toBeNull()
    expect(parseCity(null)).toBeNull()
  })
})
