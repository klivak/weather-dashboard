import { onBeforeUnmount, onMounted, ref } from 'vue'
import { resolveDefaultCity } from '@/api/location'
import { cityName } from '@/api/models'
import { useI18n } from '@/i18n'
import { useBlocksStore } from '@/stores/blocks'
import { useAnnouncer } from './useAnnouncer'

/**
 * First visit only: fill the default (empty) block with the visitor's city from their IP, falling back to Kyiv.
 * A returning visitor's layout is left alone, and a city the user picks while the lookup runs always wins.
 * Returns the id of the block that is waiting, so it can show a "finding your city" state.
 */
export function useDefaultCity() {
  const store = useBlocksStore()
  const { t, locale } = useI18n()
  const { announce } = useAnnouncer()
  const locatingId = ref<string | null>(null)
  const controller = new AbortController()

  onMounted(async () => {
    const first = store.blocks[0]
    if (store.restored || !first || first.city) return
    locatingId.value = first.id
    try {
      const { city, source } = await resolveDefaultCity(controller.signal)
      const block = store.blocks.find((item) => item.id === first.id)
      if (!block || block.city) return
      await store.setCity(block.id, city)
      if (source === 'ip') void announce(t('location.detected', { city: cityName(city, locale.value) }))
    } catch {
      // Aborted because the view unmounted.
    } finally {
      locatingId.value = null
    }
  })

  onBeforeUnmount(() => controller.abort())

  return { locatingId }
}
