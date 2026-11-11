import { describe, expect, it, vi } from 'vitest'
import { proxyOwm } from './owmProxy'

const KEY = 'test-key'

function upstreamOk(body: unknown = { ok: true }) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
}

describe('proxyOwm', () => {
  it('forwards only allowed params and adds the key', async () => {
    const fetchImpl = upstreamOk()
    const request = new Request(
      'https://site.dev/api/owm/data/2.5/weather?lat=1&lon=2&units=metric&lang=uk&appid=evil&mode=xml',
    )
    const response = await proxyOwm(request, 'data/2.5/weather', KEY, fetchImpl)

    const upstream = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(upstream.origin).toBe('https://api.openweathermap.org')
    expect(upstream.pathname).toBe('/data/2.5/weather')
    expect(Object.fromEntries(upstream.searchParams)).toEqual({
      lat: '1',
      lon: '2',
      units: 'metric',
      lang: 'uk',
      appid: KEY,
    })
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ cf: { cacheTtl: 600, cacheEverything: true } })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=600')
    await expect(response.json()).resolves.toEqual({ ok: true })
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
    const denied = await proxyOwm(new Request('https://site.dev/x?q=Kyiv'), 'geo/1.0/direct', KEY, fetchImpl)
    expect(denied.status).toBe(401)
    expect(denied.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 502 when the upstream is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('down'))
    const response = await proxyOwm(new Request('https://site.dev/x'), 'geo/1.0/direct', KEY, fetchImpl)
    expect(response.status).toBe(502)
  })
})
