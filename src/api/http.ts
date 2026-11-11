export type ApiErrorKind =
  | 'aborted'
  | 'timeout'
  | 'network'
  | 'unauthorized'
  | 'not-found'
  | 'rate-limit'
  | 'server'
  | 'invalid-response'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'aborted'
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 404) return 'not-found'
  if (status === 429) return 'rate-limit'
  return 'server'
}

export interface RequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
  /** Browser HTTP cache mode, e.g. 'no-cache' for a user-requested refresh. */
  cache?: RequestCache
}

const DEFAULT_TIMEOUT_MS = 10_000

/** GET a URL and parse JSON, mapping every failure to a typed ApiError. */
export async function getJson<T>(
  url: string,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS, cache }: RequestOptions = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(url, {
      signal: combined,
      headers: { Accept: 'application/json' },
      ...(cache ? { cache } : {}),
    })
  } catch (error) {
    if (signal?.aborted) throw new ApiError('aborted', 'Request aborted')
    if (timeout.aborted) throw new ApiError('timeout', `Request timed out after ${timeoutMs} ms`)
    throw new ApiError('network', error instanceof Error ? error.message : 'Network error')
  }

  if (!response.ok) {
    throw new ApiError(kindFromStatus(response.status), `HTTP ${response.status}`, response.status)
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('invalid-response', 'Response is not valid JSON', response.status)
  }
}

/** Resolve with the promise unless the signal aborts first; the shared promise itself keeps running. */
export function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(new ApiError('aborted', 'Request aborted'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new ApiError('aborted', 'Request aborted'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}
