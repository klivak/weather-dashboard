<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onScopeDispose, watch } from 'vue'
import type { City } from '@/api/models'
import { cityName } from '@/api/models'
import BaseButton from '@/components/base/BaseButton.vue'
import SegmentedControl from '@/components/base/SegmentedControl.vue'
import CitySearch from '@/components/search/CitySearch.vue'
import { useBlockChart } from '@/composables/useBlockChart'
import { useNow } from '@/composables/useNow'
import { useToasts } from '@/composables/useToasts'
import { useWeather } from '@/composables/useWeather'
import type { ForecastView } from '@/domain/forecast'
import { currentInUnits, forecastInUnits } from '@/domain/units'
import { useI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useThemeStore } from '@/stores/theme'
import BlockSkeleton from './BlockSkeleton.vue'
import ChartSkeleton from './ChartSkeleton.vue'
import { loadTempChart } from './loadTempChart'
import WeatherCard from './WeatherCard.vue'
import UpdatedStamp from './UpdatedStamp.vue'
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
const {
  current: rawCurrent,
  forecast: rawForecast,
  status,
  errorKind,
  updatedAt,
  refreshing,
  refresh,
  reload,
} = useWeather(
  () => props.city,
  () => locale.value,
)

const settings = useSettingsStore()
/** Data in the units the user picked (°C/m/s or °F/mph); the API always answers in metric. */
const current = computed(() => (rawCurrent.value ? currentInUnits(rawCurrent.value, settings.units) : null))
const forecast = computed(() =>
  rawForecast.value ? forecastInUnits(rawForecast.value, settings.units) : null,
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

const { show: showToast } = useToasts()

async function refreshNow() {
  if (!(await refresh())) showToast(t('updated.failed'), { icon: 'trash' })
}

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
const { chart, days, today, timezone } = useBlockChart(current, forecast, view, name)

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

    <BlockSkeleton v-else-if="showSkeleton" />

    <div
      v-else-if="current && city"
      class="block__body"
      :class="{ 'block__body--refreshing': status === 'loading' }"
    >
      <WeatherCard v-if="view === 'day'" :city="city" :weather="current">
        <template v-if="updatedLabel" #meta>
          <UpdatedStamp :label="updatedLabel" :refreshing="refreshing" @refresh="refreshNow" />
        </template>
      </WeatherCard>
      <WeekCard v-else :city="city" :days="days" :timezone="timezone" :today="today">
        <template v-if="updatedLabel" #meta>
          <UpdatedStamp :label="updatedLabel" :refreshing="refreshing" @refresh="refreshNow" />
        </template>
      </WeekCard>
      <figure v-if="chart.points.length" class="block__chart">
        <figcaption class="block__chart-caption">
          <span class="block__chart-title">{{ chart.title }}</span>
          <span class="block__chart-subtitle">{{ chart.subtitle }}</span>
        </figcaption>
        <TempChart
          :points="chart.points"
          :title="chart.title"
          :summary="chart.summary"
          :boundary-index="chart.boundaryIndex"
          :boundary-label="t('chart.tomorrow')"
        />
      </figure>
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

@media (max-width: 1023px) {
  .block {
    scroll-margin-top: 64px;
  }
}

.block:focus:not(:focus-visible) {
  outline: none;
}

/* Short accent ring after a move or an undo (added by flashBlock). */
.block--flash {
  animation: block-flash 1.1s var(--ease-out);
}

@keyframes block-flash {
  0%,
  35% {
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--accent) 70%, transparent),
      var(--shadow-2);
  }
  100% {
    box-shadow:
      0 0 0 0 transparent,
      var(--shadow-1);
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
</style>
