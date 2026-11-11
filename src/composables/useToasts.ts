import { readonly, ref } from 'vue'
import { useAnnouncer } from './useAnnouncer'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  icon: 'check' | 'star' | 'trash'
  action?: ToastAction
}

const DURATION_MS = 5000
const MAX_TOASTS = 3

const toasts = ref<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 1
let held = false

function schedule(id: number, ms: number) {
  clearTimeout(timers.get(id))
  timers.set(
    id,
    setTimeout(() => dismiss(id), ms),
  )
}

function dismiss(id: number) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

/**
 * Short visible notifications with an optional action (e.g. Undo). Every toast is also spoken through the shared
 * live region. They close themselves after 5 s, but not while the pointer or keyboard focus is on them.
 */
export function useToasts() {
  const { announce } = useAnnouncer()

  function show(message: string, options: { icon?: Toast['icon']; action?: ToastAction } = {}): number {
    const toast: Toast = { id: nextId++, message, icon: options.icon ?? 'check' }
    if (options.action) toast.action = options.action
    toasts.value = [...toasts.value, toast].slice(-MAX_TOASTS)
    for (const id of timers.keys()) if (!toasts.value.some((item) => item.id === id)) dismiss(id)
    if (!held) schedule(toast.id, DURATION_MS)
    void announce(options.action ? `${message}. ${options.action.label}?` : message)
    return toast.id
  }

  function runAction(toast: Toast) {
    dismiss(toast.id)
    toast.action?.run()
  }

  /** Pause auto-closing (pointer over or focus inside the toasts). */
  function hold() {
    held = true
    for (const timer of timers.values()) clearTimeout(timer)
  }

  /** Resume auto-closing, giving each toast a little time again. */
  function release() {
    held = false
    for (const toast of toasts.value) schedule(toast.id, DURATION_MS / 2)
  }

  return { toasts: readonly(toasts), show, dismiss, runAction, hold, release }
}
