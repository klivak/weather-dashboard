import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useCountUp } from './useCountUp'

let now = 0
let callbacks: FrameRequestCallback[] = []

function frame(ms: number) {
  now += ms
  const run = callbacks
  callbacks = []
  for (const callback of run) callback(now)
}

beforeEach(() => {
  now = 0
  callbacks = []
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => {
    callbacks = []
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useCountUp', () => {
  it('eases from 0 to the value, then between later values', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const source = ref(10)
    const value = effectScope().run(() => useCountUp(() => source.value, 100))!
    expect(value.value).toBe(0)
    frame(50)
    expect(value.value).toBeGreaterThan(5)
    expect(value.value).toBeLessThan(10)
    frame(60)
    expect(value.value).toBe(10)

    source.value = -2
    await nextTick()
    frame(200)
    expect(value.value).toBe(-2)
  })

  it('jumps straight to the value under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const value = effectScope().run(() => useCountUp(() => 7))!
    expect(value.value).toBe(7)
  })
})
