import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { ApiError } from '@/api/http'
import type { City } from '@/api/models'
import { useCitySearch } from './useCitySearch'

const searchCities = vi.hoisted(() => vi.fn())
vi.mock('@/api/cities', () => ({ searchCities }))

const lviv: City = {
  id: '49.84,24.03',
  name: 'Lviv',
  names: { uk: 'Львів' },
  country: 'UA',
  lat: 49.84,
  lon: 24.03,
}

function setup() {
  const scope = effectScope()
  const search = scope.run(() => useCitySearch({ delayMs: 300, locale: () => 'uk' }))!
  return { scope, search }
}

beforeEach(() => {
  vi.useFakeTimers()
  searchCities.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCitySearch', () => {
  it('debounces typing and searches once with the trimmed query', async () => {
    searchCities.mockResolvedValue([lviv])
    const { search } = setup()

    search.query.value = 'Lv'
    await nextTick()
    expect(search.status.value).toBe('loading')
    search.query.value = ' Lviv '
    await nextTick()
    await vi.advanceTimersByTimeAsync(299)
    expect(searchCities).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(searchCities).toHaveBeenCalledTimes(1)
    expect(searchCities.mock.calls[0]?.slice(0, 2)).toEqual(['Lviv', 'uk'])
    expect(search.status.value).toBe('success')
    expect(search.results.value).toEqual([lviv])
    expect(search.resultsFor.value).toBe('Lviv')
  })

  it('stays idle below two characters', async () => {
    const { search } = setup()
    search.query.value = 'L'
    await nextTick()
    await vi.advanceTimersByTimeAsync(500)
    expect(search.status.value).toBe('idle')
    expect(searchCities).not.toHaveBeenCalled()
  })

  it('aborts the previous request and ignores its late answer', async () => {
    let resolveFirst: (cities: City[]) => void = () => {}
    searchCities
      .mockImplementationOnce(
        () =>
          new Promise<City[]>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce([])
    const { search } = setup()

    search.query.value = 'Lv'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    const firstSignal = searchCities.mock.calls[0]?.[2] as AbortSignal

    search.query.value = 'Kyiv'
    await nextTick()
    expect(firstSignal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(300)
    resolveFirst([lviv])
    await vi.runAllTimersAsync()

    expect(search.results.value).toEqual([])
    expect(search.resultsFor.value).toBe('Kyiv')
  })

  it('reports errors and retries', async () => {
    searchCities.mockRejectedValueOnce(new ApiError('network', 'offline')).mockResolvedValueOnce([lviv])
    const { search } = setup()

    search.query.value = 'Lviv'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(search.status.value).toBe('error')
    expect(search.errorKind.value).toBe('network')

    search.retry()
    await vi.runAllTimersAsync()
    expect(search.status.value).toBe('success')
  })

  it('sets text quietly without searching', async () => {
    const { search } = setup()
    search.setQuietly('Львів')
    await nextTick()
    await vi.advanceTimersByTimeAsync(500)
    expect(search.query.value).toBe('Львів')
    expect(searchCities).not.toHaveBeenCalled()
    expect(search.status.value).toBe('idle')
  })

  it('cancels pending work when the scope is disposed', async () => {
    const { scope, search } = setup()
    search.query.value = 'Lviv'
    await nextTick()
    scope.stop()
    await vi.advanceTimersByTimeAsync(500)
    expect(searchCities).not.toHaveBeenCalled()
  })
})
