import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './http'
import type * as IpLocationModule from './ipLocation'
import { KYIV } from './ipLocation'
import { cityFromDevice, GeolocationError, resolveDefaultCity } from './location'
import type { City } from './models'

const mocks = vi.hoisted(() => ({ locateByIp: vi.fn(), reverseGeocode: vi.fn() }))
vi.mock('./ipLocation', async (importOriginal) => ({
  ...(await importOriginal<typeof IpLocationModule>()),
  locateByIp: mocks.locateByIp,
}))
vi.mock('./owm', () => ({ reverseGeocode: mocks.reverseGeocode }))

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
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveDefaultCity', () => {
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
