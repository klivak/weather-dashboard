<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onScopeDispose, watch } from 'vue'
import type { City } from '@/api/models'
import { cityName } from '@/api/models'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import SegmentedControl from '@/components/base/SegmentedControl.vue'
import CitySearch from '@/components/search/CitySearch.vue'
import { useNow } from '@/composables/useNow'
import { useWeather } from '@/composables/useWeather'
import { dailySummaries, localDateKey, todaySeries, type ForecastView } from '@/domain/forecast'
import { useI18n } from '@/i18n'
import { useThemeStore } from '@/stores/theme'
import { formatDayDate, formatShortWeekday, formatTemp, formatTime } from '@/utils/format'
import ChartSkeleton from './ChartSkeleton.vue'
import type { ChartPoint } from './TempChart.vue'
import { loadTempChart } from './loadTempChart'
import WeatherCard from './WeatherCard.vue'
import WeekCard from './WeekCard.vue'

const props = withDefaults(
  defineProps<{
    city: City | null
    /** Show the city search (home tab); favourites blocks are fixed to their city. */
    searchable?: boolean
    /** Accessible name used until the city is known, e.g. "City 2". */
    label?: string
    /** Focus the search field on mount (a block the user just added). */
    autofocus?: boolean
    /** Mark the block as a favourite city (gold ring). */
    favourite?: boolean
    /** The default city is still being detected: show the skeleton instead of the "pick a city" hint. */
    locating?: boolean
    /** This block's city drives the automatic day/night look (the first home block). */
    reportSun?: boolean
    /** One-click cities offered while the block is empty. */
    suggestions?: City[]
  }>(),
  {
    searchable: true,
    label: undefined,
    autofocus: false,
    favourite: false,
    locating: false,
    reportSun: false,
    suggestions: () => [],
  },
)

const emit = defineEmits<{ 'update:city': [city: City] }>()

/** Chart.js is about half of the app's JavaScript, so the chart arrives as its own chunk (prefetched in main.ts). */
const TempChart = defineAsyncComponent({ loader: loadTempChart, loadingComponent: ChartSkeleton, delay: 0 })

const view = defineModel<ForecastView>('view', { default: 'day' })

defineSlots<{ actions?: () => unknown }>()

const { t, locale } = useI18n()
const { current, forecast, status, errorKind, updatedAt, refreshing, refresh, reload } = useWeather(
  () => props.city,
  () => locale.value,
)

const themeStore = useThemeStore()
watch(
  [current, () => props.reportSun],
  ([weather, report]) => {
    if (!report) return
    themeStore.setSun(
      weather ? { sunrise: weather.sunrise, sunset: weather.sunset, timezone: weather.timezone } : null,
    )
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (props.reportSun) themeStore.setSun(null)
})

const now = useNow(onScopeDispose)
const updatedLabel = computed(() => {
  if (!updatedAt.value) return ''
  const minutes = Math.floor((now.value - updatedAt.value) / 60_000)
  if (minutes < 1) return t('updated.label', { time: t('updated.justNow') })
  const format = new Intl.RelativeTimeFormat(locale.value === 'uk' ? 'uk-UA' : 'en-GB', { numeric: 'auto' })
  const time =
    minutes < 60 ? format.format(-minutes, 'minute') : format.format(-Math.floor(minutes / 60), 'hour')
  return t('updated.label', { time })
})

const viewOptions = computed(() => [
  { value: 'day' as const, label: t('view.day') },
  { value: 'week' as const, label: t('view.week') },
])

const name = computed(() => (props.city ? cityName(props.city, locale.value) : ''))
const timezone = computed(() => forecast.value?.timezone ?? current.value?.timezone ?? 0)
const today = computed(() => (current.value ? localDateKey(current.value.dt, current.value.timezone) : ''))

const series = computed(() =>
  current.value && forecast.value ? todaySeries(current.value, forecast.value) : [],
)
const days = computed(() => (forecast.value ? dailySummaries(forecast.value) : []))

const dayPoints = computed<ChartPoint[]>(() =>
  series.value.map((point) => {
    const time = formatTime(point.dt, timezone.value, locale.value)
    return {
      label: point.now ? t('chart.now') : time,
      title: `${formatDayDate(point.dt, timezone.value, locale.value)}, ${time}`,
      value: point.temp,
      highlight: point.now,
      icon: { code: point.condition.id, day: point.isDay },
      pop: point.pop,
    }
  }),
)

const weekPoints = computed<ChartPoint[]>(() =>
  days.value.map((day) => ({
    label:
      day.date === today.value ? t('week.today') : formatShortWeekday(day.dt, timezone.value, locale.value),
    title: formatDayDate(day.dt, timezone.value, locale.value),
    value: day.avg,
    min: day.min,
    max: day.max,
    highlight: day.date === today.value,
    icon: { code: day.condition.id, day: true },
    pop: day.pop,
  })),
)

/** Late in the evening the hourly series borrows tomorrow's first points; the chart marks where they start. */
const boundaryIndex = computed(() => {
  const index = series.value.findIndex((point) => point.nextDay)
  return index > 0 ? index : undefined
})

function extreme(points: ChartPoint[], pick: 'max' | 'min'): ChartPoint | undefined {
  let best: ChartPoint | undefined
  for (const point of points) {
    if (!best || (pick === 'max' ? point.value > best.value : point.value < best.value)) best = point
  }
  return best
}

