<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '@/api/models'
import SegmentedControl from '@/components/base/SegmentedControl.vue'
import IconAuto from '@/components/icons/IconAuto.vue'
import IconMoon from '@/components/icons/IconMoon.vue'
import IconSun from '@/components/icons/IconSun.vue'
import { useI18n } from '@/i18n'
import { useSettingsStore, type ThemeMode } from '@/stores/settings'
import AppLogo from './AppLogo.vue'

const { t } = useI18n()
const settings = useSettingsStore()

const locale = computed<Locale>({
  get: () => settings.locale,
  set: (value) => settings.setLocale(value),
})

const themeMode = computed<ThemeMode>({
  get: () => settings.themeMode,
  set: (value) => settings.setThemeMode(value),
})

const localeOptions = computed(() => [
  { value: 'en' as const, label: 'EN', ariaLabel: t('locales.en') },
  { value: 'uk' as const, label: 'UA', ariaLabel: t('locales.uk') },
])

const themeOptions = computed(() => [
  { value: 'auto' as const, label: t('theme.auto'), ariaLabel: t('theme.auto') },
  { value: 'day' as const, label: t('theme.day'), ariaLabel: t('theme.day') },
  { value: 'night' as const, label: t('theme.night'), ariaLabel: t('theme.night') },
])

const themeIcons = { auto: IconAuto, day: IconSun, night: IconMoon }

const unitsLabel = computed(() =>
  settings.units === 'metric'
    ? t('units.toggle', { current: t('units.celsius'), next: t('units.fahrenheit') })
    : t('units.toggle', { current: t('units.fahrenheit'), next: t('units.celsius') }),
)

function toggleUnits() {
  settings.setUnits(settings.units === 'metric' ? 'imperial' : 'metric')
}
</script>

<template>
  <header class="header">
    <div class="container header__inner">
      <a class="header__brand" href="#/">
        <AppLogo />
        <h1 class="header__title">{{ t('app.title') }}</h1>
      </a>
      <div class="header__controls">
        <SegmentedControl v-model="themeMode" :options="themeOptions" :label="t('theme.label')" size="sm">
          <template #option="{ option }">
            <component :is="themeIcons[option.value]" class="header__theme-icon" :title="option.label" />
          </template>
        </SegmentedControl>
        <button
          type="button"
          class="header__units"
          :aria-label="unitsLabel"
          :title="unitsLabel"
          @click="toggleUnits"
        >
          <span :key="settings.units" class="header__units-text">
            {{ settings.units === 'metric' ? '°C' : '°F' }}
          </span>
        </button>
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
  gap: var(--space-3);
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

.header__units {
  display: grid;
  place-items: center;
  width: 40px;
  height: var(--control-height-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  overflow: hidden;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.header__units:hover {
  border-color: var(--border-strong);
}

.header__units-text {
  animation: units-flip var(--dur-base) var(--ease-out);
}

@keyframes units-flip {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

.header__theme-icon {
  display: block;
}

/* Two compact switches leave no room for the wordmark on the narrowest phones; the logo stays, the heading
   remains for screen readers. */
@media (max-width: 459px) {
  .header__title {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}
</style>
