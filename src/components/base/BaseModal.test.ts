import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'

let wrapper: VueWrapper | undefined
let openValue = true

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

function mountDialog(open = true) {
  openValue = open
  wrapper = mount(ConfirmDialog, {
    props: {
      open,
      'onUpdate:open': (value: boolean) => {
        openValue = value
        void wrapper?.setProps({ open: value })
      },
      title: 'Remove Lviv?',
      description: 'The block will be removed.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    },
    attachTo: document.body,
  })
  return wrapper
}

const dialog = () => document.querySelector('dialog')!

describe('ConfirmDialog', () => {
  it('opens as a labelled modal with the safe action first', () => {
    mountDialog()
    expect(dialog().open).toBe(true)
    const title = document.getElementById(dialog().getAttribute('aria-labelledby')!)
    expect(title?.textContent).toBe('Remove Lviv?')
    expect(document.getElementById(dialog().getAttribute('aria-describedby')!)?.textContent).toBe(
      'The block will be removed.',
    )
    const buttons = [...dialog().querySelectorAll('button')]
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Cancel', 'Remove'])
    expect(buttons[0]?.hasAttribute('autofocus')).toBe(true)
  })

  it('confirms and closes', async () => {
    const app = mountDialog()
    dialog().querySelectorAll('button')[1]?.click()
    await nextTick()
    expect(app.emitted('confirm')).toHaveLength(1)
    expect(openValue).toBe(false)
    expect(dialog().open).toBe(false)
  })

  it('cancels without confirming, also from the backdrop and Esc (native close)', async () => {
    const app = mountDialog()
    dialog().querySelector('button')?.click()
    await nextTick()
    expect(app.emitted('confirm')).toBeUndefined()
    expect(openValue).toBe(false)

    await app.setProps({ open: true })
    openValue = true
    expect(dialog().open).toBe(true)
    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(openValue).toBe(false)

    await app.setProps({ open: true })
    openValue = true
    expect(dialog().open).toBe(true)
    dialog().close()
    await nextTick()
    expect(openValue).toBe(false)
    expect(app.emitted('confirm')).toBeUndefined()
  })
})
