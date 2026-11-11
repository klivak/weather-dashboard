// Allow-listed proxy to OpenWeatherMap that adds the secret API key on the server.

interface Route {
  params: readonly string[]
  maxAge: number
}

export const ROUTES: Record<string, Route> = {
  'data/2.5/weather': { params: ['lat', 'lon', 'units', 'lang'], maxAge: 600 },
  'data/2.5/forecast': { params: ['lat', 'lon', 'units', 'lang'], maxAge: 600 },
  'geo/1.0/direct': { params: ['q', 'limit'], maxAge: 86_400 },
  'geo/1.0/reverse': { params: ['lat', 'lon', 'limit'], maxAge: 86_400 },
}

const UPSTREAM = 'https://api.openweathermap.org'

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

/** Forward an allowed GET to OpenWeatherMap with only known params plus the key. */
export async function proxyOwm(
  request: Request,
  path: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'GET') return json({ message: 'Method not allowed' }, 405, { Allow: 'GET' })

  const route = ROUTES[path]
  if (!route) return json({ message: 'Not found' }, 404)
  if (!apiKey) return json({ message: 'Server is missing OWM_API_KEY' }, 500)

  const incoming = new URL(request.url).searchParams
  const upstream = new URL(`${UPSTREAM}/${path}`)
  for (const name of route.params) {
    const value = incoming.get(name)
    if (value !== null) upstream.searchParams.set(name, value.slice(0, 100))
  }
  upstream.searchParams.set('appid', apiKey)

  let response: Response
  try {
    const init: RequestInit & { cf?: { cacheTtl: number; cacheEverything: boolean } } = {
      headers: { Accept: 'application/json' },
      // Cloudflare-only: cache successful upstream answers at the edge for the route's lifetime.
      cf: { cacheTtl: route.maxAge, cacheEverything: true },
    }
    response = await fetchImpl(upstream.toString(), init)
  } catch {
    return json({ message: 'Upstream unreachable' }, 502)
  }

  const cacheControl = response.ok ? `public, max-age=${route.maxAge}` : 'no-store'
  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  })
}
