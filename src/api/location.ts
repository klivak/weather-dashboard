import { nearestWithin } from '@/domain/geo'
import { searchPlaces } from './geocoding'
import { isAbortError } from './http'
import { KYIV, locateByIp } from './ipLocation'
import type { City, Coords } from './models'
import { reverseGeocode } from './owm'

export type DefaultCitySource = 'ip' | 'fallback'

/** IP positions are rough; a named city counts as the visitor's city only this close to the reported point. */
const IP_CITY_RADIUS_KM = 75

/**
 * The city to show on a first visit, from the visitor's IP address:
 * 1. the city name the IP service reports, matched in the geocoder to the place nearest the reported point (IP
 *    coordinates are rough, and naming the point itself often yields a suburb or a village next to the city);
 * 2. otherwise OpenWeatherMap reverse geocoding of the point;
 * 3. Kyiv when the IP lookup fails or is blocked.
 */
export async function resolveDefaultCity(
  signal?: AbortSignal,
): Promise<{ city: City; source: DefaultCitySource }> {
  try {
    const located = await locateByIp(signal)
    if (located) {
      if (located.city) {
        try {
          const matches = await searchPlaces(located.city, 'en', signal)
          const nearest = nearestWithin(matches, located, IP_CITY_RADIUS_KM)
          if (nearest) return { city: nearest, source: 'ip' }
        } catch (error) {
          if (isAbortError(error)) throw error
        }
      }
      return { city: await reverseGeocode(located, signal), source: 'ip' }
    }
  } catch (error) {
    if (isAbortError(error)) throw error
  }
  return { city: KYIV, source: 'fallback' }
}

export type GeolocationErrorKind = 'unsupported' | 'denied' | 'unavailable'

export class GeolocationError extends Error {
  readonly kind: GeolocationErrorKind

  constructor(kind: GeolocationErrorKind) {
    super(`Geolocation ${kind}`)
    this.name = 'GeolocationError'
    this.kind = kind
  }
}

function currentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeolocationError('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) =>
        reject(new GeolocationError(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60 * 1000 },
    )
  })
}

/** The city at the device's position (browser geolocation, asks for permission). */
export async function cityFromDevice(signal?: AbortSignal): Promise<City> {
  const coords = await currentPosition()
  try {
    return await reverseGeocode(coords, signal)
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new GeolocationError('unavailable')
  }
}
