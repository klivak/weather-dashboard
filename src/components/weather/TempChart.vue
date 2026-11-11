<script setup lang="ts">
import {
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js'
import { computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import type { TempPoint } from '@/domain/forecast'
import { useI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { formatDayDate, formatTemp, formatTime } from '@/utils/format'

const props = defineProps<{
  points: TempPoint[]
  /** City offset from UTC in seconds. */
  timezone: number
  cityName: string
  title: string
  subtitle: string
}>()

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const { t, locale } = useI18n()
const settings = useSettingsStore()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let chart: Chart<'line', number[], string> | undefined

const labels = computed(() =>
  props.points.map((point) =>
    point.now ? t('chart.now') : formatTime(point.dt, props.timezone, locale.value),
  ),
)

const summary = computed(() => {
  if (!props.points.length) return ''
  const first = props.points[0]!
  let max = first
  let min = first
  for (const point of props.points) {
    if (point.temp > max.temp) max = point
    if (point.temp < min.temp) min = point
  }
  const at = (point: TempPoint) => formatTime(point.dt, props.timezone, locale.value)
  return t('chart.summary', {
    city: props.cityName,
    now: formatTemp(first.temp),
    max: formatTemp(max.temp),
    maxTime: at(max),
    min: formatTemp(min.temp),
    minTime: at(min),
  })
})

function cssVar(name: string): string {
  return canvas.value ? getComputedStyle(canvas.value).getPropertyValue(name).trim() : ''
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Draws each temperature above its point, so the chart reads without a y-axis. */
const valueLabels: Plugin<'line'> = {
  id: 'valueLabels',
  afterDatasetsDraw(target) {
    const { ctx } = target
    const meta = target.getDatasetMeta(0)
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    meta.data.forEach((element, index) => {
      const point = props.points[index]
      if (!point) return
      ctx.font = `${point.now ? 650 : 500} 12px ${cssVar('--font-sans')}`
      ctx.fillStyle = point.now ? cssVar('--text') : cssVar('--text-muted')
      ctx.fillText(formatTemp(point.temp), element.x, element.y - 10)
    })
    ctx.restore()
  },
}

function colors() {
  return {
    line: cssVar('--chart-line'),
    fill: cssVar('--chart-fill'),
    grid: cssVar('--chart-grid'),
    text: cssVar('--text-muted'),
    accent: cssVar('--accent'),
    surface: cssVar('--surface-raised'),
    font: cssVar('--font-sans'),
  }
}

function buildConfig(): ChartConfiguration<'line', number[], string> {
  const c = colors()
  const temps = props.points.map((point) => point.temp)
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  return {
    type: 'line',
    data: {
      labels: labels.value,
      datasets: [
        {
          data: temps,
          borderColor: c.line,
          borderWidth: 2.5,
          tension: 0.38,
          fill: 'start',
          backgroundColor: (context) => {
            const area = context.chart.chartArea
            if (!area) return c.fill
            const gradient = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
            gradient.addColorStop(0, c.fill)
            gradient.addColorStop(1, 'rgba(0,0,0,0)')
            return gradient
          },
          pointRadius: props.points.map((point) => (point.now ? 5.5 : 3.5)),
          pointHoverRadius: 7,
          pointBackgroundColor: props.points.map((point) => (point.now ? c.accent : c.surface)),
          pointBorderColor: props.points.map((point) => (point.now ? c.accent : c.line)),
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reducedMotion() ? false : { duration: 700, easing: 'easeOutQuart' },
      layout: { padding: { top: 26, left: 8, right: 8 } },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: c.text, font: { family: c.font, size: 12 }, maxRotation: 0, autoSkipPadding: 10 },
        },
        y: {
          display: true,
          suggestedMin: Math.floor(min) - 2,
          suggestedMax: Math.ceil(max) + 2,
          grid: { color: c.grid, drawTicks: false },
          border: { display: false },
          ticks: { display: false, maxTicksLimit: 5 },
        },
      },
      plugins: {
        tooltip: {
          displayColors: false,
          backgroundColor: c.surface,
          titleColor: c.text,
          bodyColor: c.line,
          borderColor: c.grid,
          borderWidth: 1,
          padding: 10,
          titleFont: { family: c.font, size: 12, weight: 'normal' },
          bodyFont: { family: c.font, size: 14, weight: 'bold' },
          callbacks: {
            title: (items) => {
              const point = props.points[items[0]?.dataIndex ?? 0]
              return point
                ? `${formatDayDate(point.dt, props.timezone, locale.value)}, ${formatTime(point.dt, props.timezone, locale.value)}`
                : ''
            },
            label: (item) => formatTemp(item.parsed.y ?? 0),
          },
        },
      },
    },
    plugins: [valueLabels],
  }
}

function render() {
  if (!canvas.value || !props.points.length) return
  chart?.destroy()
  chart = new Chart(canvas.value, buildConfig())
}

onMounted(render)
onBeforeUnmount(() => chart?.destroy())

// New data or language: rebuild with the same canvas. Theme: colours are read from CSS, so rebuild after the DOM updates.
watch([() => props.points, labels], render)
watch(
  () => settings.theme,
  () => nextTick(render),
)
</script>

<template>
  <figure class="chart">
    <figcaption class="chart__caption">
      <span class="chart__title">{{ title }}</span>
      <span class="chart__subtitle">{{ subtitle }}</span>
    </figcaption>
    <div class="chart__canvas">
      <canvas ref="canvas" role="img" :aria-label="summary" />
    </div>
    <table class="visually-hidden">
      <caption>
        {{
          title
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ t('chart.time') }}</th>
          <th scope="col">{{ t('chart.temperature') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(point, index) in points" :key="point.dt">
          <td>{{ labels[index] }}</td>
          <td>{{ formatTemp(point.temp) }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
.chart {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  margin: 0;
}

.chart__caption {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
}

.chart__title {
  font-weight: var(--weight-bold);
}

.chart__subtitle {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.chart__canvas {
  position: relative;
  height: 220px;
}

@media (min-width: 1024px) {
  .chart__canvas {
    height: 260px;
  }
}
</style>
