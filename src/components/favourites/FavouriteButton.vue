<script setup lang="ts">
import { computed } from 'vue'
import type { City } from '@/api/models'
import { cityName } from '@/api/models'
import IconStar from '@/components/icons/IconStar.vue'
import { useAnnouncer } from '@/composables/useAnnouncer'
import { useI18n } from '@/i18n'
import { useFavouritesStore } from '@/stores/favourites'

const props = defineProps<{ city: City }>()

const { t, locale } = useI18n()
const favourites = useFavouritesStore()
const { announce } = useAnnouncer()

const name = computed(() => cityName(props.city, locale.value))
const active = computed(() => favourites.isFavourite(props.city.id))
const label = computed(() =>
  active.value ? t('favourites.remove', { city: name.value }) : t('favourites.add', { city: name.value }),
)

function toggle() {
  const result = favourites.toggle(props.city)
  if (result === 'added') void announce(t('favourites.added', { city: name.value }))
  if (result === 'removed') void announce(t('favourites.removed', { city: name.value }))
  // 'full' opens the limit dialog, which speaks for itself.
}
</script>

<template>
  <button
    type="button"
    class="fav"
    :class="{ 'fav--active': active }"
    :aria-pressed="active"
    :aria-label="label"
    :title="label"
    @click="toggle"
  >
    <IconStar :filled="active" />
  </button>
</template>

<style scoped>
.fav {
  display: grid;
  place-items: center;
  width: var(--control-height);
  height: var(--control-height);
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  transition:
    color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.fav:hover {
  background: var(--surface-sunken);
  border-color: var(--border-strong);
  color: var(--fav);
}

.fav--active {
  border-color: color-mix(in srgb, var(--fav) 45%, transparent);
  background: color-mix(in srgb, var(--fav) 12%, transparent);
  color: var(--fav);
}

.fav--active :deep(svg) {
  animation: pop var(--dur-base) var(--ease-out);
}

@keyframes pop {
  50% {
    transform: scale(1.25);
  }
}
</style>
