import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import type { City, CurrentWeather, Forecast } from '@/api/models'
import { useSettingsStore } from '@/stores/settings'
import WeatherBlock from './WeatherBlock.vue'

const api = vi.hoisted(() => ({ getCurrentWeather: vi.fn(), getForecast: vi.fn() }))
vi.mock('@/api/owm', () => api)

const lviv: City = {
  id: '49.84,24.03',
  name: 'Lviv',
  names: { en: 'Lviv', uk: 'Львів' },
  country: 'UA',
  state: 'Lviv Oblast',
  states: { en: 'Lviv Oblast', uk: 'Львівська область' },
  lat: 49.84,
  lon: 24.03,
}

const TZ = 7200
const NOW = Date.UTC(2026, 10, 11, 12, 0) / 1000 // 14:00 in Lviv

const current: CurrentWeather = {
  dt: NOW,
  timezone: TZ,
  sunrise: Date.UTC(2026, 10, 11, 5, 12) / 1000,
  sunset: Date.UTC(2026, 10, 11, 14, 31) / 1000,
  temp: -2.6,
  feelsLike: -6.2,
  tempMin: -4,
  tempMax: -1,
  humidity: 81,
  pressure: 1016,
  windSpeed: 3.64,
  windDeg: 250,
  clouds: 75,
  visibility: 8500,
  condition: { id: 600, main: 'Snow', description: 'light snow', icon: '13d' },
}

const forecast: Forecast = {
  timezone: TZ,
  sunrise: 0,
  sunset: 0,
  points: Array.from({ length: 10 }, (_, i) => ({
    dt: NOW + 3600 + i * 3 * 3600,
    temp: -2 + i,
    feelsLike: -4,
    tempMin: -3,
    tempMax: -1,
    humidity: 80,
    windSpeed: 3,
    pop: 0.2,
    isDay: true,
    condition: { id: 600, main: 'Snow', description: 'light snow', icon: '13d' },
  })),
}

let wrapper: VueWrapper | undefined

