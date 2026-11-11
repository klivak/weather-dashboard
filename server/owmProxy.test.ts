import { describe, expect, it, vi } from 'vitest'
import { proxyOwm } from './owmProxy'

const KEY = 'test-key'
const WEATHER = 'https://site.dev/api/owm/data/2.5/weather'

function upstreamOk(body: unknown = { ok: true }) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
}

describe('proxyOwm', () => {
  it('forwards only validated params, rounds coordinates and adds the key', async () => {
    const fetchImpl = upstreamOk()
    const request = new Request(`${WEATHER}?lat=50.4501&lon=30.5234&units=metric&lang=uk&appid=evil&mode=xml`)
    const response = await proxyOwm(request, 'data/2.5/weather', KEY, fetchImpl)

    const upstream = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(upstream.origin).toBe('https://api.openweathermap.org')
    expect(upstream.pathname).toBe('/data/2.5/weather')
    expect(Object.fromEntries(upstream.searchParams)).toEqual({
      lat: '50.45',
      lon: '30.52',
      units: 'metric',
      lang: 'uk',
      appid: KEY,
    })
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 600, '300-599': 0 } },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=600')
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it.each([
    ['lat out of range', 'lat=91&lon=2&units=metric&lang=en'],
    ['lon not a number', 'lat=1&lon=abc&units=metric&lang=en'],
    ['empty lat', 'lat=&lon=2&units=metric&lang=en'],
    ['unknown units', 'lat=1&lon=2&units=standard&lang=en'],
    ['unknown language', 'lat=1&lon=2&units=metric&lang=de'],
    ['missing language', 'lat=1&lon=2&units=metric'],
  ])('rejects %s with 400 and never calls upstream', async (_case, query) => {
    const fetchImpl = upstreamOk()
    const response = await proxyOwm(new Request(`${WEATHER}?${query}`), 'data/2.5/weather', KEY, fetchImpl)
    expect(response.status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('limits geocoding queries and result counts', async () => {
    const fetchImpl = upstreamOk([])
    const direct = (query: string) =>
      proxyOwm(new Request(`https://site.dev/x?${query}`), 'geo/1.0/direct', KEY, fetchImpl)
    expect((await direct(`q=${'a'.repeat(81)}&limit=5`)).status).toBe(400)
    expect((await direct('q=Kyiv&limit=50')).status).toBe(400)
    expect((await direct('q=Kyiv&limit=5')).status).toBe(200)
  })

  it('skips the edge cache for the request a browser sends on fetch(..., { cache: "reload" })', async () => {
    const fetchImpl = upstreamOk()
    // What Chromium/Firefox/Safari attach for cache mode "reload" (the client's refresh button).
    const request = new Request(`${WEATHER}?lat=1&lon=2&units=metric&lang=en`, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    })
    await proxyOwm(request, 'data/2.5/weather', KEY, fetchImpl)
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty('cf')

    // Mode "no-cache" only sends max-age=0, which must not bypass the edge.
    const revalidate = new Request(`${WEATHER}?lat=1&lon=2&units=metric&lang=en`, {
      headers: { 'Cache-Control': 'max-age=0' },
    })
    await proxyOwm(revalidate, 'data/2.5/weather', KEY, fetchImpl)
    expect(fetchImpl.mock.calls[1]?.[1]).toHaveProperty('cf')
  })

  it('rejects unknown paths and non-GET methods', async () => {
    const fetchImpl = upstreamOk()
    const unknown = await proxyOwm(
      new Request('https://site.dev/api/owm/data/3.0/onecall'),
      'data/3.0/onecall',
      KEY,
      fetchImpl,
    )
    const post = await proxyOwm(
      new Request('https://site.dev/api/owm/geo/1.0/direct', { method: 'POST' }),
      'geo/1.0/direct',
      KEY,
      fetchImpl,
    )
    expect(unknown.status).toBe(404)
    expect(post.status).toBe(405)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails clearly without a key and passes upstream errors through uncached', async () => {
    const missing = await proxyOwm(
      new Request('https://site.dev/x'),
      'geo/1.0/direct',
      undefined,
      upstreamOk(),
    )
    expect(missing.status).toBe(500)

    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"cod":401}', { status: 401 }))
    const denied = await proxyOwm(
      new Request('https://site.dev/x?q=Kyiv&limit=5'),
      'geo/1.0/direct',
      KEY,
      fetchImpl,
    )
    expect(denied.status).toBe(401)
    expect(denied.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 502 when the upstream is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('down'))
    const response = await proxyOwm(
      new Request('https://site.dev/x?q=Kyiv&limit=5'),
      'geo/1.0/direct',
      KEY,
      fetchImpl,
    )
    expect(response.status).toBe(502)
  })
})
