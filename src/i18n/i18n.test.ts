import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { SETTINGS_KEY, useSettingsStore } from '@/stores/settings'
import { detectLocale, messages, translate, useI18n } from '.'

function collectKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeys(value, prefix ? `${prefix}.${key}` : key),
  )
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('messages', () => {
  it('Ukrainian has exactly the English keys, all non-empty', () => {
    expect(collectKeys(messages.uk).sort()).toEqual(collectKeys(messages.en).sort())
    for (const key of collectKeys(messages.uk)) {
      expect(translate('uk', key as never).trim()).not.toBe('')
    }
  })

  it('keeps the same placeholders in both languages', () => {
    for (const key of collectKeys(messages.en)) {
      const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()
      expect(placeholders(translate('uk', key as never))).toEqual(placeholders(translate('en', key as never)))
    }
  })
})

describe('translate', () => {
  it('fills placeholders and leaves unknown ones untouched', () => {
    expect(translate('en', 'favourites.emptyText', { max: 5 })).toContain('up to 5 cities')
    expect(translate('uk', 'favourites.emptyText')).toContain('{max}')
  })

  it('returns the key for an unknown path', () => {
    expect(translate('en', 'nope.missing' as never)).toBe('nope.missing')
  })
})

describe('detectLocale', () => {
  it.each([
    [['uk-UA', 'en'], 'uk'],
    [['ru-RU'], 'uk'],
    [['en-GB', 'uk'], 'en'],
    [['de-DE', 'fr'], 'en'],
    [[], 'en'],
  ] as const)('%j → %s', (languages, expected) => {
    expect(detectLocale(languages)).toBe(expected)
  })
})

describe('settings store', () => {
  it('persists locale and theme and restores them', async () => {
    const store = useSettingsStore()
    store.setLocale('uk')
    store.setThemeMode('night')
    await nextTick()
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')).toEqual({
      v: 1,
      locale: 'uk',
      theme: 'night',
      units: 'metric',
    })

    setActivePinia(createPinia())
    const restored = useSettingsStore()
    expect(restored.locale).toBe('uk')
    expect(restored.themeMode).toBe('night')
  })

  it('ignores corrupt or foreign saved data', () => {
    localStorage.setItem(SETTINGS_KEY, '{"v":1,"locale":"de","theme":"blue"}')
    const store = useSettingsStore()
    expect(['en', 'uk']).toContain(store.locale)
    expect(store.themeMode).toBe('auto')

    localStorage.setItem(SETTINGS_KEY, 'not json')
    setActivePinia(createPinia())
    expect(useSettingsStore().themeMode).toBe('auto')
  })

  it('useI18n follows the store locale', () => {
    const { t, setLocale } = useI18n()
    setLocale('uk')
    expect(t('nav.favourites')).toBe('Вибране')
    setLocale('en')
    expect(t('nav.favourites')).toBe('Favourites')
  })
})
