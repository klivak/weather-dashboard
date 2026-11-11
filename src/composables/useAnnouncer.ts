import { nextTick, readonly, ref } from 'vue'

const message = ref('')

/**
 * One polite live region for the whole app (rendered by AppAnnouncer). Clearing first makes screen readers repeat
 * a message even when it is the same text as the previous one.
 */
export function useAnnouncer() {
  async function announce(text: string) {
    message.value = ''
    await nextTick()
    message.value = text
  }
  return { message: readonly(message), announce }
}
