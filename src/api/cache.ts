import { getJson, withAbort } from './http'

interface Entry {
  expires: number
  promise: Promise<unknown>
}

export interface CachedJsonOptions {
  signal?: AbortSignal
  ttlMs?: number
}

export interface CachedJson {
  <T>(url: string, options?: CachedJsonOptions): Promise<T>
  clear(): void
}

/**
 * GET JSON with a time-based cache and in-flight deduplication.
 * The shared request is not tied to any caller's signal, so one caller aborting never cancels the others; failures are not cached.
 */
export function createCachedJson(defaultTtlMs: number, now: () => number = Date.now): CachedJson {
  const entries = new Map<string, Entry>()

  function cached<T>(url: string, options: CachedJsonOptions = {}): Promise<T> {
    const hit = entries.get(url)
    if (hit && hit.expires > now()) return withAbort(hit.promise as Promise<T>, options.signal)

    const promise = getJson<T>(url)
    const entry: Entry = { expires: now() + (options.ttlMs ?? defaultTtlMs), promise }
    entries.set(url, entry)
    promise.catch(() => {
      if (entries.get(url) === entry) entries.delete(url)
    })
    return withAbort(promise, options.signal)
  }

  cached.clear = () => entries.clear()
  return cached
}
