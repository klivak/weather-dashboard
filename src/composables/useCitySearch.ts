import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ApiErrorKind } from '@/api/http'
import { ApiError, isAbortError } from '@/api/http'
import type { City } from '@/api/models'
import { searchCities } from '@/api/owm'

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error'

export interface CitySearchOptions {
  delayMs?: number
  minLength?: number
}

/**
 * Debounced city lookup bound to a query string. Typing shows `loading` immediately, only the latest request wins,
 * and `setQuietly` changes the text (e.g. to the chosen city's name) without searching.
 */
export function useCitySearch({ delayMs = 300, minLength = 2 }: CitySearchOptions = {}) {
  const query = ref('')
  const results = shallowRef<City[]>([])
  const status = ref<SearchStatus>('idle')
  const errorKind = ref<ApiErrorKind | null>(null)
  /** The trimmed query the current results belong to. */
  const resultsFor = ref('')

  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let quietValue: string | null = null

  function cancel() {
    clearTimeout(timer)
    controller?.abort()
    controller = undefined
  }

  async function run(text: string) {
    cancel()
    const current = new AbortController()
    controller = current
    status.value = 'loading'
    errorKind.value = null
    try {
      const found = await searchCities(text, current.signal)
      if (controller !== current) return
      results.value = found
      resultsFor.value = text
      status.value = 'success'
    } catch (error) {
      if (isAbortError(error) || controller !== current) return
      results.value = []
      resultsFor.value = text
      errorKind.value = error instanceof ApiError ? error.kind : 'network'
      status.value = 'error'
    }
  }

  watch(query, (value) => {
    if (quietValue !== null && value === quietValue) {
      quietValue = null
      return
    }
    quietValue = null
    cancel()
    const text = value.trim()
    if (text.length < minLength) {
      results.value = []
      resultsFor.value = ''
      errorKind.value = null
      status.value = 'idle'
      return
    }
    status.value = 'loading'
    timer = setTimeout(() => void run(text), delayMs)
  })

  function setQuietly(value: string) {
    reset()
    if (query.value === value) return
    quietValue = value
    query.value = value
  }

  function reset() {
    cancel()
    results.value = []
    resultsFor.value = ''
    errorKind.value = null
    status.value = 'idle'
  }

  function retry() {
    const text = query.value.trim()
    if (text.length >= minLength) void run(text)
  }

  onScopeDispose(cancel)

  return { query, results, status, errorKind, resultsFor, setQuietly, reset, retry }
}
