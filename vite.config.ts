/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { cloudflareHeaders } from './build/headers.ts'

// The OpenWeatherMap key never reaches the client bundle: in dev this proxy appends it, in production a Cloudflare Pages Function does the same.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const key = env.OWM_API_KEY ?? ''

  return {
    plugins: [vue(), cloudflareHeaders()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      proxy: {
        '/api/owm': {
          target: 'https://api.openweathermap.org',
          changeOrigin: true,
          rewrite: (path) => {
            const upstream = path.replace(/^\/api\/owm/, '')
            return `${upstream}${upstream.includes('?') ? '&' : '?'}appid=${key}`
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'build/**/*.test.ts'],
    },
  }
})
