import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { City } from '@/api/models'
import { useSettingsStore } from '@/stores/settings'
import CitySearch from './CitySearch.vue'

const location = vi.hoisted(() => {
  class GeolocationError extends Error {
    kind: string
    constructor(kind: string) {
      super(kind)
      this.kind = kind
    }
  }
  return { cityFromDevice: vi.fn(), GeolocationError }
})
vi.mock('@/api/location', () => location)
vi.mock('@/api/cities', () => ({ searchCities: () => Promise.resolve([]) }))

const lviv: City = { id: 'l', name: 'Lviv', names: { en: 'Lviv' }, country: 'UA', lat: 49.84, lon: 24.03 }
let wrapper: VueWrapper | undefined

function mountSearch() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().setLocale('en')
  wrapper = mount(CitySearch, { props: { city: null }, global: { plugins: [pinia] } })
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  location.cityFromDevice.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
})

describe('CitySearch location button', () => {
  it('selects the city at the device position', async () => {
    location.cityFromDevice.mockResolvedValue(lviv)
    const search = mountSearch()
    await search.find('[aria-label="Use my location"]').trigger('click')
    await flushPromises()
    expect(search.emitted('select')).toEqual([[lviv]])
  })

  it('explains a blocked permission under the field', async () => {
    location.cityFromDevice.mockRejectedValue(new location.GeolocationError('denied'))
    const search = mountSearch()
    await search.find('[aria-label="Use my location"]').trigger('click')
    await flushPromises()
    expect(search.find('.search__locate-error').text()).toContain('Location access is blocked')
    expect(search.emitted('select')).toBeUndefined()

    await search.find('input').setValue('Ky')
    expect(search.find('.search__locate-error').exists()).toBe(false)
  })
})
