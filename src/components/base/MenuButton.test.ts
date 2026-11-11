import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import MenuButton from './MenuButton.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

function mountMenu() {
  wrapper = mount(MenuButton, {
    props: {
      label: 'More actions for Lviv',
      items: [
        { id: 'up', label: 'Move up', disabled: true },
        { id: 'down', label: 'Move down' },
        { id: 'top', label: 'Move to top' },
      ],
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('MenuButton', () => {
  it('opens from the keyboard on the first enabled item and moves with the arrows', async () => {
    const menu = mountMenu()
    const trigger = menu.find('[aria-haspopup="menu"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const items = menu.findAll('[role="menuitem"]')
    expect(document.activeElement).toBe(items[1]?.element)
    expect(items[0]?.attributes('aria-disabled')).toBe('true')

    await menu.find('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(document.activeElement).toBe(items[2]?.element)
    await menu.find('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(document.activeElement).toBe(items[1]?.element)
  })

  it('selects an item, closes and returns focus; Escape closes without selecting', async () => {
    const menu = mountMenu()
    const trigger = menu.find('[aria-haspopup="menu"]')
    await trigger.trigger('click')
    await nextTick()
    await menu.findAll('[role="menuitem"]')[2]?.trigger('click')
    expect(menu.emitted('select')).toEqual([['top']])
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    await nextTick()
    await menu.findAll('[role="menuitem"]')[0]?.trigger('click')
    expect(menu.emitted('select')).toHaveLength(1)
    await menu.find('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
  })
})
