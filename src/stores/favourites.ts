import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { completeCityNames } from '@/api/cities'
import type { City } from '@/api/models'
import { MAX_FAVOURITES } from '@/domain/limits'
import { isRecord, readStorage, writeStorage } from '@/utils/storage'
import { parseCity } from './cityValidation'

export const FAVOURITES_KEY = 'wd:favourites'

export type FavouriteResult = 'added' | 'removed' | 'exists' | 'full'

interface SavedFavourites {
  v: 1
  cities: City[]
}

function parseFavourites(value: unknown): City[] | null {
  if (!isRecord(value) || value.v !== 1 || !Array.isArray(value.cities)) return null
  const cities: City[] = []
  for (const item of value.cities) {
    const city = parseCity(item)
    if (city && !cities.some((saved) => saved.id === city.id)) cities.push(city)
    if (cities.length === MAX_FAVOURITES) break
  }
  return cities
}

/**
 * Favourite cities (max MAX_FAVOURITES, persisted). Adding to a full list does not fail silently: the city waits in
 * `pending` until the user swaps out one of the saved cities (`replace`) or gives up (`cancelPending`).
 */
export const useFavouritesStore = defineStore('favourites', () => {
  const cities = ref<City[]>(readStorage(FAVOURITES_KEY, parseFavourites) ?? [])
  const pending = ref<City | null>(null)

  const ids = computed(() => new Set(cities.value.map((city) => city.id)))
  const isFull = computed(() => cities.value.length >= MAX_FAVOURITES)

  function isFavourite(id: string | undefined): boolean {
    return id !== undefined && ids.value.has(id)
  }

  async function fillNames(city: City) {
    const complete = await completeCityNames(city)
    if (complete === city) return
    const index = cities.value.findIndex((saved) => saved.id === city.id)
    if (index >= 0) cities.value[index] = complete
  }

  function add(city: City): FavouriteResult {
    if (isFavourite(city.id)) return 'exists'
    if (isFull.value) {
      pending.value = city
      return 'full'
    }
    cities.value.push(city)
    void fillNames(city)
    return 'added'
  }

  function remove(id: string): boolean {
    const index = cities.value.findIndex((city) => city.id === id)
    if (index < 0) return false
    cities.value.splice(index, 1)
    return true
  }

  function toggle(city: City): FavouriteResult {
    if (remove(city.id)) return 'removed'
    return add(city)
  }

  /** Swap a saved city for the pending one, keeping the list order otherwise. */
  function replace(removeId: string): boolean {
    const next = pending.value
    if (!next) return false
    const index = cities.value.findIndex((city) => city.id === removeId)
    if (index < 0) return false
    cities.value.splice(index, 1)
    cities.value.push(next)
    pending.value = null
    void fillNames(next)
    return true
  }

  function cancelPending() {
    pending.value = null
  }

  watch(cities, (value) => writeStorage(FAVOURITES_KEY, { v: 1, cities: value } satisfies SavedFavourites), {
    deep: true,
  })

  return { cities, pending, isFull, isFavourite, add, remove, toggle, replace, cancelPending }
})
