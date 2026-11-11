<script setup lang="ts">
import { onBeforeUnmount, onMounted, useId, useTemplateRef, watch } from 'vue'

/**
 * Modal built on the native <dialog>: showModal() gives focus containment, Esc to close, an inert page behind it
 * and focus return to the trigger. Clicking the scrim closes it too.
 */
defineProps<{ title: string; description?: string }>()

const open = defineModel<boolean>('open', { required: true })

defineSlots<{ default?: () => unknown; actions?: () => unknown }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
const descriptionId = useId()

const CLOSE_MS = 180
let closeTimer: ReturnType<typeof setTimeout> | undefined

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Fade the panel and scrim out, then close the native dialog (which returns focus to the trigger). */
function closeAnimated(element: HTMLDialogElement) {
  if (reducedMotion()) return element.close()
  element.classList.add('modal--closing')
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    element.classList.remove('modal--closing')
    if (element.open) element.close()
  }, CLOSE_MS)
}

function sync(value: boolean) {
  const element = dialog.value
  if (!element) return
  if (value && !element.open) {
    clearTimeout(closeTimer)
    element.classList.remove('modal--closing')
    element.showModal()
  }
  if (!value && element.open) closeAnimated(element)
}

watch(open, sync)
onMounted(() => sync(open.value))
onBeforeUnmount(() => {
  clearTimeout(closeTimer)
  if (dialog.value?.open) dialog.value.close()
})

/** Esc: animate out instead of the browser's instant close. */
function onCancel(event: Event) {
  event.preventDefault()
  open.value = false
}

function onClose() {
  open.value = false
}

function onClick(event: MouseEvent) {
  // A click whose target is the <dialog> itself landed on the backdrop area outside the panel.
  if (event.target === dialog.value) open.value = false
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="modal"
      :aria-labelledby="titleId"
      :aria-describedby="description ? descriptionId : undefined"
      @cancel="onCancel"
      @close="onClose"
      @click="onClick"
    >
      <div class="modal__panel">
        <h2 :id="titleId" class="modal__title">{{ title }}</h2>
        <p v-if="description" :id="descriptionId" class="modal__description">{{ description }}</p>
        <slot />
        <div v-if="$slots.actions" class="modal__actions"><slot name="actions" /></div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.modal {
  width: min(440px, calc(100vw - 2 * var(--space-4)));
  max-height: calc(100dvh - 2 * var(--space-4));
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  color: var(--text);
  box-shadow: var(--shadow-2);
  overflow: auto;
}

.modal[open] {
  animation: modal-in var(--dur-base) var(--ease-out);
}

.modal::backdrop {
  background: var(--scrim);
  animation: scrim-in var(--dur-base) var(--ease-out);
}

.modal.modal--closing {
  animation: modal-out 180ms var(--ease-out) forwards;
}

.modal.modal--closing::backdrop {
  animation: scrim-out 180ms var(--ease-out) forwards;
}

@keyframes modal-out {
  to {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
}

@keyframes scrim-out {
  to {
    opacity: 0;
  }
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

@keyframes scrim-in {
  from {
    opacity: 0;
  }
}

.modal__panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-6);
}

.modal__title {
  font-size: var(--text-lg);
}

.modal__description {
  color: var(--text-muted);
}

.modal__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

@media (max-width: 479px) {
  .modal__actions {
    flex-direction: column-reverse;
  }

  .modal__actions > :deep(*) {
    width: 100%;
  }
}
</style>
