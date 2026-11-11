<script setup lang="ts" generic="T extends string">
import { computed, useTemplateRef } from 'vue'

export interface SegmentOption<V extends string> {
  value: V
  label: string
  /** Longer accessible name when the visible label is short (e.g. "EN"). */
  ariaLabel?: string
}

const props = withDefaults(
  defineProps<{
    options: readonly SegmentOption<T>[]
    label: string
    size?: 'md' | 'sm'
  }>(),
  { size: 'md' },
)

const model = defineModel<T>({ required: true })

defineSlots<{ option?: (props: { option: SegmentOption<T> }) => unknown }>()

const buttons = useTemplateRef<HTMLButtonElement[]>('buttons')

const activeIndex = computed(() =>
  Math.max(
    0,
    props.options.findIndex((option) => option.value === model.value),
  ),
)

function select(index: number) {
  const option = props.options[index]
  if (!option) return
  model.value = option.value
  buttons.value?.[index]?.focus()
}

function onKeydown(event: KeyboardEvent, index: number) {
  const last = props.options.length - 1
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? index === last
        ? 0
        : index + 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? index === 0
          ? last
          : index - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : null
  if (next === null) return
  event.preventDefault()
  select(next)
}
</script>

<template>
  <div
    class="segmented"
    :class="`segmented--${size}`"
    role="radiogroup"
    :aria-label="label"
    :style="{ '--count': options.length, '--index': activeIndex }"
  >
    <span class="segmented__thumb" aria-hidden="true" />
    <button
      v-for="(option, index) in options"
      :key="option.value"
      ref="buttons"
      type="button"
      role="radio"
      class="segmented__option"
      :aria-checked="option.value === model"
      :aria-label="option.ariaLabel"
      :tabindex="option.value === model ? 0 : -1"
      @click="select(index)"
      @keydown="onKeydown($event, index)"
    >
      <slot name="option" :option="option">{{ option.label }}</slot>
    </button>
  </div>
</template>

<style scoped>
.segmented {
  --pad: 3px;
  position: relative;
  display: inline-grid;
  grid-template-columns: repeat(var(--count), minmax(0, 1fr));
  padding: var(--pad);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  isolation: isolate;
}

.segmented__thumb {
  position: absolute;
  z-index: -1;
  top: var(--pad);
  bottom: var(--pad);
  left: var(--pad);
  width: calc((100% - 2 * var(--pad)) / var(--count));
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  box-shadow: var(--shadow-1);
  transform: translateX(calc(100% * var(--index)));
  transition: transform var(--dur-base) var(--ease-out);
}

.segmented__option {
  min-width: 0;
  min-height: calc(var(--control-height) - 2 * var(--pad) - 2px);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out);
}

.segmented--sm .segmented__option {
  min-height: calc(var(--control-height-sm) - 2 * var(--pad) - 2px);
  padding: 0 var(--space-3);
  font-size: var(--text-xs);
}

.segmented__option[aria-checked='true'] {
  color: var(--text);
}

.segmented__option:hover {
  color: var(--text);
}
</style>
