<script setup lang="ts">
import { computed } from 'vue'
import type { City } from '@/api/models'
import { cityName } from '@/api/models'
import type { DaySummary } from '@/domain/forecast'
import { useI18n } from '@/i18n'
import { formatNumber, formatShortDate, formatShortWeekday, formatTemp } from '@/utils/format'
import { cityRegion } from '@/utils/region'
import WeatherIcon from './WeatherIcon.vue'

const props = defineProps<{
  city: City
  days: DaySummary[]
  timezone: number
  /** The city's current local date (YYYY-MM-DD), to label that row "Today". */
  today: string
}>()

defineSlots<{ meta?: () => unknown }>()

const { t, locale } = useI18n()

const name = computed(() => cityName(props.city, locale.value))
const region = computed(() => cityRegion(props.city, locale.value))

const rows = computed(() =>
  props.days.map((day) => ({
    ...day,
    isToday: day.date === props.today,
    label:
      day.date === props.today ? t('week.today') : formatShortWeekday(day.dt, props.timezone, locale.value),
    date: formatShortDate(day.dt, props.timezone, locale.value),
    rain: `${formatNumber(Math.round(day.pop * 100), locale.value)}%`,
    dry: day.pop < 0.1,
  })),
)
</script>

<template>
  <article class="week" :aria-label="`${name}: ${t('week.title')}`">
    <header>
      <h3 class="week__city">{{ name }}</h3>
      <p class="week__meta">
        <span v-if="region">{{ region }}</span>
        <slot name="meta" />
      </p>
    </header>

    <ol class="week__days">
      <li
        v-for="(row, index) in rows"
        :key="row.date"
        class="day"
        :class="{ 'day--today': row.isToday }"
        :style="{ '--i': index }"
      >
        <span class="day__when">
          <span class="day__name">{{ row.label }}</span>
          <span class="day__date">{{ row.date }}</span>
        </span>
        <WeatherIcon class="day__icon" :code="row.condition.id" :size="36" />
        <span class="visually-hidden">{{ row.condition.description }}.</span>
        <span class="day__avg" :aria-label="t('week.average', { temp: formatTemp(row.avg) })">
          {{ formatTemp(row.avg) }}
        </span>
        <span class="day__stats">
          <span
            class="day__range"
            :aria-label="t('week.range', { min: formatTemp(row.min), max: formatTemp(row.max) })"
          >
            <span>{{ formatTemp(row.min) }}</span>
            <span class="day__range-sep" aria-hidden="true">/</span>
            <span class="day__max">{{ formatTemp(row.max) }}</span>
          </span>
          <span
            class="day__rain"
            :class="{ 'day__rain--dry': row.dry }"
            :aria-label="t('week.rain', { pct: row.rain })"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3s7 7.6 7 12a7 7 0 0 1-14 0c0-4.4 7-12 7-12z" fill="currentColor" />
            </svg>
            {{ row.rain }}
          </span>
        </span>
      </li>
    </ol>

    <p class="week__note">{{ t('week.note') }}</p>
  </article>
</template>

<style scoped>
.week {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  min-width: 0;
}

.week__city {
  font-size: var(--text-xl);
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
}

.week__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-2);
  margin-top: var(--space-1);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.week__meta > span:not(:first-child, .stamp, .visually-hidden)::before {
  content: '·';
  margin-right: var(--space-2);
}

.week__days {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.week > header {
  animation: reveal var(--dur-slow) var(--ease-out) both;
}

/* Days slide in one after another when the 5-day view opens. */
.day {
  animation: reveal var(--dur-slow) var(--ease-out) both;
  animation-delay: calc(var(--i, 0) * 55ms + 60ms);
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* A clean table: fixed columns so the numbers line up in every row, thin dividers, today on a soft fill. */
.day {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px 48px 84px;
  align-items: center;
  column-gap: var(--space-2);
  min-height: 56px;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-variant-numeric: tabular-nums;
}

.day + .day {
  box-shadow: 0 -1px 0 var(--border);
}

.day--today {
  background: var(--surface-sunken);
}

.day--today,
.day--today + .day {
  box-shadow: none;
}

.day--today .day__name {
  font-weight: var(--weight-bold);
}

.day__when {
  display: grid;
  min-width: 0;
}

.day__name {
  overflow: hidden;
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day__name::first-letter {
  text-transform: uppercase;
}

.day__date {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.day__icon {
  justify-self: center;
}

.day__avg {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  text-align: right;
}

/* Low / high on top, chance of precipitation under it: one tidy column on the right. */
.day__stats {
  display: grid;
  justify-items: end;
  gap: 2px;
}

.day__range {
  color: var(--text-muted);
  font-size: var(--text-sm);
  white-space: nowrap;
}

.day__max {
  color: var(--text);
}

.day__range-sep {
  margin-inline: 3px;
  opacity: 0.5;
}

.day__rain {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--rain-text);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.day__rain--dry {
  color: var(--text-muted);
  font-weight: var(--weight-regular);
}

.week__note {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

@media (max-width: 400px) {
  .day {
    grid-template-columns: minmax(0, 1fr) 34px 40px 74px;
    column-gap: var(--space-1);
    padding-inline: var(--space-2);
  }
}
</style>
