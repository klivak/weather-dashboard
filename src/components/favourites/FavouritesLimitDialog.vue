<script setup lang="ts">
import { computed } from 'vue'
import type { City } from '@/api/models'
import { cityName } from '@/api/models'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import { useAnnouncer } from '@/composables/useAnnouncer'
import { MAX_FAVOURITES } from '@/domain/limits'
import { useI18n } from '@/i18n'
import { useFavouritesStore } from '@/stores/favourites'
import { cityRegion } from '@/utils/region'

/** Opens when a city is starred while favourites are full and lets the user pick which saved city to drop. */
const { t, locale } = useI18n()
const favourites = useFavouritesStore()
const { announce } = useAnnouncer()

const open = computed({
  get: () => favourites.pending !== null,
  set: (value) => {
    if (!value) favourites.cancelPending()
  },
})

const pendingName = computed(() => (favourites.pending ? cityName(favourites.pending, locale.value) : ''))

function swap(city: City) {
  const removed = cityName(city, locale.value)
  const added = pendingName.value
  if (favourites.replace(city.id)) void announce(t('favourites.replaced', { removed, added }))
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="t('favourites.fullTitle', { max: MAX_FAVOURITES })"
    :description="t('favourites.fullText', { city: pendingName, max: MAX_FAVOURITES })"
  >
    <ul class="limit">
      <li v-for="city in favourites.cities" :key="city.id" class="limit__item">
        <span class="limit__text">
          <span class="limit__name">{{ cityName(city, locale) }}</span>
          <span class="limit__region">{{ cityRegion(city, locale) }}</span>
        </span>
        <BaseButton
          size="sm"
          :aria-label="t('favourites.fullRemove', { city: cityName(city, locale), added: pendingName })"
          @click="swap(city)"
        >
          {{ t('favourites.fullRemoveShort') }}
        </BaseButton>
      </li>
    </ul>
    <template #actions>
      <BaseButton autofocus @click="open = false">{{ t('favourites.fullCancel') }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.limit {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.limit__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--surface-sunken);
}

.limit__text {
  display: grid;
  min-width: 0;
}

.limit__name,
.limit__region {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.limit__name {
  font-weight: var(--weight-medium);
}

.limit__region {
  color: var(--text-muted);
  font-size: var(--text-xs);
}
</style>
