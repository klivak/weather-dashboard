<script setup lang="ts">
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { useI18n } from '@/i18n'

/** "Updated 5 min ago" with a refresh button, shown inline in a card's meta line. */
defineProps<{ label: string; refreshing: boolean }>()

const emit = defineEmits<{ refresh: [] }>()

const { t } = useI18n()
</script>

<template>
  <span class="stamp">
    <span>{{ label }}</span>
    <button
      type="button"
      class="stamp__refresh"
      :aria-label="t('updated.refresh')"
      :title="t('updated.refresh')"
      :disabled="refreshing"
      @click="emit('refresh')"
    >
      <BaseSpinner v-if="refreshing" :size="14" />
      <svg
        v-else
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
      </svg>
    </button>
  </span>
</template>

<style scoped>
/* Its own short line under the place and time, so wrapping never leaves a dangling separator. */
.stamp {
  display: flex;
  flex-basis: 100%;
  align-items: center;
  gap: var(--space-1);
  white-space: nowrap;
}

/* 24px visual size with a 32px hit area (WCAG 2.2 target size). */
.stamp__refresh {
  position: relative;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  transition:
    color var(--dur-fast) var(--ease-out),
    transform var(--dur-base) var(--ease-out);
}

.stamp__refresh::after {
  content: '';
  position: absolute;
  inset: -4px;
}

.stamp__refresh:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface-sunken);
  transform: rotate(-60deg);
}

.stamp__refresh:disabled {
  cursor: progress;
}
</style>