function mountBlock(city: City | null = lviv, locale: 'en' | 'uk' = 'en') {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().setLocale(locale)
  wrapper = mount(WeatherBlock, {
    props: { city },
    global: {
      plugins: [pinia],
      stubs: {
        TempChart: {
          name: 'TempChart',
          template: '<div class="chart-stub" />',
          props: ['points', 'title', 'summary', 'boundaryIndex', 'boundaryLabel'],
        },
      },
    },
  })
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  api.getCurrentWeather.mockReset().mockResolvedValue(current)
  api.getForecast.mockReset().mockResolvedValue(forecast)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('WeatherBlock', () => {
  it('shows a skeleton while loading, then the card and chart', async () => {
    const block = mountBlock()
    expect(block.find('.skeleton').exists()).toBe(true)
    expect(block.attributes('aria-busy')).toBe('true')

    await flushPromises()
    expect(block.find('.skeleton').exists()).toBe(false)
    expect(block.find('h3').text()).toBe('Lviv')
    expect(block.find('.card__temp .visually-hidden').text()).toBe('−3°')
    expect(block.find('.card__desc').text()).toBe('Light snow')
    expect(block.text()).toContain('Feels like −6°')
    expect(block.find('.card__time').text()).toBe('Wed 11 Nov, 14:00')
    expect(block.text()).toContain('Lviv Oblast')
  })

  it('formats details in the city timezone and locale', async () => {
    const block = mountBlock(lviv, 'uk')
    await flushPromises()
    const details = Object.fromEntries(
      block.findAll('.card__detail').map((item) => [item.find('dt').text(), item.find('dd').text()]),
    )
    expect(details).toEqual({
      Вологість: '81%',
      Вітер: '3,6 м/с Зх',
      Тиск: '1016 гПа',
      Видимість: '8,5 км',
      'Схід сонця': '07:12',
      'Захід сонця': '16:31',
    })
    expect(block.find('h3').text()).toBe('Львів')
    expect(api.getCurrentWeather).toHaveBeenCalledWith(lviv, 'uk', expect.any(AbortSignal), false)
  })

  it('passes today’s series to the chart', async () => {
    const block = mountBlock()
    await flushPromises()
    const points = block.findComponent({ name: 'TempChart' }).props('points') as {
      highlight?: boolean
      label: string
    }[]
    expect(points[0]).toMatchObject({ highlight: true, label: 'Now' })
    // 14:00 local: 15:00, 18:00 and 21:00 remain today, enough for a chart of the current day only.
    expect(points.map((point) => point.label)).toEqual(['Now', '15:00', '18:00', '21:00'])
  })

  it('shows a readable error and retries', async () => {
    api.getCurrentWeather.mockRejectedValueOnce(new ApiError('rate-limit', 'slow'))
    const block = mountBlock()
    await flushPromises()
    expect(block.find('[role="alert"]').text()).toContain('Too many requests')

    await block.find('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(block.find('.card__temp').exists()).toBe(true)
  })

  it('asks for a city when there is none and hides search when not searchable', async () => {
    const empty = mountBlock(null)
    expect(empty.text()).toContain('Search for a city')
    expect(api.getCurrentWeather).not.toHaveBeenCalled()
    empty.unmount()

    const pinia = createPinia()
    setActivePinia(pinia)
    wrapper = mount(WeatherBlock, {
      props: { city: lviv, searchable: false },
      global: { plugins: [pinia], stubs: { TempChart: true } },
    })
    expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
  })
})

describe('WeatherBlock hourly chart', () => {
  it('is about the current day and marks tomorrow only when a late evening borrows its points', async () => {
    const block = mountBlock()
    await flushPromises()
    const chart = block.findComponent({ name: 'TempChart' })
    expect(chart.props('title')).toBe('Temperature today')
    expect(chart.props('boundaryIndex')).toBeUndefined()
    block.unmount()

    // 22:30 local: no points left today, so the chart continues into tomorrow behind a marked boundary.
    api.getCurrentWeather.mockResolvedValue({ ...current, dt: NOW + 8.5 * 3600 })
    const evening = mountBlock()
    await flushPromises()
    const lateChart = evening.findComponent({ name: 'TempChart' })
    expect(lateChart.props('title')).toBe('Temperature today')
    expect(lateChart.props('boundaryIndex')).toBe(1)
    expect(lateChart.props('boundaryLabel')).toBe('Tomorrow')
  })
})

describe('WeatherBlock 5-day view', () => {
  it('switches the card and chart to daily averages and back', async () => {
    const block = mountBlock()
    await flushPromises()
    const [dayRadio, weekRadio] = block.findAll('[role="radio"]')
    expect(dayRadio?.text()).toBe('Day')
    expect(dayRadio?.attributes('aria-checked')).toBe('true')

    await weekRadio?.trigger('click')
    expect(block.find('.card__temp').exists()).toBe(false)
    const rows = block.findAll('.week li')
    // Fixture: 10 points every 3 h from 15:00 local on 11 Nov → two local days.
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('Today')
    expect(rows[0]?.classes()).toContain('day--today')
    expect(rows[1]?.find('.day__name').text()).toBe('Thu')
    expect(rows[0]?.find('.day__avg').attributes('aria-label')).toBe('Average −1°')
    expect(rows[0]?.find('.day__rain').text()).toContain('20%')

    const chart = block.findComponent({ name: 'TempChart' })
    expect(chart.props('title')).toBe('Average temperature by day')
    const points = chart.props('points') as { value: number; min?: number; max?: number; label: string }[]
    // 11 Nov local: 15, 18, 21 h → temps −2, −1, 0 (mean −1); minimum is the reported tempMin −3.
    expect(points[0]).toMatchObject({ label: 'Today', value: -1, min: -3, max: 0 })
    expect(chart.props('summary')).toContain('5-day forecast for Lviv')

    await dayRadio?.trigger('click')
    expect(block.find('.card__temp').exists()).toBe(true)
  })

  it('offers the switch on favourites blocks, which have no search', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    wrapper = mount(WeatherBlock, {
      props: { city: lviv, searchable: false },
      global: { plugins: [pinia], stubs: { TempChart: true } },
    })
    await flushPromises()
    expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
    expect(wrapper.find('[role="radiogroup"]').attributes('aria-label')).toBe('Forecast period')
  })
})

describe('WeatherBlock extras', () => {
  it('shows when the data was updated and refreshes it on demand', async () => {
    const block = mountBlock()
    await flushPromises()
    expect(block.find('.card__meta .stamp').text()).toContain('Updated just now')

    await block.find('[aria-label="Refresh the weather"]').trigger('click')
    await flushPromises()
    expect(api.getCurrentWeather).toHaveBeenLastCalledWith(lviv, 'en', expect.any(AbortSignal), true)
  })

  it('offers popular cities in an empty block', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const odesa: City = { ...lviv, id: 'o', name: 'Odesa', names: { en: 'Odesa', uk: 'Одеса' } }
    wrapper = mount(WeatherBlock, {
      props: { city: null, suggestions: [odesa] },
      global: { plugins: [pinia], stubs: { TempChart: true } },
    })
    const chip = wrapper.find('.block__chip')
    expect(chip.text()).toBe('Odesa')
    await chip.trigger('click')
    expect(wrapper.emitted('update:city')).toEqual([[odesa]])
  })
})
