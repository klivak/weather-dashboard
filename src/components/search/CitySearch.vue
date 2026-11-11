<script setup lang="ts">
import { computed, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import type { City } from '@/api/models'
import { cityName } from '@/api/models'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import IconClose from '@/components/icons/IconClose.vue'
import IconPin from '@/components/icons/IconPin.vue'
import IconSearch from '@/components/icons/IconSearch.vue'
import { useCitySearch } from '@/composables/useCitySearch'
import { useI18n } from '@/i18n'
import { highlightParts } from '@/utils/highlight'
import { cityRegion } from '@/utils/region'

const props = defineProps<{
  /** The city currently shown; its localised name fills the input when the user is not typing. */
  city?: City | null
  /** Move focus here on mount, e.g. in a block the user just added. */
  autofocus?: boolean
}>()

const emit = defineEmits<{ select: [city: City] }>()

const { t, locale } = useI18n()
const { query, results, status, errorKind, resultsFor, setQuietly, reset, retry } = useCitySearch({
  locale: () => locale.value,
})

const id = useId()
const inputId = `${id}-input`
const listId = `${id}-list`
const optionId = (index: number) => `${id}-option-${index}`

const input = useTemplateRef<HTMLInputElement>('input')
const open = ref(false)
const activeIndex = ref(-1)
const announcement = ref('')

const displayName = computed(() => (props.city ? cityName(props.city, locale.value) : ''))

watch(displayName, (name) => setQuietly(name), { immediate: true })

onMounted(() => {
  if (props.autofocus) input.value?.focus()
})

const hasMinLength = computed(() => query.value.trim().length >= 2)
const showPopup = computed(() => open.value && hasMinLength.value && status.value !== 'idle')
const settled = computed(() => resultsFor.value === query.value.trim() && status.value !== 'loading')
const isEmpty = computed(() => settled.value && status.value === 'success' && results.value.length === 0)

const options = computed(() =>
  results.value.map((city) => {
    const name = cityName(city, locale.value)
    return { city, name, parts: highlightParts(name, query.value), region: cityRegion(city, locale.value) }
  }),
)

watch([results, status], () => {
  activeIndex.value = results.value.length > 0 && status.value === 'success' ? 0 : -1
  if (!open.value) return
  if (status.value === 'success') {
    announcement.value = results.value.length
      ? t('search.results', { count: results.value.length })
      : t('search.empty', { query: query.value.trim() })
  } else if (status.value === 'error') {
    announcement.value = errorKind.value === 'network' ? t('search.offline') : t('search.error')
  }
})

function onInput() {
  open.value = true
}

function choose(city: City) {
  open.value = false
  activeIndex.value = -1
  setQuietly(cityName(city, locale.value))
  announcement.value = t('search.selected', { city: cityName(city, locale.value) })
  emit('select', city)
}

function restore() {
  open.value = false
  if (displayName.value) setQuietly(displayName.value)
  else reset()
}

function clear() {
  setQuietly('')
  open.value = false
  input.value?.focus()
}

function move(step: 1 | -1) {
  const count = results.value.length
  if (!count) return
  open.value = true
  activeIndex.value =
    activeIndex.value < 0 ? (step === 1 ? 0 : count - 1) : (activeIndex.value + step + count) % count
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Enter': {
      const option = results.value[activeIndex.value] ?? (settled.value ? results.value[0] : undefined)
      if (showPopup.value && option) {
        event.preventDefault()
        choose(option)
      }
      break
    }
    case 'Escape':
      if (open.value && showPopup.value) {
        event.preventDefault()
        open.value = false
      } else if (query.value !== displayName.value) {
        event.preventDefault()
        restore()
      }
      break
  }
}

function onFocus() {
  input.value?.select()
}

function onBlur() {
  restore()
}
</script>

