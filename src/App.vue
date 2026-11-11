<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import TabBar from '@/components/base/TabBar.vue'
import IconHome from '@/components/icons/IconHome.vue'
import IconStar from '@/components/icons/IconStar.vue'
import FavouritesLimitDialog from '@/components/favourites/FavouritesLimitDialog.vue'
import AppAnnouncer from '@/components/layout/AppAnnouncer.vue'
import ToastHost from '@/components/layout/ToastHost.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useHashTab, type TabId } from '@/composables/useHashTab'
import { useI18n } from '@/i18n'
import { useFavouritesStore } from '@/stores/favourites'
import { useThemeStore } from '@/stores/theme'
import FavouritesView from '@/views/FavouritesView.vue'
import HomeView from '@/views/HomeView.vue'

const { t, locale } = useI18n()
const themeStore = useThemeStore()
const favourites = useFavouritesStore()
const tab = useHashTab()

/** The favourites tab renders on first visit and then stays mounted, so its blocks fetch only when wanted. */
const favouritesVisited = ref(tab.value === 'favourites')
watch(tab, (value) => {
  if (value === 'favourites') favouritesVisited.value = true
})

const tabs = computed(() => [
  { id: 'home' as TabId, label: t('nav.home') },
  { id: 'favourites' as TabId, label: t('nav.favourites'), badge: favourites.cities.length },
])

/** Apply the look; a View Transition crossfades the sky where supported (never under reduced motion). */
let firstApply = true
function applyTheme(theme: string) {
  const root = document.documentElement
  const apply = () => {
    root.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'night' ? '#070c1f' : '#bfdcfa')
  }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!firstApply && root.dataset.theme !== theme && !reduced && document.startViewTransition) {
    document.startViewTransition(apply)
  } else {
    apply()
  }
  firstApply = false
}

watch(() => themeStore.theme, applyTheme, { immediate: true })

// Re-check once a minute so "auto" turns to night at sunset without a reload.
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  clock = setInterval(() => themeStore.tick(), 60_000)
})
onBeforeUnmount(() => clearInterval(clock))

watchEffect(() => {
  const root = document.documentElement
  root.lang = locale.value
  document.title = t('app.title')
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.description'))
})
</script>

<template>
  <div class="app">
    <AppHeader />

    <main class="container app__main">
      <TabBar v-model="tab" :tabs="tabs" :label="t('nav.label')">
        <template #icon="{ id, active }">
          <IconHome v-if="id === 'home'" />
          <IconStar v-else :filled="active" />
        </template>
      </TabBar>

      <section
        v-show="tab === 'home'"
        id="panel-home"
        class="app__panel"
        role="tabpanel"
        aria-labelledby="tab-home"
        tabindex="0"
      >
        <h2 class="visually-hidden">{{ t('home.heading') }}</h2>
        <HomeView />
      </section>

      <section
        v-show="tab === 'favourites'"
        id="panel-favourites"
        class="app__panel"
        role="tabpanel"
        aria-labelledby="tab-favourites"
        tabindex="0"
      >
        <h2 class="visually-hidden">{{ t('favourites.heading') }}</h2>
        <FavouritesView v-if="favouritesVisited" @browse="tab = 'home'" />
      </section>
    </main>

    <AppFooter />
    <FavouritesLimitDialog />
    <ToastHost />
    <AppAnnouncer />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.app__main {
  flex: 1;
}

.app__panel {
  padding-block: var(--space-6);
}

.app__panel:focus-visible {
  outline-offset: -2px;
  border-radius: var(--radius-md);
}
</style>
