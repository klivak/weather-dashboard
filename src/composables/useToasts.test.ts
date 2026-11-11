import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToasts } from './useToasts'

beforeEach(() => {
  vi.useFakeTimers()
  const { toasts, dismiss } = useToasts()
  for (const toast of [...toasts.value]) dismiss(toast.id)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useToasts', () => {
  it('closes a toast after five seconds, keeping at most three', () => {
    const { toasts, show } = useToasts()
    for (const n of [1, 2, 3, 4]) show(`Toast ${n}`)
    expect(toasts.value.map((toast) => toast.message)).toEqual(['Toast 2', 'Toast 3', 'Toast 4'])
    vi.advanceTimersByTime(5000)
    expect(toasts.value).toHaveLength(0)
  })

  it('stays open while held and closes after release', () => {
    const { toasts, show, hold, release } = useToasts()
    show('Kept')
    hold()
    vi.advanceTimersByTime(10_000)
    expect(toasts.value).toHaveLength(1)
    release()
    vi.advanceTimersByTime(2500)
    expect(toasts.value).toHaveLength(0)
  })

  it('runs the action once and closes the toast', () => {
    const run = vi.fn()
    const { toasts, show, runAction } = useToasts()
    show('Removed', { action: { label: 'Undo', run } })
    runAction(toasts.value[0]!)
    expect(run).toHaveBeenCalledTimes(1)
    expect(toasts.value).toHaveLength(0)
  })
})
