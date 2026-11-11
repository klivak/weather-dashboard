<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { resolveDefaultCity } from '@/api/location'
import { cityName } from '@/api/models'
import BaseButton from '@/components/base/BaseButton.vue'
import ConfirmDialog from '@/components/base/ConfirmDialog.vue'
import MenuButton from '@/components/base/MenuButton.vue'
import CityJumpBar from '@/components/layout/CityJumpBar.vue'
import FavouriteButton from '@/components/favourites/FavouriteButton.vue'
import IconPlus from '@/components/icons/IconPlus.vue'
import IconTrash from '@/components/icons/IconTrash.vue'
import WeatherBlock from '@/components/weather/WeatherBlock.vue'
import { useAnnouncer } from '@/composables/useAnnouncer'
import { useToasts } from '@/composables/useToasts'
import { MAX_BLOCKS } from '@/domain/limits'
import { suggestCities } from '@/domain/popularCities'
import { useI18n } from '@/i18n'
import { useBlocksStore, type WeatherBlockState } from '@/stores/blocks'
import { useFavouritesStore } from '@/stores/favourites'

const { t, locale } = useI18n()
const store = useBlocksStore()
const favourites = useFavouritesStore()
const { announce } = useAnnouncer()
const { show: showToast } = useToasts()

/** The block that was just added gets its search focused. */
const focusId = ref<string | null>(null)
const pendingRemoval = ref<WeatherBlockState | null>(null)
const list = ref<{ $el: HTMLElement } | null>(null)
const addButton = ref<HTMLButtonElement | null>(null)

const confirmOpen = computed({
  get: () => pendingRemoval.value !== null,
  set: (open) => {
    if (!open) pendingRemoval.value = null
  },
})

const pendingName = computed(() =>
  pendingRemoval.value?.city ? cityName(pendingRemoval.value.city, locale.value) : '',
)

const suggestions = computed(() =>
  suggestCities(store.blocks.flatMap((block) => (block.city ? [block.city.id] : []))),
)

function nameOf(block: WeatherBlockState): string {
  return block.city ? cityName(block.city, locale.value) : ''
}

/** Block waiting for the visitor's city on a first visit. */
const locatingId = ref<string | null>(null)
const locateController = new AbortController()

onMounted(async () => {
  // First visit: fill the default block with the visitor's city (from their IP), falling back to Kyiv.
  const first = store.blocks[0]
  if (store.restored || !first || first.city) return
  locatingId.value = first.id
  try {
    const { city, source } = await resolveDefaultCity(locateController.signal)
    const block = store.blocks.find((item) => item.id === first.id)
    // The user may have picked a city while we were looking; their choice wins.
    if (!block || block.city) return
    await store.setCity(block.id, city)
    if (source === 'ip') void announce(t('location.detected', { city: cityName(city, locale.value) }))
  } catch {
    // Aborted on unmount.
  } finally {
    locatingId.value = null
  }
})

onBeforeUnmount(() => locateController.abort())

/** Chips for the sticky jump bar on phones: only blocks that show a city, and only when there are two or more. */
const jumpTargets = computed(() => {
  const targets = store.blocks.flatMap((block) =>
    block.city ? [{ id: `block-${block.id}`, label: nameOf(block) }] : [],
  )
  return targets.length > 1 ? targets : []
})

function menuItems(index: number) {
  return [
    { id: 'up', label: t('home.moveUp'), disabled: index === 0 },
    { id: 'down', label: t('home.moveDown'), disabled: index === store.blocks.length - 1 },
  ]
}

function onMenu(block: WeatherBlockState, action: string) {
  const position = store.move(block.id, action === 'up' ? -1 : 1)
  if (position < 0) return
  void announce(
    t('home.moved', {
      city: nameOf(block) || t('home.blockLabel', { n: position + 1 }),
      position: position + 1,
      total: store.blocks.length,
    }),
  )
}

