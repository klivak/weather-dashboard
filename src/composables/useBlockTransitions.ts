/**
 * Enter/leave hooks for lists of blocks (TransitionGroup). Leaving: the block fades and shrinks a little, then its
 * height (and the grid gap after it) collapses, so the blocks below glide up instead of jumping. Entering is the
 * mirror image. Uses the Web Animations API; skipped entirely under reduced motion.
 */

const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)'

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function rowGap(element: Element): number {
  const parent = element.parentElement
  return parent ? parseFloat(getComputedStyle(parent).rowGap) || 0 : 0
}

function canAnimate(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && typeof element.animate === 'function' && !reducedMotion()
}

export function useBlockTransitions() {
  function onLeave(element: Element, done: () => void) {
    if (!canAnimate(element)) return done()
    const height = element.offsetHeight
    const gap = rowGap(element)
    element.style.overflow = 'hidden'
    element.style.pointerEvents = 'none'
    const animation = element.animate(
      [
        { height: `${height}px`, marginBottom: '0px', opacity: 1, transform: 'scale(1)' },
        { height: `${height}px`, marginBottom: '0px', opacity: 0, transform: 'scale(0.97)', offset: 0.4 },
        { height: '0px', marginBottom: `${-gap}px`, opacity: 0, transform: 'scale(0.97)' },
      ],
      { duration: 520, easing: EASE },
    )
    animation.onfinish = done
    animation.oncancel = done
  }

  function onEnter(element: Element, done: () => void) {
    if (!canAnimate(element)) return done()
    const height = element.offsetHeight
    const gap = rowGap(element)
    element.style.overflow = 'hidden'
    const animation = element.animate(
      [
        { height: '0px', marginBottom: `${-gap}px`, opacity: 0, transform: 'translateY(8px) scale(0.98)' },
        {
          height: `${height}px`,
          marginBottom: '0px',
          opacity: 0,
          transform: 'translateY(8px) scale(0.98)',
          offset: 0.45,
        },
        { height: `${height}px`, marginBottom: '0px', opacity: 1, transform: 'none' },
      ],
      { duration: 520, easing: EASE },
    )
    const finish = () => {
      element.style.overflow = ''
      done()
    }
    animation.onfinish = finish
    animation.oncancel = finish
  }

  return { onEnter, onLeave }
}

/** Briefly ring a block and bring it into view, so the user sees where it landed after a move or an undo. */
export function flashBlock(id: string) {
  const element = document.getElementById(id)
  if (!element) return
  const rect = element.getBoundingClientRect()
  if (rect.top < 0 || rect.top > window.innerHeight - 120) {
    element.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' })
  }
  element.classList.remove('block--flash')
  // Restart the animation even if the class was just removed.
  void element.offsetWidth
  element.classList.add('block--flash')
  // Children animate too (card reveal) and their animationend bubbles up: wait for this block's own one.
  const onEnd = (event: AnimationEvent) => {
    if (event.target !== element || !event.animationName.includes('block-flash')) return
    element.classList.remove('block--flash')
    element.removeEventListener('animationend', onEnd)
  }
  element.addEventListener('animationend', onEnd)
}
