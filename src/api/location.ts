import { isAbortError } from './http'
import { KYIV, locateByIp } from './ipLocation'
import type { City, Coords } from './models'
import { reverseGeocode } from './owm'

export type DefaultCitySource = 'ip' | 'fallback'

/**
 * The city to show on a first visit: the visitor's city from their IP address (open IP-geolocation services, then
 * OpenWeatherMap reverse geocoding for a proper name in both languages), or Kyiv when any of that fails.
 */
export async function resolveDefaultCity(
  signal?: AbortSignal,
): Promise<{ city: City; source: DefaultCitySource }> {
  try {
    const coords = await locateByIp(signal)
    if (coords) return { city: await reverseGeocode(coords, signal), source: 'ip' }
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