const chart = computed(() => {
  if (view.value === 'week') {
    const warm = extreme(weekPoints.value, 'max')
    const cold = extreme(weekPoints.value, 'min')
    return {
      points: weekPoints.value,
      title: t('chart.weekTitle'),
      subtitle: t('chart.weekSubtitle'),
      summary:
        warm && cold
          ? t('chart.weekSummary', {
              city: name.value,
              warm: warm.title,
              warmTemp: formatTemp(warm.value),
              cold: cold.title,
              coldTemp: formatTemp(cold.value),
            })
          : '',
    }
  }
  const first = series.value[0]
  const max = extreme(dayPoints.value, 'max')
  const min = extreme(dayPoints.value, 'min')
  const timeOf = (point: ChartPoint) => point.title.split(', ').at(-1) ?? ''
  return {
    points: dayPoints.value,
    title: t('chart.title'),
    subtitle: t('chart.subtitle'),
    summary:
      first && max && min
        ? t('chart.summary', {
            city: name.value,
            now: formatTemp(first.temp),
            max: formatTemp(max.value),
            maxTime: timeOf(max),
            min: formatTemp(min.value),
            minTime: timeOf(min),
          })
        : '',
  }
})

const showSkeleton = computed(
  () => (status.value === 'loading' && !current.value) || (!props.city && props.locating),
)

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
  <section
    class="block"
    :class="{ 'block--favourite': favourite }"
    :aria-busy="status === 'loading'"
    :aria-label="name || label"
  >
    <div class="block__toolbar">
      <div v-if="searchable" class="block__search">
        <CitySearch :city="city" :autofocus="autofocus" @select="emit('update:city', $event)" />
      </div>
      <div v-if="city || $slots.actions" class="block__controls">
        <SegmentedControl
          v-if="city"
          v-model="view"
          :options="viewOptions"
          :label="t('view.label')"
          size="sm"
        />
        <div v-if="$slots.actions" class="block__actions"><slot name="actions" /></div>
      </div>
    </div>

    <p class="visually-hidden" role="status">
      {{ showSkeleton ? (city ? t('weather.loading') : t('location.detecting')) : '' }}
    </p>

    <div v-if="showSkeleton && !city" class="block__detecting">
      <span class="block__detecting-pulse" aria-hidden="true" />
      {{ t('location.detecting') }}
    </div>

    <div v-if="!city && !locating" class="block__empty">
      <p class="block__hint">{{ t('weather.pickCity') }}</p>
      <div v-if="suggestions.length" class="block__chips" role="group" :aria-label="t('home.popular')">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          type="button"
          class="block__chip"
          @click="emit('update:city', suggestion)"
        >
          {{ suggestion.names[locale] ?? suggestion.name }}
        </button>
      </div>
    </div>

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
      <div class="block__chart skeleton">
        <span class="skeleton__line skeleton__line--meta" />
        <ChartSkeleton />
      </div>
    </div>

    <div
      v-else-if="current && city"
      class="block__body"
      :class="{ 'block__body--refreshing': status === 'loading' }"
    >
      <WeatherCard v-if="view === 'day'" :city="city" :weather="current" />
      <WeekCard v-else :city="city" :days="days" :timezone="timezone" :today="today" />
      <figure v-if="chart.points.length" class="block__chart">
        <figcaption class="block__chart-caption">
          <span class="block__chart-title">{{ chart.title }}</span>
          <span class="block__chart-subtitle">{{ chart.subtitle }}</span>
        </figcaption>
        <TempChart
          :points="chart.points"
          :title="chart.title"
          :summary="chart.summary"
          :boundary-index="view === 'day' ? boundaryIndex : undefined"
          :boundary-label="t('chart.tomorrow')"
        />
      </figure>
      <div v-if="updatedLabel" class="block__meta">
        <span>{{ updatedLabel }}</span>
        <button
          type="button"
          class="block__refresh"
          :aria-label="t('updated.refresh')"
          :title="t('updated.refresh')"
          :disabled="refreshing"
          @click="refresh"
        >
          <BaseSpinner v-if="refreshing" :size="16" />
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
          </svg>
        </button>
      </div>
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

.block--favourite {
  border-color: color-mix(in srgb, var(--fav) 70%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--fav) 70%, transparent),
    var(--shadow-1);
}

.block__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.block__search {
  flex: 1 1 260px;
  min-width: 0;
  max-width: 420px;
}

/* Next to the search on wide screens; on narrow ones it wraps to its own row under the search. */
.block__controls {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.block__actions {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}

.block__detecting {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.block__detecting-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.3;
    transform: scale(0.7);
  }
}

.block__empty {
  display: grid;
  justify-items: center;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-4);
}

.block__empty .block__hint {
  padding: 0;
}

.block__chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  max-width: 560px;
}

.block__chip {
  min-height: var(--control-height-sm);
  padding: 0 var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.block__chip:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised));
}

.block__chip:active {
  transform: scale(0.96);
}

.block__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  color: var(--text-muted);
  font-size: var(--text-xs);
}

@media (min-width: 1024px) {
  .block__meta {
    grid-column: 1 / -1;
  }
}

.block__refresh {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  transition:
    color var(--dur-fast) var(--ease-out),
    transform var(--dur-base) var(--ease-out);
}

.block__refresh:hover:not(:disabled) {
  color: var(--text);
  transform: rotate(-60deg);
}

.block__refresh:disabled {
  cursor: progress;
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

.block__chart {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  margin: 0;
}

.block__chart-caption {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
}

.block__chart-title {
  font-weight: var(--weight-bold);
}

.block__chart-subtitle {
  color: var(--text-muted);
  font-size: var(--text-xs);
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
.skeleton__grid,
.skeleton > .chart-skeleton {
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

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
