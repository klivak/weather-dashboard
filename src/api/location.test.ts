import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './http'
import type * as IpLocationModule from './ipLocation'
import { KYIV } from './ipLocation'
import { cityFromDevice, GeolocationError, resolveDefaultCity } from './location'
import type { City } from './models'

const mocks = vi.hoisted(() => ({ locateByIp: vi.fn(), reverseGeocode: vi.fn(), searchPlaces: vi.fn() }))
vi.mock('./ipLocation', async (importOriginal) => ({
  ...(await importOriginal<typeof IpLocationModule>()),
  locateByIp: mocks.locateByIp,
}))
vi.mock('./owm', () => ({ reverseGeocode: mocks.reverseGeocode }))
vi.mock('./geocoding', () => ({ searchPlaces: mocks.searchPlaces }))

const lviv: City = {
  id: 'l',
  name: 'Lviv',
  names: { en: 'Lviv', uk: 'Львів' },
  country: 'UA',
  lat: 49.84,
  lon: 24.03,
}

beforeEach(() => {
  mocks.locateByIp.mockReset()
  mocks.reverseGeocode.mockReset()
  mocks.searchPlaces.mockReset().mockResolvedValue([])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveDefaultCity', () => {
  it('prefers the city the IP service names, matched near the reported point', async () => {
    const kyiv = { ...lviv, id: 'k', name: 'Kyiv', names: { en: 'Kyiv', uk: 'Київ' }, lat: 50.45, lon: 30.52 }
    const kyivUs = { ...kyiv, id: 'us', lat: 48.25, lon: -101.5 }
    mocks.locateByIp.mockResolvedValue({ lat: 50.458, lon: 30.53, city: 'Kyiv' })
    mocks.searchPlaces.mockResolvedValue([kyivUs, kyiv])
    await expect(resolveDefaultCity()).resolves.toEqual({ city: kyiv, source: 'ip' })
    expect(mocks.searchPlaces).toHaveBeenCalledWith('Kyiv', 'en', undefined)
    expect(mocks.reverseGeocode).not.toHaveBeenCalled()
  })

  it('reverse-geocodes the point when the named city is not nearby', async () => {
    mocks.locateByIp.mockResolvedValue({ lat: 49.84, lon: 24.03, city: 'Springfield' })
    mocks.searchPlaces.mockResolvedValue([{ ...lviv, id: 's', lat: 39.8, lon: -89.6 }])
    mocks.reverseGeocode.mockResolvedValue(lviv)
    await expect(resolveDefaultCity()).resolves.toEqual({ city: lviv, source: 'ip' })
  })

  it('names the IP location with reverse geocoding', async () => {
    mocks.locateByIp.mockResolvedValue({ lat: 49.84, lon: 24.03 })
    mocks.reverseGeocode.mockResolvedValue(lviv)
    await expect(resolveDefaultCity()).resolves.toEqual({ city: lviv, source: 'ip' })
    expect(mocks.reverseGeocode).toHaveBeenCalledWith({ lat: 49.84, lon: 24.03 }, undefined)
  })

  it('falls back to Kyiv when the IP lookup or the naming fails', async () => {
    mocks.locateByIp.mockResolvedValueOnce(null)
    await expect(resolveDefaultCity()).resolves.toEqual({ city: KYIV, source: 'fallback' })

    mocks.locateByIp.mockResolvedValueOnce({ lat: 1, lon: 2 })
    mocks.reverseGeocode.mockRejectedValueOnce(new ApiError('not-found', 'nothing here'))
    await expect(resolveDefaultCity()).resolves.toEqual({ city: KYIV, source: 'fallback' })
  })

  it('passes aborts through', async () => {
    mocks.locateByIp.mockRejectedValue(new ApiError('aborted', 'stop'))
    await expect(resolveDefaultCity()).rejects.toMatchObject({ kind: 'aborted' })
  })
})

describe('cityFromDevice', () => {
  function stubGeolocation(impl: (success: PositionCallback, failure: PositionErrorCallback) => void) {
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: impl } })
  }

  it('reverse-geocodes the device position', async () => {
    stubGeolocation((success) =>
      success({ coords: { latitude: 49.84, longitude: 24.03 } } as GeolocationPosition),
    )
    mocks.reverseGeocode.mockResolvedValue(lviv)
    await expect(cityFromDevice()).resolves.toBe(lviv)
  })

  it('reports a blocked permission and other failures', async () => {
    stubGeolocation((_success, failure) =>
      failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    )
    await expect(cityFromDevice()).rejects.toEqual(new GeolocationError('denied'))

    stubGeolocation((_success, failure) =>
      failure({ code: 3, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    )
    await expect(cityFromDevice()).rejects.toMatchObject({ kind: 'unavailable' })

    stubGeolocation((success) => success({ coords: { latitude: 0, longitude: 0 } } as GeolocationPosition))
    mocks.reverseGeocode.mockRejectedValueOnce(new ApiError('not-found', 'sea'))
    await expect(cityFromDevice()).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('reports browsers without geolocation', async () => {
    vi.stubGlobal('navigator', {})
    await expect(cityFromDevice()).rejects.toMatchObject({ kind: 'unsupported' })
  })
})
