import { onScopeDispose, ref, watch } from 'vue'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * A number that eases towards its source value (ease-out cubic) whenever the source changes, starting from 0 the
 * first time. Under reduced motion it jumps straight to the value.
 */
export function useCountUp(source: () => number, durationMs = 700) {
  const value = ref(0)
  let frame = 0

  function animate(to: number) {
    cancelAnimationFrame(frame)
    const from = value.value
    if (prefersReducedMotion() || from === to) {
      value.value = to
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - progress) ** 3
      value.value = from + (to - from) * eased
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  watch(source, animate, { immediate: true })
  onScopeDispose(() => cancelAnimationFrame(frame))

  return value
}
