import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApis } from './fixtures.ts'

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await mockApis(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-init')) return
    localStorage.clear()
    localStorage.setItem('wd:settings', JSON.stringify({ v: 1, locale: 'en', theme: 'day' }))
    sessionStorage.setItem('e2e-init', '1')
  })
})

test('first visit shows the visitor city with card and chart, accessible in both looks', async ({ page }) => {
  await page.goto('/')
  const block = page.locator('#panel-home section.block').first()
  await expect(block.getByRole('heading', { name: 'Kyiv' })).toBeVisible()
  await expect(block.locator('.card__temp')).toHaveText('4°')
  await expect(block.locator('canvas')).toBeVisible()
  await expectNoA11yViolations(page)

  await page.getByRole('radio', { name: 'Night' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
  await expectNoA11yViolations(page)
})

test('search, 5-day view, favourites and removal work end to end', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.card__city').first()).toHaveText('Kyiv')

  // Add a second block and pick London with the keyboard.
  await page.getByRole('button', { name: /Add a city/ }).click()
  const second = page.locator('#panel-home section.block').nth(1)
  await expect(second.getByRole('combobox')).toBeFocused()
  await page.keyboard.type('Lon')
  await expect(second.getByRole('option').first()).toContainText('London')
  await page.keyboard.press('Enter')
  await expect(second.getByRole('heading', { name: 'London' })).toBeVisible()

  // 5-day view with daily averages.
  await second.getByRole('radio', { name: '5 days' }).click()
  await expect(second.locator('.week li')).toHaveCount(5)
  await expect(second.locator('.week li').first()).toContainText('Today')

  // Favourite London and see it on the Favourites tab, fixed to its city.
  await second.getByRole('button', { name: 'Add London to favourites' }).click()
  await expect(second).toHaveClass(/block--favourite/)
  await page.getByRole('tab', { name: /Favourites/ }).click()
  const favourite = page.locator('#panel-favourites section.block')
  await expect(favourite).toHaveCount(1)
  await expect(favourite.getByRole('heading', { name: 'London' })).toBeVisible()
  await expect(favourite.getByRole('combobox')).toHaveCount(0)
  await expectNoA11yViolations(page)

  // Remove the Kyiv block after confirming.
  await page.getByRole('tab', { name: 'Home' }).click()
  await page.getByRole('button', { name: 'Remove Kyiv' }).click()
  const dialog = page.getByRole('dialog', { name: 'Remove Kyiv?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await expectNoA11yViolations(page)
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.locator('#panel-home section.block')).toHaveCount(1)

  // Everything survives a reload.
  await page.reload()
  await expect(page.locator('.card__city').first()).toHaveText('London')
  await expect(page.getByRole('tab', { name: /Favourites/ })).toContainText('1')
})

test('switches the interface and weather data to Ukrainian', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.card__city').first()).toHaveText('Kyiv')
  const ukrainianWeather = page.waitForRequest(
    (request) => request.url().includes('/data/2.5/weather') && request.url().includes('lang=uk'),
  )
  await page.getByRole('radio', { name: 'Українська' }).click()
  await ukrainianWeather
  await expect(page.locator('.card__city').first()).toHaveText('Київ')
  await expect(page.getByRole('tab', { name: 'Головна' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk')
})

test('the page never scrolls sideways', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.card__temp').first()).toBeVisible()
  await page.locator('#panel-home').getByRole('radio', { name: '5 days' }).click()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
