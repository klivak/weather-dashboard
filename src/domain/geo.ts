import type { Coords } from '@/api/models'

const EARTH_RADIUS_KM = 6371

/** Great-circle distance between two points in kilometres (haversine). */
export function distanceKm(a: Coords, b: Coords): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The candidate closest to `origin`, if it lies within `maxKm`. */
export function nearestWithin<T extends Coords>(
  candidates: T[],
  origin: Coords,
  maxKm: number,
): T | undefined {
  let best: T | undefined
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const distance = distanceKm(origin, candidate)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return bestDistance <= maxKm ? best : undefined
}
