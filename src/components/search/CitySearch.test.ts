import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import type { City } from '@/api/models'
import { useSettingsStore } from '@/stores/settings'
import CitySearch from './CitySearch.vue'

const searchCities = vi.hoisted(() => vi.fn())
vi.mock('@/api/cities', () => ({ searchCities }))

const lviv: City = {
  id: '49.84,24.03',
  name: 'Lviv',
  names: { en: 'Lviv', uk: 'Львів' },
  country: 'UA',
  state: 'Lviv Oblast',
  lat: 49.84,
  lon: 24.03,
}
const lvivka: City = { id: '1.00,2.00', name: 'Lvivka', names: {}, country: 'UA', lat: 1, lon: 2 }

let wrapper: VueWrapper | undefined

function mountSearch(city: City | null = null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().setLocale('en')
  wrapper = mount(CitySearch, { props: { city }, global: { plugins: [pinia] }, attachTo: document.body })
  return wrapper
}

async function type(app: VueWrapper, text: string) {
  const input = app.find('input')
  await input.trigger('focus')
  await input.setValue(text)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers()
  searchCities.mockReset()
  localStorage.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('CitySearch', () => {
  it('is an accessible combobox showing the current city name', () => {
    const app = mountSearch(lviv)
    const input = app.find('input')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-expanded')).toBe('false')
    expect((input.element as HTMLInputElement).value).toBe('Lviv')
    expect(app.find('label').text()).toBe('City')
  })

  it('suggests cities with highlighted match and region, and picks with the keyboard', async () => {
    searchCities.mockResolvedValue([lviv, lvivka])
    const app = mountSearch()
    await type(app, 'lv')

    const input = app.find('input')
    expect(input.attributes('aria-expanded')).toBe('true')
    const options = app.findAll('[role="option"]')
    expect(options).toHaveLength(2)
    expect(options[0]?.find('mark').text()).toBe('Lv')
    expect(options[0]?.text()).toContain('Lviv Oblast, Ukraine')
    expect(options[0]?.attributes('aria-selected')).toBe('true')
    expect(input.attributes('aria-activedescendant')).toBe(options[0]?.attributes('id'))

    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(options[1]?.attributes('aria-selected')).toBe('true')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(options[0]?.attributes('aria-selected')).toBe('true')
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(app.emitted('select')).toEqual([[lvivka]])
    expect((input.element as HTMLInputElement).value).toBe('Lvivka')
    expect(input.attributes('aria-expanded')).toBe('false')
  })

  it('picks with the mouse', async () => {
    searchCities.mockResolvedValue([lviv])
    const app = mountSearch()
    await type(app, 'Lviv')
    await app.find('[role="option"]').trigger('click')
    expect(app.emitted('select')).toEqual([[lviv]])
  })

  it('shows the Ukrainian name when the interface is Ukrainian', async () => {
    searchCities.mockResolvedValue([lviv])
    const app = mountSearch()
    useSettingsStore().setLocale('uk')
    await type(app, 'Льв')
    expect(app.find('[role="option"]').text()).toContain('Львів')
    expect(app.find('mark').text()).toBe('Льв')
  })

  it('tells the user when nothing matches', async () => {
    searchCities.mockResolvedValue([])
    const app = mountSearch()
    await type(app, 'Qwxz')
    expect(app.find('.search__note').text()).toContain('No cities found for “Qwxz”')
    expect(app.find('[role="status"]').text()).toContain('No cities found')
  })

  it('shows an error with a working retry', async () => {
    searchCities.mockRejectedValueOnce(new ApiError('network', 'offline')).mockResolvedValueOnce([lviv])
    const app = mountSearch()
    await type(app, 'Lviv')
    expect(app.find('.search__note--error').text()).toContain('offline')

    await app.find('.search__retry').trigger('click')
    await flushPromises()
    expect(app.findAll('[role="option"]')).toHaveLength(1)
  })

  it('Escape closes the list, a second Escape restores the current city', async () => {
    searchCities.mockResolvedValue([lvivka])
    const app = mountSearch(lviv)
    await type(app, 'Lvivk')
    const input = app.find('input')

    await input.trigger('keydown', { key: 'Escape' })
    expect(input.attributes('aria-expanded')).toBe('false')
    expect((input.element as HTMLInputElement).value).toBe('Lvivk')

    await input.trigger('keydown', { key: 'Escape' })
    expect((input.element as HTMLInputElement).value).toBe('Lviv')
    expect(app.emitted('select')).toBeUndefined()
  })

  it('does not search for a single character', async () => {
    const app = mountSearch()
    await type(app, 'L')
    expect(searchCities).not.toHaveBeenCalled()
    expect(app.find('input').attributes('aria-expanded')).toBe('false')
  })
})
