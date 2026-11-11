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

/** Approximate position of an IP address, with the city name the provider reports when it has one. */
export interface IpLocation extends Coords {
  city?: string
}

const STORAGE_KEY = 'wd:ip-location'
const TIMEOUT_MS = 4000

interface Provider {
  url: string
  parse: (body: unknown) => IpLocation | null
}

function toLocation(lat: number, lon: number, city: unknown): IpLocation | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  const location: IpLocation = { lat, lon }
  if (typeof city === 'string' && city.trim()) location.city = city.trim()
  return location
}

export const PROVIDERS: Provider[] = [
  {
    url: 'https://get.geojs.io/v1/ip/geo.json',
    parse: (body) => {
      const { latitude, longitude, city } = body as GeoJsResponse
      return toLocation(Number(latitude ?? NaN), Number(longitude ?? NaN), city)
    },
  },
  {
    url: 'https://ipapi.co/json/',
    parse: (body) => {
      const data = body as IpApiResponse
      if (data.error) return null
      return toLocation(data.latitude ?? NaN, data.longitude ?? NaN, data.city)
    },
  },
]

function readSession(): IpLocation | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<IpLocation>
    return toLocation(Number(parsed.lat), Number(parsed.lon), parsed.city)
  } catch {
    return null
  }
}

/**
 * Approximate visitor location from open IP-geolocation services, tried in order; null when all fail (ad blockers
 * often block them). Cached for the browser session.
 */
export async function locateByIp(signal?: AbortSignal): Promise<IpLocation | null> {
  const cached = readSession()
  if (cached) return cached

  for (const provider of PROVIDERS) {
    try {
      const location = provider.parse(await getJson<unknown>(provider.url, { signal, timeoutMs: TIMEOUT_MS }))
      if (location) {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(location))
        } catch {
          // Storage can be unavailable (private mode); the lookup still succeeded.
        }
        return location
      }
    } catch {
      if (signal?.aborted) return null
    }
  }
  return null
}
