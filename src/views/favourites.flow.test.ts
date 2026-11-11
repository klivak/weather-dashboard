import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { City } from '@/api/models'
import App from '@/App.vue'
import { useAnnouncer } from '@/composables/useAnnouncer'
import { useToasts } from '@/composables/useToasts'
import { FAVOURITES_KEY, useFavouritesStore } from '@/stores/favourites'

vi.mock('@/api/owm', () => ({
  getCurrentWeather: () => new Promise(() => {}),
  getForecast: () => new Promise(() => {}),
}))
vi.mock('@/api/location', async () => {
  const { KYIV } = await import('@/api/ipLocation')
  return {
    resolveDefaultCity: () => Promise.resolve({ city: KYIV, source: 'fallback' }),
    cityFromDevice: () => Promise.reject(new Error('not in tests')),
    GeolocationError: class extends Error {},
  }
})
vi.mock('@/api/cities', () => ({
  completeCityNames: (city: City) => Promise.resolve(city),
  searchCities: () => Promise.resolve([]),
}))

function city(n: number, name = `City ${n}`): City {
  return { id: `c${n}`, name, names: { en: name }, country: 'UA', lat: n, lon: n }
}

let wrapper: VueWrapper | undefined

async function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(App, { global: { plugins: [pinia] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const homeBlock = (app: VueWrapper) => app.find('#panel-home section.block')
const favouritesPanel = (app: VueWrapper) => app.find('#panel-favourites')
const dialog = () => [...document.querySelectorAll('dialog')].find((d) => d.open)

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('wd:settings', JSON.stringify({ v: 1, locale: 'en', theme: 'day' }))
  history.replaceState(null, '', '/')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('favourites flow', () => {
  it('stars a city on the home tab and shows it, ringed and without search, under Favourites', async () => {
    const app = await mountApp()
    const star = homeBlock(app).find('[aria-label="Add Kyiv to favourites"]')
    expect(star.attributes('aria-pressed')).toBe('false')
    expect(favouritesPanel(app).find('section.block').exists()).toBe(false)

    await star.trigger('click')
    await flushPromises()
    expect(star.attributes('aria-pressed')).toBe('true')
    expect(star.attributes('aria-label')).toBe('Remove Kyiv from favourites')
    expect(homeBlock(app).classes()).toContain('block--favourite')
    expect(useAnnouncer().message.value).toBe('Kyiv added to favourites. Open?')
    expect(app.find('#tab-favourites').text()).toContain('1')
    expect(JSON.parse(localStorage.getItem(FAVOURITES_KEY)!).cities[0].name).toBe('Kyiv')

    await app.find('#tab-favourites').trigger('click')
    await flushPromises()
    const favBlock = favouritesPanel(app).find('section.block')
    expect(favBlock.classes()).toContain('block--favourite')
    expect(favBlock.find('[role="combobox"]').exists()).toBe(false)

    await favBlock.find('[aria-label="Remove Kyiv from favourites"]').trigger('click')
    await flushPromises()
    expect(favouritesPanel(app).find('section.block').exists()).toBe(false)
    expect(homeBlock(app).classes()).not.toContain('block--favourite')
  })

  it('offers to swap out a saved city when a sixth is starred', async () => {
    localStorage.setItem(
      FAVOURITES_KEY,
      JSON.stringify({ v: 1, cities: [1, 2, 3, 4, 5].map((n) => city(n)) }),
    )
    const app = await mountApp()

    await homeBlock(app).find('[aria-label="Add Kyiv to favourites"]').trigger('click')
    await nextTick()
    const open = dialog()
    expect(open?.textContent).toContain('You already have 5 favourites')
    expect(open?.textContent).toContain('To add Kyiv, remove one of these cities')
    expect(open?.querySelectorAll('li')).toHaveLength(5)

    open?.querySelector<HTMLButtonElement>('[aria-label="Remove City 2 and add Kyiv"]')?.click()
    await flushPromises()
    expect(dialog()).toBeUndefined()
    expect(useFavouritesStore().cities.map((c) => c.name)).toEqual([
      'City 1',
      'City 3',
      'City 4',
      'City 5',
      'Kyiv',
    ])
    expect(useAnnouncer().message.value).toBe('City 2 replaced with Kyiv in favourites')
    expect(homeBlock(app).classes()).toContain('block--favourite')
  })

  it('keeps favourites unchanged when the swap is declined', async () => {
    localStorage.setItem(
      FAVOURITES_KEY,
      JSON.stringify({ v: 1, cities: [1, 2, 3, 4, 5].map((n) => city(n)) }),
    )
    const app = await mountApp()
    await homeBlock(app).find('[aria-label="Add Kyiv to favourites"]').trigger('click')
    await nextTick()

    const keep = [...dialog()!.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Keep as is')
    keep?.click()
    await flushPromises()
    expect(dialog()).toBeUndefined()
    expect(useFavouritesStore().cities).toHaveLength(5)
    expect(useFavouritesStore().pending).toBeNull()
  })
})

describe('favourites tab loading', () => {
  it('renders (and fetches) its blocks only after the tab is first opened', async () => {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify({ v: 1, cities: [city(1)] }))
    const app = await mountApp()
    expect(favouritesPanel(app).find('section.block').exists()).toBe(false)

    await app.find('#tab-favourites').trigger('click')
    await flushPromises()
    expect(favouritesPanel(app).find('section.block').exists()).toBe(true)

    await app.find('#tab-home').trigger('click')
    expect(favouritesPanel(app).find('section.block').exists()).toBe(true)
  })
})

describe('favourites toasts', () => {
  it('offers Undo after removing a favourite', async () => {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify({ v: 1, cities: [city(1)] }))
    const app = await mountApp()
    await app.find('#tab-favourites').trigger('click')
    await flushPromises()
    await favouritesPanel(app).find('[aria-label="Remove City 1 from favourites"]').trigger('click')
    expect(useFavouritesStore().cities).toHaveLength(0)

    const { toasts, runAction } = useToasts()
    const toast = toasts.value.at(-1)!
    expect(toast.action?.label).toBe('Undo')
    runAction(toast)
    expect(useFavouritesStore().cities.map((c) => c.id)).toEqual(['c1'])
  })
})
