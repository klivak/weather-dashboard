import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

/** End-to-end checks against the production build; every external API is mocked in e2e/fixtures.ts. */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'en-GB',
    timezoneId: 'Europe/Kyiv',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1200, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
