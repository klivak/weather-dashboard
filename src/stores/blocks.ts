import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { completeCityNames } from '@/api/cities'
import type { City } from '@/api/models'
import { isForecastView, type ForecastView } from '@/domain/forecast'
import { MAX_BLOCKS } from '@/domain/limits'
import { isRecord, readStorage, writeStorage } from '@/utils/storage'
import { parseCity } from './cityValidation'

export const BLOCKS_KEY = 'wd:blocks'

export interface WeatherBlockState {
  id: string
  /** null until the user picks a city (or the default city is resolved). */
  city: City | null
  /** Remembered day / 5-day choice; absent means "day". */
  view?: ForecastView
}

interface SavedBlocks {
  v: 1
  blocks: WeatherBlockState[]
}

let counter = 0
export function newBlockId(): string {
  counter += 1
  return globalThis.crypto?.randomUUID?.() ?? `block-${Date.now().toString(36)}-${counter}`
}

function parseBlocks(value: unknown): WeatherBlockState[] | null {
  if (!isRecord(value) || value.v !== 1 || !Array.isArray(value.blocks)) return null
  const blocks: WeatherBlockState[] = []
  const seen = new Set<string>()
  for (const item of value.blocks) {
    if (!isRecord(item) || typeof item.id !== 'string' || seen.has(item.id)) continue
    seen.add(item.id)
    const block: WeatherBlockState = { id: item.id, city: item.city === null ? null : parseCity(item.city) }
    if (isForecastView(item.view)) block.view = item.view
    blocks.push(block)
    if (blocks.length === MAX_BLOCKS) break
  }
  return blocks.length ? blocks : null
}

/**
 * Weather blocks on the home tab. There is always at least one block and never more than MAX_BLOCKS; the list
 * survives reloads.
 */
export const useBlocksStore = defineStore('blocks', () => {
  const saved = readStorage(BLOCKS_KEY, parseBlocks)
  const blocks = ref<WeatherBlockState[]>(saved ?? [{ id: newBlockId(), city: null }])
  /** True when the list came from storage, so the default-city logic can leave the user's choice alone. */
  const restored = saved !== null

  const canAdd = computed(() => blocks.value.length < MAX_BLOCKS)
  const canRemove = computed(() => blocks.value.length > 1)

  function add(): WeatherBlockState | null {
    if (!canAdd.value) return null
    const block: WeatherBlockState = { id: newBlockId(), city: null }
    blocks.value.push(block)
    return block
  }

  function remove(id: string): boolean {
    if (!canRemove.value) return false
    const index = blocks.value.findIndex((block) => block.id === id)
    if (index < 0) return false
    blocks.value.splice(index, 1)
    return true
  }

  /** Undo a removal: put the block back at its old position (if there is still room). */
  function restore(block: WeatherBlockState, index: number): boolean {
    if (!canAdd.value || blocks.value.some((item) => item.id === block.id)) return false
    blocks.value.splice(Math.min(index, blocks.value.length), 0, block)
    return true
  }

  /** Show a city in a block, then quietly add its name in the other language when it is missing. */
  async function setCity(id: string, city: City) {
    const block = blocks.value.find((item) => item.id === id)
    if (!block) return
    block.city = city
    const complete = await completeCityNames(city)
    const current = blocks.value.find((item) => item.id === id)
    if (current?.city?.id === city.id && complete !== city) current.city = complete
  }

  function setView(id: string, view: ForecastView) {
    const block = blocks.value.find((item) => item.id === id)
    if (block) block.view = view
  }

  watch(blocks, (value) => writeStorage(BLOCKS_KEY, { v: 1, blocks: value } satisfies SavedBlocks), {
    deep: true,
  })

  return { blocks, canAdd, canRemove, restored, add, remove, restore, setCity, setView }
})
