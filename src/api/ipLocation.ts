import { getJson } from './http'
import type { City, Coords } from './models'
import type { GeoJsResponse, IpApiResponse } from './types'

export const KYIV: City = {
  id: '50.45,30.52',
  name: 'Kyiv',
  names: { en: 'Kyiv', uk: 'Київ' },
  country: 'UA',
  lat: 50.4501,
  lon: 30.5234,
}

const STORAGE_KEY = 'wd:ip-location'
const TIMEOUT_MS = 4000

interface Provider {
  url: string
  parse: (body: unknown) => Coords | null
}

function validCoords(lat: number, lon: number): Coords | null {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { lat, lon }
    : null
}

export const PROVIDERS: Provider[] = [
  {
    url: 'https://get.geojs.io/v1/ip/geo.json',
    parse: (body) => {
      const { latitude, longitude } = body as GeoJsResponse
      return validCoords(Number(latitude ?? NaN), Number(longitude ?? NaN))
    },
  },
  {
    url: 'https://ipapi.co/json/',
    parse: (body) => {
      const data = body as IpApiResponse
      if (data.error) return null
      return validCoords(data.latitude ?? NaN, data.longitude ?? NaN)
    },
  },
]

function readSession(): Coords | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Coords>
    return validCoords(Number(parsed.lat), Number(parsed.lon))
  } catch {
    return null
  }
}

/**
 * Approximate visitor coordinates from open IP-geolocation services, tried in order; null when all fail (ad blockers often block them).
 * Cached for the browser session.
 */
export async function locateByIp(signal?: AbortSignal): Promise<Coords | null> {
  const cached = readSession()
  if (cached) return cached

  for (const provider of PROVIDERS) {
    try {
      const coords = provider.parse(await getJson<unknown>(provider.url, { signal, timeoutMs: TIMEOUT_MS }))
      if (coords) {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords))
        } catch {
          // Storage can be unavailable (private mode); the lookup still succeeded.
        }
        return coords
      }
    } catch {
      if (signal?.aborted) return null
    }
  }
  return null
}
