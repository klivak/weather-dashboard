import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCachedJson } from './cache'
import { ApiError, getJson } from './http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getJson', () => {
  it('parses JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: 1 })))
    await expect(getJson('/x')).resolves.toEqual({ ok: 1 })
  })

  it.each([
    [401, 'unauthorized'],
    [404, 'not-found'],
    [429, 'rate-limit'],
    [500, 'server'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, status)))
    await expect(getJson('/x')).rejects.toMatchObject({ kind, status })
  })

  it('maps a failed fetch to a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(getJson('/x')).rejects.toMatchObject({ kind: 'network' })
  })

  it('reports a caller abort as aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      ),
    )
    const controller = new AbortController()
    const pending = getJson('/x', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toBeInstanceOf(ApiError)
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('reports invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })))
    await expect(getJson('/x')).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('createCachedJson', () => {
  it('deduplicates concurrent requests and serves from cache until expiry', async () => {
    let time = 0
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ n: 1 })))
    vi.stubGlobal('fetch', fetchMock)
    const cached = createCachedJson(1000, () => time)

    await Promise.all([cached('/a'), cached('/a')])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    time = 999
    await cached('/a')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    time = 1001
    await cached('/a')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ n: 2 }))
    vi.stubGlobal('fetch', fetchMock)
    const cached = createCachedJson(1000)

    await expect(cached('/a')).rejects.toMatchObject({ kind: 'server' })
    await expect(cached('/a')).resolves.toEqual({ n: 2 })
  })

  it('lets one caller abort without cancelling the shared request', async () => {
    let resolveFetch: (response: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve
          }),
      ),
    )
    const cached = createCachedJson(1000)
    const controller = new AbortController()

    const first = cached('/a', { signal: controller.signal })
    const second = cached('/a')
    controller.abort()
    resolveFetch(jsonResponse({ n: 3 }))

    await expect(first).rejects.toMatchObject({ kind: 'aborted' })
    await expect(second).resolves.toEqual({ n: 3 })
  })
})
