import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from './App.vue'
import { useThemeStore } from './stores/theme'

// The shell tests do not need weather; keep requests pending so no network is touched.
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

let wrapper: VueWrapper | undefined

function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(App, { global: { plugins: [pinia] }, attachTo: document.body })
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('wd:settings', JSON.stringify({ v: 1, locale: 'en', theme: 'day' }))
  history.replaceState(null, '', '/')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('App shell', () => {
  it('renders the title, tabs and sets document language and theme', () => {
    const app = mountApp()
    expect(app.find('h1').text()).toBe('Weather Dashboard')
    expect(app.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['Home', 'Favourites'])
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dataset.theme).toBe('day')
  })

  it('switches tabs with the keyboard and keeps the tab in the URL hash', async () => {
    const app = mountApp()
    const [home, favourites] = app.findAll('[role="tab"]')
    expect(home?.attributes('aria-selected')).toBe('true')

    await home?.trigger('keydown', { key: 'ArrowRight' })
    expect(favourites?.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(favourites?.element)
    expect(location.hash).toBe('#/favourites')
    expect(app.find('#panel-favourites').isVisible()).toBe(true)
    expect(app.find('#panel-home').isVisible()).toBe(false)

    await app.find('#panel-favourites .empty button').trigger('click')
    expect(home?.attributes('aria-selected')).toBe('true')
    expect(location.hash).toBe('')
  })

  it('opens on the favourites tab when the URL says so', () => {
    history.replaceState(null, '', '/#/favourites')
    const app = mountApp()
    expect(app.find('#tab-favourites').attributes('aria-selected')).toBe('true')
  })

  it('switches the interface language', async () => {
    const app = mountApp()
    const radios = app.find('[aria-label="Language"]').findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('aria-label'))).toEqual(['English', 'Українська'])

    await radios[1]?.trigger('click')
    await nextTick()
    expect(app.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['Головна', 'Вибране'])
    expect(document.documentElement.lang).toBe('uk')
    await app.find('#tab-favourites').trigger('click')
    expect(app.find('#panel-favourites').text()).toContain('до 5 міст')
  })
})

describe('day and night look', () => {
  it('switches the page look from the header and remembers it', async () => {
    const app = mountApp()
    const group = app.find('[aria-label="Day or night look"]')
    const radios = group.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('aria-label'))).toEqual([
      'Auto: follows the sun in your first city',
      'Day',
      'Night',
    ])

    await radios[2]?.trigger('click')
    expect(document.documentElement.dataset.theme).toBe('night')
    expect(JSON.parse(localStorage.getItem('wd:settings')!).theme).toBe('night')

    await radios[1]?.trigger('click')
    expect(document.documentElement.dataset.theme).toBe('day')
  })

  it('in auto mode follows the sun reported for the first city', async () => {
    localStorage.setItem('wd:settings', JSON.stringify({ v: 1, locale: 'en', theme: 'auto' }))
    mountApp()
    const theme = useThemeStore()
    const noonUtc = Date.UTC(2026, 10, 11, 12) / 1000
    theme.setSun({ sunrise: noonUtc - 5 * 3600, sunset: noonUtc + 4 * 3600, timezone: 0 })
    theme.tick(noonUtc * 1000)
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('day')

    theme.tick((noonUtc + 6 * 3600) * 1000)
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('night')
  })
})
