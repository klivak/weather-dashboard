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
    rain: day.pop >= 0.1 ? `${formatNumber(Math.round(day.pop * 100), locale.value)}%` : '',
  })),
)
</script>

<template>
  <article class="week" :aria-label="`${name}: ${t('week.title')}`">
    <header>
      <h3 class="week__city">{{ name }}</h3>
      <p class="week__meta">
        <span v-if="region">{{ region }}</span>
        <span>{{ t('week.title') }}</span>
      </p>
    </header>

    <ol class="week__days">
      <li v-for="row in rows" :key="row.date" class="day" :class="{ 'day--today': row.isToday }">
        <span class="day__when">
          <span class="day__name">{{ row.label }}</span>
          <span class="day__date">{{ row.date }}</span>
        </span>
        <WeatherIcon class="day__icon" :code="row.condition.id" :size="36" />
        <span class="visually-hidden">{{ row.condition.description }}.</span>
        <span class="day__avg" :aria-label="t('week.average', { temp: formatTemp(row.avg) })">
          {{ formatTemp(row.avg) }}
        </span>
        <span
          class="day__range"
          :aria-label="t('week.range', { min: formatTemp(row.min), max: formatTemp(row.max) })"
        >
          <span>{{ formatTemp(row.min) }}</span>
          <span class="day__range-sep" aria-hidden="true">/</span>
          <span>{{ formatTemp(row.max) }}</span>
        </span>
        <span class="day__rain" :aria-label="row.rain ? t('week.rain', { pct: row.rain }) : undefined">
          <template v-if="row.rain">
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3s7 7.6 7 12a7 7 0 0 1-14 0c0-4.4 7-12 7-12z" fill="currentColor" />
            </svg>
            {{ row.rain }}
          </template>
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

.week__meta > span + span::before {
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

.day {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px 48px minmax(72px, auto) 52px;
  align-items: center;
  gap: var(--space-2);
  min-height: 56px;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  font-variant-numeric: tabular-nums;
}

.day--today {
  background: color-mix(in srgb, var(--accent) 14%, var(--surface-sunken));
}

.day__when {
  display: grid;
  min-width: 0;
}

.day__name {
  font-weight: var(--weight-medium);
  text-transform: capitalize;
}

.day__date {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.day__avg {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  text-align: right;
}

.day__range {
  color: var(--text-muted);
  font-size: var(--text-sm);
  text-align: right;
  white-space: nowrap;
}

.day__range-sep {
  margin-inline: 2px;
  opacity: 0.6;
}

.day__rain {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  color: var(--icon-rain);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.week__note {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

@media (max-width: 400px) {
  .day {
    grid-template-columns: minmax(0, 1fr) 34px 40px auto 44px;
    gap: var(--space-1);
    padding-inline: var(--space-2);
  }
}
</style>
