<script setup lang="ts">
import { computed } from 'vue'
import type { City } from '@/api/models'
import { cityName } from '@/api/models'
import BaseButton from '@/components/base/BaseButton.vue'
import CitySearch from '@/components/search/CitySearch.vue'
import { useWeather } from '@/composables/useWeather'
import { localDateKey, todaySeries } from '@/domain/forecast'
import { useI18n } from '@/i18n'
import TempChart from './TempChart.vue'
import WeatherCard from './WeatherCard.vue'

const props = withDefaults(
  defineProps<{
    city: City | null
    /** Show the city search (home tab); favourites blocks are fixed to their city. */
    searchable?: boolean
  }>(),
  { searchable: true },
)

const emit = defineEmits<{ 'update:city': [city: City] }>()

defineSlots<{ actions?: () => unknown }>()

const { t, locale } = useI18n()
const { current, forecast, status, errorKind, reload } = useWeather(
  () => props.city,
  () => locale.value,
)

const series = computed(() =>
  current.value && forecast.value ? todaySeries(current.value, forecast.value) : [],
)
/** Late in the day the series runs into tomorrow; the title then says so instead of "today". */
const chartTitle = computed(() => {
  const first = series.value[0]
  const tz = forecast.value?.timezone ?? 0
  const crosses = !!first && series.value.some((p) => localDateKey(p.dt, tz) !== localDateKey(first.dt, tz))
  return crosses ? t('chart.titleNext') : t('chart.title')
})
const name = computed(() => (props.city ? cityName(props.city, locale.value) : ''))
const showSkeleton = computed(() => status.value === 'loading' && !current.value)

const errorText = computed(() => {
  switch (errorKind.value) {
    case 'network':
    case 'timeout':
      return t('weather.errors.network')
    case 'unauthorized':
      return t('weather.errors.unauthorized')
    case 'rate-limit':
      return t('weather.errors.rateLimit')
    default:
      return t('weather.errors.generic')
  }
})
</script>

<template>
  <section class="block" :aria-busy="status === 'loading'" :aria-label="name || undefined">
    <div v-if="searchable" class="block__toolbar">
      <div class="block__search">
        <CitySearch :city="city" @select="emit('update:city', $event)" />
      </div>
    </div>

    <p v-if="!city" class="block__hint">{{ t('weather.pickCity') }}</p>

    <div v-else-if="status === 'error' && !current" class="block__error" role="alert">
      <p>{{ errorText }}</p>
      <BaseButton size="sm" @click="reload">{{ t('weather.retry') }}</BaseButton>
    </div>

    <div v-else-if="showSkeleton" class="block__body" aria-hidden="true">
      <div class="skeleton">
        <span class="skeleton__line skeleton__line--title" />
        <span class="skeleton__line skeleton__line--meta" />
        <div class="skeleton__now">
          <span class="skeleton__circle" />
          <span class="skeleton__line skeleton__line--temp" />
        </div>
        <div class="skeleton__grid">
          <span v-for="cell in 6" :key="cell" class="skeleton__cell" />
        </div>
      </div>
      <div class="skeleton skeleton--chart">
        <span class="skeleton__line skeleton__line--meta" />
        <span class="skeleton__chart" />
      </div>
      <span class="visually-hidden">{{ t('weather.loading') }}</span>
    </div>

    <div
      v-else-if="current && city"
      class="block__body"
      :class="{ 'block__body--refreshing': status === 'loading' }"
    >
      <WeatherCard :city="city" :weather="current">
        <template v-if="$slots.actions" #actions><slot name="actions" /></template>
      </WeatherCard>
      <TempChart
        v-if="series.length && forecast"
        :points="series"
        :timezone="forecast.timezone"
        :city-name="name"
        :title="chartTitle"
        :subtitle="t('chart.subtitle')"
      />
    </div>
  </section>
</template>

<style scoped>
.block {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}

@media (min-width: 768px) {
  .block {
    padding: var(--space-6);
  }
}

.block__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.block__search {
  flex: 1;
  max-width: 420px;
}

.block__hint {
  padding: var(--space-8) var(--space-4);
  color: var(--text-muted);
  text-align: center;
}

.block__error {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.block__body {
  display: grid;
  gap: var(--space-8);
  transition: opacity var(--dur-base) var(--ease-out);
}

@media (min-width: 1024px) {
  .block__body {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    align-items: start;
  }
}

.block__body--refreshing {
  opacity: 0.6;
}

/* Skeleton mirrors the card and chart so nothing jumps when data arrives. */
.skeleton {
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.skeleton > *,
.skeleton__now > *,
.skeleton__grid > * {
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--surface-sunken) 0%,
    color-mix(in srgb, var(--surface-sunken) 40%, var(--surface-raised)) 50%,
    var(--surface-sunken) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}

.skeleton__now,
.skeleton__grid {
  background: none !important;
  animation: none !important;
}

.skeleton__line {
  display: block;
  height: 14px;
}

.skeleton__line--title {
  width: 45%;
  height: 30px;
}

.skeleton__line--meta {
  width: 60%;
}

.skeleton__now {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-block: var(--space-3);
}

.skeleton__circle {
  width: 88px;
  height: 88px;
  border-radius: 50% !important;
}

.skeleton__line--temp {
  width: 120px;
  height: 64px;
}

.skeleton__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

@media (min-width: 560px) {
  .skeleton__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.skeleton__cell {
  height: 56px;
}

.skeleton__chart {
  height: 220px;
  border-radius: var(--radius-md) !important;
}

@media (min-width: 1024px) {
  .skeleton__chart {
    height: 260px;
  }
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
