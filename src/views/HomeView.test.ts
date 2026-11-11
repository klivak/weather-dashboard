import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { City } from '@/api/models'
import { useAnnouncer } from '@/composables/useAnnouncer'
import { useBlocksStore } from '@/stores/blocks'
import { useSettingsStore } from '@/stores/settings'
import HomeView from './HomeView.vue'

vi.mock('@/api/owm', () => ({
  getCurrentWeather: () => new Promise(() => {}),
  getForecast: () => new Promise(() => {}),
}))
vi.mock('@/api/cities', () => ({
  completeCityNames: (city: City) => Promise.resolve(city),
  searchCities: () => Promise.resolve([]),
}))
const location = vi.hoisted(() => ({ resolveDefaultCity: vi.fn() }))
vi.mock('@/api/location', () => location)

const lviv: City = { id: 'l', name: 'Lviv', names: { en: 'Lviv' }, country: 'UA', lat: 49.84, lon: 24.03 }

let wrapper: VueWrapper | undefined

function mountHome() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().setLocale('en')
  wrapper = mount(HomeView, { global: { plugins: [pinia] }, attachTo: document.body })
  return wrapper
}

const blocks = (home: VueWrapper) => home.findAll('section.block')
const addButton = (home: VueWrapper) => home.find('button.add')
const dialog = () => document.querySelector('dialog')!
const dialogButton = (label: string) =>
  [...dialog().querySelectorAll('button')].find((button) => button.textContent?.trim() === label)!

beforeEach(async () => {
  localStorage.clear()
  const { KYIV } = await import('@/api/ipLocation')
  location.resolveDefaultCity.mockReset().mockResolvedValue({ city: KYIV, source: 'fallback' })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('HomeView', () => {
  it('starts with one block showing the default city and no remove button', async () => {
    const home = mountHome()
    await flushPromises()
    expect(blocks(home)).toHaveLength(1)
    expect(useBlocksStore().blocks[0]?.city?.name).toBe('Kyiv')
    expect(home.find('[aria-label^="Remove"]').exists()).toBe(false)
    expect(addButton(home).text()).toContain('1 of 5')
  })

  it('keeps a restored layout as the user left it', async () => {
    localStorage.setItem('wd:blocks', JSON.stringify({ v: 1, blocks: [{ id: 'a', city: null }] }))
    mountHome()
    await flushPromises()
    expect(useBlocksStore().blocks[0]?.city).toBeNull()
  })

  it('adds blocks up to five, focusing the new search, then explains the limit', async () => {
    const home = mountHome()
    for (let i = 0; i < 4; i++) {
      await addButton(home).trigger('click')
      await flushPromises()
      expect(document.activeElement).toBe(blocks(home).at(-1)?.find('input').element)
    }
    expect(blocks(home)).toHaveLength(5)
    expect(addButton(home).attributes('disabled')).toBeDefined()
    expect(addButton(home).text()).toContain('You can compare up to 5 cities at once')
    expect(addButton(home).text()).toContain('5 of 5')

    await addButton(home).trigger('click')
    expect(blocks(home)).toHaveLength(5)
  })

  it('asks before removing, and Cancel keeps the block', async () => {
    const home = mountHome()
    await flushPromises()
    await addButton(home).trigger('click')
    await nextTick()

    const remove = home.find('[aria-label="Remove Kyiv"]')
    await remove.trigger('click')
    expect(dialog().open).toBe(true)
    expect(dialog().textContent).toContain('Remove Kyiv?')

    dialogButton('Cancel').click()
    await nextTick()
    expect(dialog().open).toBe(false)
    expect(blocks(home)).toHaveLength(2)
  })

  it('removes after confirmation, announces it and moves focus to the add button', async () => {
    const home = mountHome()
    await flushPromises()
    const store = useBlocksStore()
    store.add()
    await store.setCity(store.blocks[1]!.id, lviv)
    await nextTick()

    await home.find('[aria-label="Remove Lviv"]').trigger('click')
    dialogButton('Remove').click()
    await flushPromises()

    expect(store.blocks.map((block) => block.city?.name)).toEqual(['Kyiv'])
    expect(useAnnouncer().message.value).toBe('Lviv removed')
    expect(document.activeElement).toBe(addButton(home).element)
    expect(home.find('[aria-label^="Remove"]').exists()).toBe(false)
  })

  it('names an empty block in the confirmation', async () => {
    const home = mountHome()
    await flushPromises()
    await addButton(home).trigger('click')
    await nextTick()
    await home.find('[aria-label="Remove this block"]').trigger('click')
    expect(dialog().textContent).toContain('Remove this block?')
  })
})

describe('HomeView default city', () => {
  it('shows the city found from the IP address and says so', async () => {
    location.resolveDefaultCity.mockResolvedValue({ city: lviv, source: 'ip' })
    mountHome()
    await flushPromises()
    expect(useBlocksStore().blocks[0]?.city).toEqual(lviv)
    expect(useAnnouncer().message.value).toBe('Showing the weather for Lviv, based on your location.')
  })

  it('shows a detecting state while looking, then the city', async () => {
    let finish: (value: unknown) => void = () => {}
    location.resolveDefaultCity.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const home = mountHome()
    await nextTick()
    expect(home.find('.block__detecting').text()).toBe('Finding your city…')
    expect(home.find('.block__hint').exists()).toBe(false)

    finish({ city: lviv, source: 'ip' })
    await flushPromises()
    expect(home.find('.block__detecting').exists()).toBe(false)
  })

  it('keeps a city the user picked while the lookup was running', async () => {
    let finish: (value: unknown) => void = () => {}
    location.resolveDefaultCity.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    mountHome()
    await nextTick()
    const store = useBlocksStore()
    const odesa = { ...lviv, id: 'o', name: 'Odesa', names: { en: 'Odesa' } }
    await store.setCity(store.blocks[0]!.id, odesa)
    finish({ city: lviv, source: 'ip' })
    await flushPromises()
    expect(store.blocks[0]?.city?.name).toBe('Odesa')
  })

  it('does not look anything up for a returning visitor', async () => {
    localStorage.setItem('wd:blocks', JSON.stringify({ v: 1, blocks: [{ id: 'a', city: lviv }] }))
    mountHome()
    await flushPromises()
    expect(location.resolveDefaultCity).not.toHaveBeenCalled()
  })
})
