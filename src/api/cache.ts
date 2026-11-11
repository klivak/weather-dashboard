import { getJson, withAbort } from './http'

interface Entry {
  expires: number
  promise: Promise<unknown>
}

export interface CachedJsonOptions {
  signal?: AbortSignal
  ttlMs?: number
  /** Ignore cached answers (memory, browser HTTP cache and, via Cache-Control: no-cache, the edge). */
  fresh?: boolean
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

  /** Drop expired entries so a long session does not keep every answer it ever saw. */
  function prune() {
    const time = now()
    for (const [key, entry] of entries) if (entry.expires <= time) entries.delete(key)
  }

  function cached<T>(url: string, options: CachedJsonOptions = {}): Promise<T> {
    const hit = entries.get(url)
    if (hit && hit.expires > now() && !options.fresh)
      return withAbort(hit.promise as Promise<T>, options.signal)

    // "reload" (not "no-cache") is the mode that sends Cache-Control: no-cache, which the proxy reads to skip the edge.
    const promise = getJson<T>(url, options.fresh ? { cache: 'reload' } : {})
    prune()
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
