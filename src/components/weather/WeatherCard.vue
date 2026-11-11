<script setup lang="ts">
import { computed } from 'vue'
import type { City, CurrentWeather } from '@/api/models'
import { cityName } from '@/api/models'
import { isDayIcon } from '@/domain/conditions'
import { useI18n } from '@/i18n'
import { compassPoint, formatDayDate, formatNumber, formatTemp, formatTime } from '@/utils/format'
import { cityRegion } from '@/utils/region'
import WeatherIcon from './WeatherIcon.vue'

const props = defineProps<{ city: City; weather: CurrentWeather }>()

defineSlots<{ actions?: () => unknown }>()

const { t, locale } = useI18n()

const name = computed(() => cityName(props.city, locale.value))
const region = computed(() => cityRegion(props.city, locale.value))
const localNow = computed(() => {
  const { dt, timezone } = props.weather
  return `${formatDayDate(dt, timezone, locale.value)}, ${formatTime(dt, timezone, locale.value)}`
})
const description = computed(() => {
  const text = props.weather.condition.description
  return text ? text.charAt(0).toLocaleUpperCase(locale.value) + text.slice(1) : ''
})
const compass = computed(() => compassPoint(props.weather.windDeg))

const details = computed(() => {
  const w = props.weather
  const tz = w.timezone
  const items = [
    { key: 'humidity', label: t('weather.humidity'), value: `${w.humidity}%` },
    {
      key: 'wind',
      label: t('weather.wind'),
      value: `${formatNumber(w.windSpeed, locale.value, 1)} ${t('weather.speedUnit')} ${t(`weather.compassShort.${compass.value}`)}`,
      title: t('weather.windFrom', { direction: t(`weather.compass.${compass.value}`) }),
    },
    {
      key: 'pressure',
      label: t('weather.pressure'),
      value: `${Math.round(w.pressure)} ${t('weather.pressureUnit')}`,
    },
    {
      key: 'visibility',
      label: t('weather.visibility'),
      value:
        w.visibility === null
          ? '—'
          : `${formatNumber(w.visibility / 1000, locale.value, 1)} ${t('weather.distanceUnit')}`,
    },
    { key: 'sunrise', label: t('weather.sunrise'), value: formatTime(w.sunrise, tz, locale.value) },
    { key: 'sunset', label: t('weather.sunset'), value: formatTime(w.sunset, tz, locale.value) },
  ]
  return items
})
</script>

<template>
  <article class="card" :aria-label="name">
    <header class="card__head">
      <div class="card__place">
        <h3 class="card__city">{{ name }}</h3>
        <p class="card__meta">
          <span v-if="region">{{ region }}</span>
          <span class="visually-hidden">{{ t('weather.localTime') }}:</span>
          <time class="card__time">{{ localNow }}</time>
        </p>
      </div>
      <div v-if="$slots.actions" class="card__actions"><slot name="actions" /></div>
    </header>

    <div class="card__now">
      <WeatherIcon
        class="card__icon"
        :code="weather.condition.id"
        :day="isDayIcon(weather.condition.icon)"
        :size="96"
        animated
      />
      <div>
        <p class="card__temp">{{ formatTemp(weather.temp) }}</p>
        <p class="card__desc">{{ description }}</p>
        <p class="card__sub">
          {{ t('weather.feelsLike', { temp: formatTemp(weather.feelsLike) }) }}
        </p>
      </div>
    </div>

    <dl class="card__details">
      <div v-for="item in details" :key="item.key" class="card__detail" :title="item.title">
        <dt>{{ item.label }}</dt>
        <dd>
          <svg
            v-if="item.key === 'wind'"
            class="card__arrow"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            aria-hidden="true"
            :style="{ transform: `rotate(${weather.windDeg + 180}deg)` }"
          >
            <path d="M12 3l6 16-6-4-6 4 6-16z" fill="currentColor" />
          </svg>
          {{ item.value }}
        </dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.card {
  display: grid;
  align-content: start;
  gap: var(--space-5);
  min-width: 0;
}

.card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.card__place {
  min-width: 0;
}

.card__city {
  font-size: var(--text-xl);
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
}

.card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-2);
  margin-top: var(--space-1);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.card__meta > span:first-child::after {
  content: '·';
  margin-left: var(--space-2);
}

.card__time {
  font-variant-numeric: tabular-nums;
}

.card__actions {
  display: flex;
  gap: var(--space-2);
}

.card__now {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.card__icon {
  width: clamp(72px, 20vw, 96px);
  height: auto;
}

.card__temp {
  font-size: var(--text-display);
  font-weight: var(--weight-bold);
  line-height: 0.95;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.card__desc {
  margin-top: var(--space-2);
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
}

.card__sub {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.card__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
}

@media (min-width: 560px) {
  .card__details {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.card__detail {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
}

.card__detail dt {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.card__detail dd {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 2px 0 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.card__arrow {
  color: var(--text-muted);
}
</style>
