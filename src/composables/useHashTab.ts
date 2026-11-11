import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

export type TabId = 'home' | 'favourites'

const FAVOURITES_HASH = '#/favourites'

export function tabFromHash(hash: string): TabId {
  return hash.startsWith(FAVOURITES_HASH) ? 'favourites' : 'home'
}

/** The active tab, kept in the URL hash so reloads and the back button keep the user's place. */
export function useHashTab() {
  const tab = ref<TabId>(tabFromHash(location.hash))

  const onHashChange = () => {
    tab.value = tabFromHash(location.hash)
  }

  onMounted(() => window.addEventListener('hashchange', onHashChange))
  onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))

  watch(tab, (next) => {
    if (tabFromHash(location.hash) === next) return
    const url = next === 'favourites' ? FAVOURITES_HASH : `${location.pathname}${location.search}`
    history.pushState(null, '', url)
  })

  return tab
}
