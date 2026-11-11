<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, useTemplateRef } from 'vue'

export interface MenuItem {
  id: string
  label: string
  disabled?: boolean
}

/**
 * WAI-ARIA menu button: Enter/Space/ArrowDown open the menu on the first item, arrows move, Home/End jump,
 * Esc or Tab close it and focus returns to the button. A click outside closes it too.
 */
const props = defineProps<{ label: string; items: MenuItem[] }>()

const emit = defineEmits<{ select: [id: string] }>()

defineSlots<{ default?: () => unknown }>()

const open = ref(false)
const active = ref(0)
const id = useId()
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const itemRefs = useTemplateRef<HTMLButtonElement[]>('itemRefs')

function enabledIndexes(): number[] {
  return props.items.flatMap((item, index) => (item.disabled ? [] : [index]))
}

async function focusItem(index: number) {
  active.value = index
  await nextTick()
  itemRefs.value?.[index]?.focus()
}

function onOutside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close(false)
}

async function openMenu(at: 'first' | 'last' = 'first') {
  open.value = true
  document.addEventListener('pointerdown', onOutside)
  const enabled = enabledIndexes()
  const index = at === 'first' ? enabled[0] : enabled.at(-1)
  if (index !== undefined) await focusItem(index)
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onOutside)
  if (returnFocus) trigger.value?.focus()
}

onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    void openMenu('first')
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    void openMenu('last')
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  const enabled = enabledIndexes()
  const position = enabled.indexOf(active.value)
  const go = (next: number | undefined) => {
    event.preventDefault()
    if (next !== undefined) void focusItem(next)
  }
  switch (event.key) {
    case 'ArrowDown':
      return go(enabled[(position + 1) % enabled.length])
    case 'ArrowUp':
      return go(enabled[(position - 1 + enabled.length) % enabled.length])
    case 'Home':
      return go(enabled[0])
    case 'End':
      return go(enabled.at(-1))
    case 'Escape':
      event.preventDefault()
      return close()
    case 'Tab':
      return close(false)
  }
}

function choose(item: MenuItem) {
  if (item.disabled) return
  close()
  emit('select', item.id)
}
</script>

<template>
  <div ref="root" class="menu">
    <button
      ref="trigger"
      type="button"
      class="menu__trigger"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="`${id}-menu`"
      :aria-label="label"
      :title="label"
      @click="open ? close() : openMenu()"
      @keydown="onTriggerKeydown"
    >
      <slot>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5.5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="18.5" r="1.8" />
        </svg>
      </slot>
    </button>
    <Transition name="menu">
      <ul
        v-show="open"
        :id="`${id}-menu`"
        class="menu__list"
        role="menu"
        :aria-label="label"
        @keydown="onMenuKeydown"
      >
        <li v-for="(item, index) in items" :key="item.id" role="none">
          <button
            ref="itemRefs"
            type="button"
            role="menuitem"
            class="menu__item"
            :tabindex="index === active ? 0 : -1"
            :aria-disabled="item.disabled || undefined"
            @click="choose(item)"
          >
            {{ item.label }}
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.menu {
  position: relative;
}

.menu__trigger {
  display: grid;
  place-items: center;
  width: var(--control-height);
  height: var(--control-height);
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.menu__trigger:hover,
.menu__trigger[aria-expanded='true'] {
  background: var(--surface-sunken);
  color: var(--text);
}

.menu__list {
  position: absolute;
  z-index: 30;
  top: calc(100% + var(--space-2));
  right: 0;
  min-width: 190px;
  margin: 0;
  padding: var(--space-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  box-shadow: var(--shadow-2);
  list-style: none;
  transform-origin: top right;
}

.menu__item {
  display: block;
  width: 100%;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  font-size: var(--text-sm);
  white-space: nowrap;
}

.menu__item:hover:not([aria-disabled='true']),
.menu__item:focus-visible {
  background: var(--surface-sunken);
  outline-offset: -2px;
}

.menu__item[aria-disabled='true'] {
  color: var(--text-muted);
  cursor: default;
  opacity: 0.6;
}

.menu-enter-active,
.menu-leave-active {
  transition:
    opacity var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
</style>
