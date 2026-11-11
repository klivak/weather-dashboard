import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from './App.vue'

// The shell tests do not need weather; keep requests pending so no network is touched.
vi.mock('@/api/owm', () => ({
  getCurrentWeather: () => new Promise(() => {}),
  getForecast: () => new Promise(() => {}),
}))

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
    const radios = app.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('aria-label'))).toEqual(['English', 'Українська'])

    await radios[1]?.trigger('click')
    await nextTick()
    expect(app.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['Головна', 'Вибране'])
    expect(document.documentElement.lang).toBe('uk')
    expect(app.find('#panel-favourites').text()).toContain('до 5 міст')
  })
})
