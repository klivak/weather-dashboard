<script setup lang="ts">
defineProps<{ title: string; text?: string }>()

defineSlots<{ icon?: () => unknown; action?: () => unknown }>()
</script>

<template>
  <div class="empty">
    <div v-if="$slots.icon" class="empty__icon" aria-hidden="true"><slot name="icon" /></div>
    <h3 class="empty__title">{{ title }}</h3>
    <p v-if="text" class="empty__text">{{ text }}</p>
    <div v-if="$slots.action" class="empty__action"><slot name="action" /></div>
  </div>
</template>

<style scoped>
.empty {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-6);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  text-align: center;
}

.empty__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--surface-sunken);
  color: var(--fav);
}

.empty__title {
  font-size: var(--text-lg);
}

.empty__text {
  max-width: 40ch;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.empty__action {
  margin-top: var(--space-2);
}
</style>
