import { computed, type Ref } from 'vue'
import type { CurrentWeather, Forecast } from '@/api/models'
import type { ChartPoint } from '@/components/weather/TempChart.vue'
import {
  dailySummaries,
  localDateKey,
  todaySeries,
  type DaySummary,
  type ForecastView,
} from '@/domain/forecast'
import { useI18n } from '@/i18n'
import { formatDayDate, formatShortWeekday, formatTemp, formatTime } from '@/utils/format'

export interface BlockChart {
  points: ChartPoint[]
  title: string
  subtitle: string
  /** One sentence for screen readers. */
  summary: string
  /** Index where tomorrow's points start in the hourly view (late evening only). */
  boundaryIndex: number | undefined
}

function extreme<T extends { value: number }>(points: T[], pick: 'max' | 'min'): T | undefined {
  let best: T | undefined
  for (const point of points) {
    if (!best || (pick === 'max' ? point.value > best.value : point.value < best.value)) best = point
  }
  return best
}

/**
 * Everything a weather block shows derived from its data: the hourly series, the daily summaries and the chart
 * (points, titles and the screen-reader summary) for the chosen view. Pure presentation logic, kept out of the
 * component so it can be reasoned about on its own.
 */
export function useBlockChart(
  current: Ref<CurrentWeather | null>,
  forecast: Ref<Forecast | null>,
  view: Ref<ForecastView>,
  cityLabel: Ref<string>,
) {
  const { t, locale } = useI18n()

  const timezone = computed(() => forecast.value?.timezone ?? current.value?.timezone ?? 0)
  const today = computed(() => (current.value ? localDateKey(current.value.dt, current.value.timezone) : ''))
  const series = computed(() =>
    current.value && forecast.value ? todaySeries(current.value, forecast.value) : [],
  )
  const days = computed<DaySummary[]>(() => (forecast.value ? dailySummaries(forecast.value) : []))

  const time = (dt: number) => formatTime(dt, timezone.value, locale.value)

  const hourly = computed(() => {
    const points = series.value.map((point) => ({
      dt: point.dt,
      label: point.now ? t('chart.now') : time(point.dt),
      title: `${formatDayDate(point.dt, timezone.value, locale.value)}, ${time(point.dt)}`,
      value: point.temp,
      highlight: point.now,
      icon: { code: point.condition.id, day: point.isDay },
      ...(point.pop !== undefined ? { pop: point.pop } : {}),
    }))
    const max = extreme(points, 'max')
    const min = extreme(points, 'min')
    const first = points[0]
    const boundary = series.value.findIndex((point) => point.nextDay)
    return {
      points,
      title: t('chart.title'),
      subtitle: t('chart.subtitle'),
      summary:
        first && max && min
          ? t('chart.summary', {
              city: cityLabel.value,
              now: formatTemp(first.value),
              max: formatTemp(max.value),
              maxTime: time(max.dt),
              min: formatTemp(min.value),
              minTime: time(min.dt),
            })
          : '',
      boundaryIndex: boundary > 0 ? boundary : undefined,
    }
  })

  const daily = computed(() => {
    const points = days.value.map((day) => ({
      label:
        day.date === today.value ? t('week.today') : formatShortWeekday(day.dt, timezone.value, locale.value),
      title: formatDayDate(day.dt, timezone.value, locale.value),
      value: day.avg,
      min: day.min,
      max: day.max,
      highlight: day.date === today.value,
      icon: { code: day.condition.id, day: true },
      pop: day.pop,
    }))
    const warm = extreme(points, 'max')
    const cold = extreme(points, 'min')
    return {
      points,
      title: t('chart.weekTitle'),
      subtitle: t('chart.weekSubtitle'),
      summary:
        warm && cold
          ? t('chart.weekSummary', {
              city: cityLabel.value,
              warm: warm.title,
              warmTemp: formatTemp(warm.value),
              cold: cold.title,
              coldTemp: formatTemp(cold.value),
            })
          : '',
      boundaryIndex: undefined,
    }
  })

  const chart = computed<BlockChart>(() => (view.value === 'week' ? daily.value : hourly.value))

  return { chart, days, today, timezone }
}
