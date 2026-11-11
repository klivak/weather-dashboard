<script setup lang="ts">
import IconClose from '@/components/icons/IconClose.vue'
import IconStar from '@/components/icons/IconStar.vue'
import IconTrash from '@/components/icons/IconTrash.vue'
import { useToasts } from '@/composables/useToasts'
import { useI18n } from '@/i18n'

const { t } = useI18n()
const { toasts, dismiss, runAction, hold, release } = useToasts()

function onFocusOut(event: FocusEvent) {
  const host = event.currentTarget as HTMLElement
  if (!host.contains(event.relatedTarget as Node | null)) release()
}
</script>

<template>
  <!-- Text is spoken by the shared live region; this region holds the visible toasts and their buttons. -->
  <section
    class="toasts"
    :aria-label="t('toast.region')"
    @mouseenter="hold"
    @mouseleave="release"
    @focusin="hold"
    @focusout="onFocusOut"
  >
    <TransitionGroup name="toast" tag="ol" class="toasts__list">
      <li v-for="toast in toasts" :key="toast.id" class="toast">
        <span class="toast__icon" :class="`toast__icon--${toast.icon}`" aria-hidden="true">
          <IconStar v-if="toast.icon === 'star'" filled :size="18" />
          <IconTrash v-else-if="toast.icon === 'trash'" :size="18" />
          <svg
            v-else
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span class="toast__message">{{ toast.message }}</span>
        <button v-if="toast.action" type="button" class="toast__action" @click="runAction(toast)">
          {{ toast.action.label }}
        </button>
        <button type="button" class="toast__close" :aria-label="t('toast.close')" @click="dismiss(toast.id)">
          <IconClose :size="16" />
        </button>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.toasts {
  position: fixed;
  z-index: 50;
  left: 50%;
  bottom: max(var(--space-4), env(safe-area-inset-bottom));
  width: min(440px, calc(100vw - 2 * var(--gutter)));
  transform: translateX(-50%);
  pointer-events: none;
}

.toasts__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 52px;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  box-shadow: var(--shadow-2);
  pointer-events: auto;
}

.toast__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--surface-sunken);
  color: var(--text-muted);
  flex-shrink: 0;
}

.toast__icon--star {
  color: var(--fav);
}

.toast__icon--check {
  color: var(--accent-text);
  background: var(--accent);
}

.toast__message {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
}

.toast__action {
  min-height: var(--control-height-sm);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--focus);
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
}

.toast__action:hover {
  background: var(--surface-sunken);
}

.toast__close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
}

.toast__close:hover {
  background: var(--surface-sunken);
  color: var(--text);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease-out);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
