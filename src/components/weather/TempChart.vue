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
  type ChartDataset,
  type Plugin,
} from 'chart.js'
import { computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { useI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { formatTemp } from '@/utils/format'

export interface ChartPoint {
  /** Axis label, e.g. "14:00" or "Thu". */
  label: string
  /** Full label for the tooltip and the data table, e.g. "Wed 11 Nov, 14:00". */
  title: string
  value: number
  /** Optional low/high drawn as a band around the line (daily view). */
  min?: number
  max?: number
  /** Emphasised point, e.g. the live reading. */
  highlight?: boolean
}

const props = defineProps<{
  points: ChartPoint[]
  title: string
  subtitle: string
  /** One-sentence description for screen readers. */
  summary: string
}>()

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const { t } = useI18n()
const settings = useSettingsStore()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let chart: Chart<'line', number[], string> | undefined

const hasRange = computed(() =>
  props.points.some((point) => point.min !== undefined && point.max !== undefined),
)

function cssVar(name: string): string {
  return canvas.value ? getComputedStyle(canvas.value).getPropertyValue(name).trim() : ''
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Index of the main line among the datasets (the band datasets come first so they draw underneath). */
const mainIndex = () => (hasRange.value ? 2 : 0)

/** Draws each value above its point, so the chart reads without a y-axis. */
const valueLabels: Plugin<'line'> = {
  id: 'valueLabels',
  afterDatasetsDraw(target) {
    const { ctx } = target
    const meta = target.getDatasetMeta(mainIndex())
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    meta.data.forEach((element, index) => {
      const point = props.points[index]
      if (!point) return
      ctx.font = `${point.highlight ? 650 : 500} 12px ${cssVar('--font-sans')}`
      ctx.fillStyle = point.highlight ? cssVar('--text') : cssVar('--text-muted')
      ctx.fillText(formatTemp(point.value), element.x, element.y - 10)
    })
    ctx.restore()
  },
}

function buildConfig(): ChartConfiguration<'line', number[], string> {
  const c = {
    line: cssVar('--chart-line'),
    fill: cssVar('--chart-fill'),
    grid: cssVar('--chart-grid'),
    text: cssVar('--text-muted'),
    accent: cssVar('--accent'),
    surface: cssVar('--surface-raised'),
    font: cssVar('--font-sans'),
  }
  const values = props.points.map((point) => point.value)
  const lows = props.points.map((point) => point.min ?? point.value)
  const highs = props.points.map((point) => point.max ?? point.value)

  const main: ChartDataset<'line', number[]> = {
    data: values,
    borderColor: c.line,
    borderWidth: 2.5,
    tension: 0.38,
    fill: hasRange.value ? false : 'start',
    backgroundColor: (context) => {
      const area = context.chart.chartArea
      if (!area) return c.fill
      const gradient = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
      gradient.addColorStop(0, c.fill)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      return gradient
    },
    pointRadius: props.points.map((point) => (point.highlight ? 5.5 : 3.5)),
    pointHoverRadius: 7,
    pointBackgroundColor: props.points.map((point) => (point.highlight ? c.accent : c.surface)),
    pointBorderColor: props.points.map((point) => (point.highlight ? c.accent : c.line)),
    pointBorderWidth: 2,
  }
  const band = (
    data: number[],
    fill: ChartDataset<'line', number[]>['fill'],
  ): ChartDataset<'line', number[]> => ({
    data,
    borderWidth: 0,
    pointRadius: 0,
    pointHoverRadius: 0,
    tension: 0.38,
    fill,
    backgroundColor: c.fill,
  })

  return {
    type: 'line',
    data: {
      labels: props.points.map((point) => point.label),
      datasets: hasRange.value ? [band(highs, false), band(lows, '-1'), main] : [main],
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
          suggestedMin: Math.floor(Math.min(...lows)) - 2,
          suggestedMax: Math.ceil(Math.max(...highs)) + 2,
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
          filter: (item) => item.datasetIndex === mainIndex(),
          callbacks: {
            title: (items) => props.points[items[0]?.dataIndex ?? 0]?.title ?? '',
            label: (item) => {
              const point = props.points[item.dataIndex]
              if (!point) return ''
              return point.min !== undefined && point.max !== undefined
                ? `${formatTemp(point.value)}  (${formatTemp(point.min)} … ${formatTemp(point.max)})`
                : formatTemp(point.value)
            },
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

// New data or labels: rebuild on the same canvas. Theme: colours come from CSS, so rebuild after the DOM updates.
watch(() => props.points, render, { deep: true })
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
          <th v-if="hasRange" scope="col">{{ t('chart.range') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="point in points" :key="point.title">
          <td>{{ point.title }}</td>
          <td>{{ formatTemp(point.value) }}</td>
          <td v-if="hasRange">
            {{ point.min !== undefined ? formatTemp(point.min) : '' }} …
            {{ point.max !== undefined ? formatTemp(point.max) : '' }}
          </td>
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
