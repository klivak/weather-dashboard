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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from '@/i18n'
import { useThemeStore } from '@/stores/theme'
import { formatTemp } from '@/utils/format'
import WeatherIcon from './WeatherIcon.vue'

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
  /** Weather icon shown under the point. */
  icon?: { code: number; day: boolean }
  /** Chance of precipitation 0..1, shown under the icon from 10%. */
  pop?: number
}

const props = defineProps<{
  points: ChartPoint[]
  /** Used as the caption of the hidden data table; the visible caption is rendered by the parent figure. */
  title: string
  /** One-sentence description for screen readers. */
  summary: string
  /** Index of the first point of the next day, marked with a dashed line and `boundaryLabel`. */
  boundaryIndex?: number
  boundaryLabel?: string
}>()

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const { t } = useI18n()
const themeStore = useThemeStore()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let chart: Chart<'line', number[], string> | undefined

const hasIcons = computed(() => props.points.some((point) => point.icon))
/** Horizontal insets of the plot area, so the icon strip lines up with the points. */
const plotInset = ref({ left: 8, right: 8 })

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

/** Dashed line between the last point of today and the first of tomorrow, with a small label. */
const dayBoundary: Plugin<'line'> = {
  id: 'dayBoundary',
  beforeDatasetsDraw(target) {
    const index = props.boundaryIndex
    if (index === undefined || index <= 0) return
    const meta = target.getDatasetMeta(mainIndex())
    const before = meta.data[index - 1]
    const after = meta.data[index]
    if (!before || !after) return
    const x = (before.x + after.x) / 2
    const { ctx, chartArea } = target
    ctx.save()
    ctx.strokeStyle = cssVar('--border-strong')
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    if (props.boundaryLabel) {
      ctx.setLineDash([])
      ctx.font = `500 11px ${cssVar('--font-sans')}`
      ctx.fillStyle = cssVar('--text-muted')
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(props.boundaryLabel, x + 6, chartArea.top + 2)
    }
    ctx.restore()
  },
}

/** Reports where the plot area sits after every layout (first render and resizes). */
const trackPlotArea: Plugin<'line'> = {
  id: 'trackPlotArea',
  afterLayout(target) {
    const left = Math.round(target.chartArea.left)
    const right = Math.round(target.width - target.chartArea.right)
    if (left !== plotInset.value.left || right !== plotInset.value.right) plotInset.value = { left, right }
  },
}

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
          // Each point sits in the middle of an equal band, the same grid the icon strip below uses.
          offset: true,
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
    plugins: [trackPlotArea, dayBoundary, valueLabels],
  }
}

function render() {
  if (!canvas.value || !props.points.length) return
  chart?.destroy()
  chart = new Chart(canvas.value, buildConfig())
}

onMounted(() => {
  // Building the chart is the heaviest task on the page; let the browser paint the card first.
  const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1))
  idle(() => render(), { timeout: 300 })
})
onBeforeUnmount(() => chart?.destroy())

// New data or labels: rebuild on the same canvas. Theme: colours come from CSS, so rebuild after the DOM updates.
watch([() => props.points, () => props.boundaryIndex, () => props.boundaryLabel], render, { deep: true })
watch(
  () => themeStore.theme,
  () => nextTick(render),
)
</script>

<template>
  <div class="chart">
    <div class="chart__canvas">
      <canvas ref="canvas" role="img" :aria-label="summary" />
    </div>
    <ol
      v-if="hasIcons"
      class="chart__strip"
      aria-hidden="true"
      :style="{
        paddingLeft: `${plotInset.left}px`,
        paddingRight: `${plotInset.right}px`,
        gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
      }"
    >
      <li v-for="point in points" :key="point.title" class="chart__slot">
        <WeatherIcon v-if="point.icon" :code="point.icon.code" :day="point.icon.day" :size="26" />
        <span class="chart__pop">{{
          point.pop !== undefined && point.pop >= 0.1 ? `${Math.round(point.pop * 100)}%` : ''
        }}</span>
      </li>
    </ol>
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
  </div>
</template>

<style scoped>
.chart {
  min-width: 0;
}

.chart__strip {
  display: grid;
  margin: var(--space-1) 0 0;
  padding-block: 0;
  list-style: none;
}

.chart__slot {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 0;
}

.chart__pop {
  min-height: 1.2em;
  color: var(--icon-rain);
  font-size: 11px;
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
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
