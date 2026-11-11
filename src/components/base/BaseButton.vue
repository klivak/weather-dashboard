<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger'
    size?: 'md' | 'sm'
    iconOnly?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'ghost', size: 'md', iconOnly: false, type: 'button' },
)
</script>

<template>
  <button :type="type" class="btn" :class="[`btn--${variant}`, `btn--${size}`, { 'btn--icon': iconOnly }]">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--control-height);
  padding: 0 var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn--sm {
  min-height: var(--control-height-sm);
  padding: 0 var(--space-4);
}

.btn--icon {
  width: var(--control-height);
  padding: 0;
}

.btn--icon.btn--sm {
  width: var(--control-height-sm);
}

.btn--primary {
  background: var(--accent);
  color: var(--accent-text);
}

.btn--primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn--ghost {
  background: transparent;
  color: var(--text);
  border-color: var(--border);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--surface-sunken);
  border-color: var(--border-strong);
}

.btn--danger {
  background: var(--danger);
  color: var(--danger-text);
}

.btn--danger:hover:not(:disabled) {
  filter: brightness(1.06);
}
</style>
