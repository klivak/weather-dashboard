import { readonly, ref } from 'vue'

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
let users = 0

/** A shared clock that ticks every 30 s while at least one component uses it (for "updated 5 min ago" labels). */
export function useNow(onDispose: (stop: () => void) => void) {
  users += 1
  if (!timer) {
    now.value = Date.now()
    timer = setInterval(() => (now.value = Date.now()), 30_000)
  }
  onDispose(() => {
    users -= 1
    if (users === 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  })
  return readonly(now)
}
