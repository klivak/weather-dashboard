<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import EmptyState from '@/components/base/EmptyState.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import TabBar from '@/components/base/TabBar.vue'
import IconHome from '@/components/icons/IconHome.vue'
import IconStar from '@/components/icons/IconStar.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useHashTab, type TabId } from '@/composables/useHashTab'
import { MAX_FAVOURITES } from '@/domain/limits'
import { useI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import HomeView from '@/views/HomeView.vue'

const { t, locale } = useI18n()
const settings = useSettingsStore()
const tab = useHashTab()

const tabs = computed(() => [
  { id: 'home' as TabId, label: t('nav.home') },
  { id: 'favourites' as TabId, label: t('nav.favourites') },
])

watchEffect(() => {
  const root = document.documentElement
  root.lang = locale.value
  root.dataset.theme = settings.theme
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
        <EmptyState
          :title="t('favourites.emptyTitle')"
          :text="t('favourites.emptyText', { max: MAX_FAVOURITES })"
        >
          <template #icon><IconStar :size="28" /></template>
          <template #action>
            <BaseButton variant="primary" @click="tab = 'home'">{{ t('favourites.emptyAction') }}</BaseButton>
          </template>
        </EmptyState>
      </section>
    </main>

    <AppFooter />
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
