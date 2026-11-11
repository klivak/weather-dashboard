// Allow-listed proxy to OpenWeatherMap that adds the secret API key on the server.

type Validator = (value: string) => string | null

/** Coordinates must be numbers in range; rounding to 2 decimals (~1 km) also makes the edge cache hit far more often. */
function coordinate(limit: number): Validator {
  return (value) => {
    const number = Number(value)
    if (value.trim() === '' || !Number.isFinite(number) || Math.abs(number) > limit) return null
    return (Math.round(number * 100) / 100).toString()
  }
}

const oneOf =
  (...allowed: string[]): Validator =>
  (value) =>
    allowed.includes(value) ? value : null

const VALIDATORS: Record<string, Validator> = {
  lat: coordinate(90),
  lon: coordinate(180),
  units: oneOf('metric'),
  lang: oneOf('en', 'uk'),
  limit: oneOf('1', '2', '3', '4', '5'),
  q: (value) => {
    const query = value.trim()
    return query.length >= 2 && query.length <= 80 ? query : null
  },
}

interface Route {
  /** Params the route needs (all required and validated); anything else in the request is dropped. */
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

/** A user-requested refresh: browsers send `Cache-Control: no-cache` for fetch(..., { cache: 'reload' }). */
function wantsFresh(request: Request): boolean {
  return /\bno-cache\b/.test(request.headers.get('Cache-Control') ?? '')
}

type CloudflareInit = RequestInit & {
  cf?: { cacheEverything?: boolean; cacheTtlByStatus?: Record<string, number> }
}

/**
 * Forward an allowed GET to OpenWeatherMap with validated params plus the key. Every param of a route is required
 * and checked (numbers in range, known languages and units), so the key cannot be used for arbitrary queries.
 * Successful answers are cached at the Cloudflare edge; errors never are. Volume abuse with valid requests is
 * left to a Cloudflare rate-limiting rule on /api/* (see README).
 */
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
    const raw = incoming.get(name)
    const value = raw === null ? null : (VALIDATORS[name]?.(raw) ?? null)
    if (value === null) return json({ message: `Invalid or missing parameter: ${name}` }, 400)
    upstream.searchParams.set(name, value)
  }
  upstream.searchParams.set('appid', apiKey)

  let response: Response
  try {
    const init: CloudflareInit = { headers: { Accept: 'application/json' } }
    if (!wantsFresh(request)) {
      init.cf = { cacheEverything: true, cacheTtlByStatus: { '200-299': route.maxAge, '300-599': 0 } }
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
