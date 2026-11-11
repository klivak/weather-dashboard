<script setup lang="ts">
import BaseButton from '@/components/base/BaseButton.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import FavouriteButton from '@/components/favourites/FavouriteButton.vue'
import IconStar from '@/components/icons/IconStar.vue'
import WeatherBlock from '@/components/weather/WeatherBlock.vue'
import { MAX_FAVOURITES } from '@/domain/limits'
import { useBlockTransitions } from '@/composables/useBlockTransitions'
import { useI18n } from '@/i18n'
import { useFavouritesStore } from '@/stores/favourites'

const emit = defineEmits<{ browse: [] }>()

const { t } = useI18n()
const favourites = useFavouritesStore()
const { onEnter, onLeave } = useBlockTransitions()
</script>

<template>
  <div class="favourites">
    <EmptyState
      v-if="!favourites.cities.length"
      :title="t('favourites.emptyTitle')"
      :text="t('favourites.emptyText', { max: MAX_FAVOURITES })"
    >
      <template #icon><IconStar :size="28" /></template>
      <template #action>
        <BaseButton variant="primary" @click="emit('browse')">{{ t('favourites.emptyAction') }}</BaseButton>
      </template>
    </EmptyState>

    <TransitionGroup v-else name="block" tag="div" class="favourites__list" @enter="onEnter" @leave="onLeave">
      <!-- Fixed to their city: no search, only the favourite toggle and the view switch. -->
      <WeatherBlock
        v-for="city in favourites.cities"
        :key="city.id"
        :city="city"
        :searchable="false"
        favourite
      >
        <template #actions>
          <FavouriteButton :city="city" />
        </template>
      </WeatherBlock>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.favourites__list {
  display: grid;
  gap: var(--space-5);
}

/* Blocks around a removed or restored favourite slide into place. */
.block-move {
  transition: transform var(--dur-slow) var(--ease-out);
}
</style>