<template>
  <div class="search" :class="{ 'search--open': showPopup }">
    <label :for="inputId" class="visually-hidden">{{ t('search.label') }}</label>
    <div class="search__field">
      <IconSearch class="search__icon" />
      <input
        :id="inputId"
        ref="input"
        v-model="query"
        class="search__input"
        type="text"
        role="combobox"
        autocomplete="off"
        autocapitalize="words"
        spellcheck="false"
        enterkeyhint="search"
        aria-autocomplete="list"
        :aria-expanded="showPopup"
        :aria-controls="listId"
        :aria-activedescendant="showPopup && activeIndex >= 0 ? optionId(activeIndex) : undefined"
        :placeholder="t('search.placeholder')"
        @input="onInput"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
      />
      <BaseSpinner v-if="status === 'loading' && open" class="search__spinner" />
      <button
        v-else-if="query && query !== displayName"
        type="button"
        class="search__clear"
        :aria-label="t('search.clear')"
        @mousedown.prevent
        @click="clear"
      >
        <IconClose :size="18" />
      </button>
    </div>

    <div v-show="showPopup" class="search__popup" @mousedown.prevent>
      <ul
        v-show="options.length"
        :id="listId"
        class="search__list"
        role="listbox"
        :aria-label="t('search.suggestions')"
      >
        <li
          v-for="(option, index) in options"
          :id="optionId(index)"
          :key="option.city.id"
          class="search__option"
          role="option"
          :aria-selected="index === activeIndex"
          @mousemove="activeIndex = index"
          @click="choose(option.city)"
        >
          <IconPin class="search__pin" :size="18" />
          <span class="search__text">
            <span class="search__name">
              <template v-for="(part, partIndex) in option.parts" :key="partIndex">
                <mark v-if="part.match">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </span>
            <span class="search__region">{{ option.region }}</span>
          </span>
        </li>
      </ul>

      <div v-if="!options.length && status === 'loading'" class="search__skeleton" aria-hidden="true">
        <span v-for="row in 3" :key="row" class="search__skeleton-row" />
      </div>
      <p v-else-if="isEmpty" class="search__note">{{ t('search.empty', { query: query.trim() }) }}</p>
      <div v-else-if="status === 'error'" class="search__note search__note--error">
        <span>{{ errorKind === 'network' ? t('search.offline') : t('search.error') }}</span>
        <button type="button" class="search__retry" @click="retry">{{ t('search.retry') }}</button>
      </div>
    </div>

    <p class="visually-hidden" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  width: 100%;
}

.search__field {
  position: relative;
  display: flex;
  align-items: center;
}

.search__icon {
  position: absolute;
  left: var(--space-4);
  color: var(--text-muted);
  pointer-events: none;
}

.search__input {
  width: 100%;
  min-height: var(--control-height);
  padding: 0 calc(var(--space-4) + 28px) 0 calc(var(--space-4) + 28px);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}

.search__input::placeholder {
  color: var(--text-muted);
  font-weight: var(--weight-regular);
}

.search__input:hover {
  border-color: var(--text-muted);
}

.search__input:focus-visible {
  outline: none;
  border-color: var(--focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 25%, transparent);
}

.search__spinner,
.search__clear {
  position: absolute;
  right: var(--space-3);
  color: var(--text-muted);
}

.search__clear {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
}

.search__clear:hover {
  background: var(--surface-sunken);
  color: var(--text);
}

.search__popup {
  position: absolute;
  z-index: 20;
  top: calc(100% + var(--space-2));
  left: 0;
  right: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  box-shadow: var(--shadow-2);
  animation: pop-in var(--dur-base) var(--ease-out);
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.search__list {
  margin: 0;
  padding: var(--space-1);
  list-style: none;
}

.search__option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 52px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.search__option[aria-selected='true'] {
  background: var(--surface-sunken);
}

.search__pin {
  color: var(--text-muted);
}

.search__option[aria-selected='true'] .search__pin {
  color: var(--accent);
}

.search__text {
  display: grid;
  min-width: 0;
}

.search__name,
.search__region {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search__name {
  font-weight: var(--weight-medium);
}

.search__name mark {
  background: none;
  color: inherit;
  font-weight: var(--weight-bold);
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.search__region {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.search__note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  margin: 0;
  padding: var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.search__note--error {
  color: var(--text);
}

.search__retry {
  min-height: var(--control-height-sm);
  padding: 0 var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: transparent;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.search__retry:hover {
  background: var(--surface-sunken);
}

.search__skeleton {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
}

.search__skeleton-row {
  height: 40px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--surface-sunken) 0%,
    color-mix(in srgb, var(--surface-sunken) 40%, var(--surface-raised)) 50%,
    var(--surface-sunken) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}

.search__skeleton-row:nth-child(2) {
  width: 80%;
}

.search__skeleton-row:nth-child(3) {
  width: 60%;
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
