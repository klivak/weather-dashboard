<script setup lang="ts" generic="T extends string">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

export interface TabItem<V extends string> {
  id: V
  label: string
  /** Optional counter shown next to the label. */
  badge?: number
}

const props = defineProps<{
  tabs: readonly TabItem<T>[]
  label: string
}>()

const model = defineModel<T>({ required: true })

defineSlots<{ icon?: (props: { id: T; active: boolean }) => unknown }>()

const buttons = useTemplateRef<HTMLButtonElement[]>('buttons')
const indicator = ref({ x: 0, width: 0, ready: false })

function measure() {
  const index = props.tabs.findIndex((tab) => tab.id === model.value)
  const button = buttons.value?.[index]
  if (!button) return
  indicator.value = { x: button.offsetLeft, width: button.offsetWidth, ready: true }
}

let observer: ResizeObserver | undefined

onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  for (const button of buttons.value ?? []) observer.observe(button)
})

onBeforeUnmount(() => observer?.disconnect())

watch([model, () => props.tabs], () => nextTick(measure), { deep: true })

function select(index: number) {
  const tab = props.tabs[index]
  if (!tab) return
  model.value = tab.id
  buttons.value?.[index]?.focus()
}

function onKeydown(event: KeyboardEvent, index: number) {
  const last = props.tabs.length - 1
  const keys: Record<string, number> = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }
  const next = keys[event.key]
  if (next === undefined) return
  event.preventDefault()
  select(next)
}
</script>

<template>
  <div class="tabs" role="tablist" :aria-label="label">
    <button
      v-for="(tab, index) in tabs"
      :id="`tab-${tab.id}`"
      :key="tab.id"
      ref="buttons"
      type="button"
      role="tab"
      class="tabs__tab"
      :aria-selected="tab.id === model"
      :aria-controls="`panel-${tab.id}`"
      :tabindex="tab.id === model ? 0 : -1"
      @click="select(index)"
      @keydown="onKeydown($event, index)"
    >
      <slot :id="tab.id" name="icon" :active="tab.id === model" />
      <span>{{ tab.label }}</span>
      <span v-if="tab.badge" class="tabs__badge">{{ tab.badge }}</span>
    </button>
    <span
      class="tabs__indicator"
      :class="{ 'tabs__indicator--ready': indicator.ready }"
      aria-hidden="true"
      :style="{ transform: `translateX(${indicator.x}px)`, width: `${indicator.width}px` }"
    />
  </div>
</template>

<style scoped>
.tabs {
  position: relative;
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--border);
}

.tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-height);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
  transition: color var(--dur-fast) var(--ease-out);
}

.tabs__tab:hover,
.tabs__tab[aria-selected='true'] {
  color: var(--text);
}

.tabs__tab:focus-visible {
  outline-offset: -2px;
}

.tabs__badge {
  min-width: 22px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  color: var(--text-muted);
  font-size: var(--text-xs);
  line-height: 22px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.tabs__indicator {
  position: absolute;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  opacity: 0;
}

.tabs__indicator--ready {
  opacity: 1;
  transition:
    transform var(--dur-base) var(--ease-out),
    width var(--dur-base) var(--ease-out);
}
</style>
