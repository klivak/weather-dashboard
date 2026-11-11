import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Third-party endpoints the browser talks to directly (OpenWeatherMap goes through our own /api/owm). */
export const CONNECT_SOURCES = [
  'https://geocoding-api.open-meteo.com',
  'https://get.geojs.io',
  'https://ipapi.co',
]

export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const body = match[1] ?? ''
    if (body.trim()) hashes.push(`'sha256-${createHash('sha256').update(body).digest('base64')}'`)
  }
  return hashes
}

export function contentSecurityPolicy(html: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes(html).join(' ')}`.trim(),
    // Vue and Chart.js set inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${CONNECT_SOURCES.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ')
}

export function headersFile(html: string): string {
  return [
    '/*',
    `  Content-Security-Policy: ${contentSecurityPolicy(html)}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()',
    '  Cross-Origin-Opener-Policy: same-origin',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/index.html',
    '  Cache-Control: no-cache',
    '',
  ].join('\n')
}

/** Writes dist/_headers for Cloudflare Pages after the build, hashing the final index.html. */
export function cloudflareHeaders(): Plugin {
  let outDir = 'dist'
  return {
    name: 'cloudflare-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      writeFileSync(resolve(outDir, '_headers'), headersFile(html))
    },
  }
}
