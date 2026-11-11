<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from '@/i18n'

export interface JumpTarget {
  /** DOM id of the block to scroll to. */
  id: string
  label: string
}

/**
 * Sticky row of city chips for phones and tablets: tap to scroll to that block. The chip of the block in view is
 * highlighted (IntersectionObserver). Hidden on wide screens, where blocks are easy to scan.
 */
const props = defineProps<{ targets: JumpTarget[] }>()

const { t } = useI18n()
const current = ref<string | null>(null)
const bar = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

function observe() {
  observer?.disconnect()
  if (typeof IntersectionObserver === 'undefined') return
  const visible = new Map<string, number>()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) visible.set(entry.target.id, entry.intersectionRatio)
      let best: string | null = null
      let bestRatio = 0
      for (const target of props.targets) {
        const ratio = visible.get(target.id) ?? 0
        if (ratio > bestRatio) {
          best = target.id
          bestRatio = ratio
        }
      }
      if (best) current.value = best
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-64px 0px 0px 0px' },
  )
  for (const target of props.targets) {
    const element = document.getElementById(target.id)
    if (element) observer.observe(element)
  }
}

watch(
  () => props.targets.map((target) => target.id).join(),
  () => nextTick(observe),
  { immediate: true },
)

onBeforeUnmount(() => observer?.disconnect())

// Keep the active chip visible in a long, horizontally scrolling bar.
watch(current, (id) => {
  const chip = bar.value?.querySelector<HTMLElement>(`[data-target="${id}"]`)
  chip?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

function jump(id: string) {
  const element = document.getElementById(id)
  if (!element) return
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  element.focus({ preventScroll: true })
  current.value = id
}
</script>

<template>
  <nav ref="bar" class="jump" :aria-label="t('jump.label')">
    <button
      v-for="target in targets"
      :key="target.id"
      type="button"
      class="jump__chip"
      :data-target="target.id"
      :aria-current="current === target.id ? 'true' : undefined"
      @click="jump(target.id)"
    >
      {{ target.label }}
    </button>
  </nav>
</template>

<style scoped>
.jump {
  position: sticky;
  z-index: 15;
  top: 0;
  display: flex;
  gap: var(--space-2);
  margin-inline: calc(-1 * var(--gutter));
  padding: var(--space-2) var(--gutter);
  overflow-x: auto;
  scrollbar-width: none;
  background: color-mix(in srgb, var(--bg-sky-top) 82%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.jump::-webkit-scrollbar {
  display: none;
}

.jump__chip {
  flex-shrink: 0;
  min-height: var(--control-height-sm);
  padding: 0 var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.jump__chip[aria-current='true'] {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-text);
}

@media (min-width: 1024px) {
  .jump {
    display: none;
  }
}
</style>