async function add() {
  const block = store.add()
  if (!block) return
  focusId.value = block.id
  await nextTick()
  list.value?.$el.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

async function confirmRemove() {
  const block = pendingRemoval.value
  if (!block) return
  const name = nameOf(block)
  const index = store.blocks.findIndex((item) => item.id === block.id)
  store.remove(block.id)
  showToast(name ? t('home.removed', { city: name }) : t('home.removedEmpty'), {
    icon: 'trash',
    action: {
      label: t('toast.undo'),
      run: () => {
        if (!store.restore(block, index)) return
        // The restored block mounts with focus in its search field.
        focusId.value = block.id
        void announce(name ? t('home.restored', { city: name }) : t('home.restoredEmpty'))
      },
    },
  })
  await nextTick()
  // The removed block's button is gone, so give focus a sensible place to land.
  addButton.value?.focus()
}
</script>

<template>
  <div class="home">
    <CityJumpBar v-if="jumpTargets.length" :targets="jumpTargets" />

    <TransitionGroup ref="list" name="block" tag="div" class="home__list">
      <WeatherBlock
        v-for="(block, index) in store.blocks"
        :id="`block-${block.id}`"
        :key="block.id"
        tabindex="-1"
        :city="block.city"
        :label="t('home.blockLabel', { n: index + 1 })"
        :autofocus="block.id === focusId"
        :locating="block.id === locatingId"
        :report-sun="index === 0"
        :suggestions="suggestions"
        :view="block.view ?? 'day'"
        :favourite="favourites.isFavourite(block.city?.id)"
        @update:view="store.setView(block.id, $event)"
        @update:city="store.setCity(block.id, $event)"
      >
        <template v-if="block.city || store.canRemove" #actions>
          <FavouriteButton v-if="block.city" :city="block.city" />
          <MenuButton
            v-if="store.blocks.length > 1"
            :label="nameOf(block) ? t('home.menu', { city: nameOf(block) }) : t('home.menuEmpty')"
            :items="menuItems(index)"
            @select="onMenu(block, $event)"
          />
          <BaseButton
            v-if="store.canRemove"
            icon-only
            :aria-label="nameOf(block) ? t('home.remove', { city: nameOf(block) }) : t('home.removeEmpty')"
            :title="nameOf(block) ? t('home.remove', { city: nameOf(block) }) : t('home.removeEmpty')"
            @click="pendingRemoval = block"
          >
            <IconTrash />
          </BaseButton>
        </template>
      </WeatherBlock>
    </TransitionGroup>

    <div class="home__add">
      <button ref="addButton" type="button" class="add" :disabled="!store.canAdd" @click="add">
        <span class="add__icon" aria-hidden="true"><IconPlus /></span>
        <span class="add__text">
          <span class="add__label">{{
            store.canAdd ? t('home.add') : t('home.limit', { max: MAX_BLOCKS })
          }}</span>
          <span class="add__count">{{
            t('home.count', { count: store.blocks.length, max: MAX_BLOCKS })
          }}</span>
        </span>
      </button>
    </div>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="pendingName ? t('home.confirmTitle', { city: pendingName }) : t('home.confirmTitleEmpty')"
      :description="pendingName ? t('home.confirmText') : t('home.confirmTextEmpty')"
      :confirm-label="t('home.confirmAction')"
      :cancel-label="t('home.cancel')"
      @confirm="confirmRemove"
    />
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: var(--space-5);
}

.home__list {
  display: grid;
  gap: var(--space-5);
}

.add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 72px;
  padding: var(--space-4);
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  color: var(--text);
  text-align: left;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.add:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--surface);
}

.add:disabled {
  cursor: default;
  color: var(--text-muted);
}

.add__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  transition: transform var(--dur-base) var(--ease-out);
}

.add:hover:not(:disabled) .add__icon {
  transform: rotate(90deg);
}

.add:disabled .add__icon {
  background: var(--surface-sunken);
  color: var(--text-muted);
}

.add__text {
  display: grid;
}

.add__label {
  font-weight: var(--weight-medium);
}

.add__count {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

/* Reordering slides the blocks into their new places. */
.block-move {
  transition: transform var(--dur-slow) var(--ease-out);
}

.block-enter-active,
.block-leave-active {
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease-out);
}

.block-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.block-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
