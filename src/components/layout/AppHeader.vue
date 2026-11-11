<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '@/api/models'
import SegmentedControl from '@/components/base/SegmentedControl.vue'
import { useI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import AppLogo from './AppLogo.vue'

const { t } = useI18n()
const settings = useSettingsStore()

const locale = computed<Locale>({
  get: () => settings.locale,
  set: (value) => settings.setLocale(value),
})

const localeOptions = computed(() => [
  { value: 'en' as const, label: 'EN', ariaLabel: t('locales.en') },
  { value: 'uk' as const, label: 'UA', ariaLabel: t('locales.uk') },
])
</script>

<template>
  <header class="header">
    <div class="container header__inner">
      <a class="header__brand" href="#/">
        <AppLogo />
        <h1 class="header__title">{{ t('app.title') }}</h1>
      </a>
      <div class="header__controls">
        <SegmentedControl
          v-model="locale"
          :options="localeOptions"
          :label="t('settings.language')"
          size="sm"
        />
      </div>
    </div>
  </header>
</template>

<style scoped>
.header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-block: var(--space-5);
}

.header__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  border-radius: var(--radius-sm);
  text-decoration: none;
}

.header__title {
  font-size: var(--text-lg);
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.header__controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

@media (max-width: 389px) {
  .header__title {
    font-size: var(--text-md);
  }
}
</style>
