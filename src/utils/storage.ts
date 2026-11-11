/** Read JSON from localStorage and validate it; any missing, corrupt or invalid value yields null. */
export function readStorage<T>(key: string, validate: (value: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : validate(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Write JSON to localStorage; returns false when storage is unavailable or full. */
export function writeStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
