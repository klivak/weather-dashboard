import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, headersFile, inlineScriptHashes } from './headers.ts'

const html = `<head><script>console.log(1)</script><script type="module" src="/assets/a.js"></script></head>`

describe('cloudflare headers', () => {
  it('hashes inline scripts only', () => {
    const expected = createHash('sha256').update('console.log(1)').digest('base64')
    expect(inlineScriptHashes(html)).toEqual([`'sha256-${expected}'`])
  })

  it('builds a strict CSP with the API origins', () => {
    const csp = contentSecurityPolicy(html)
    expect(csp).toContain("default-src 'self'")
    expect(csp).toMatch(/script-src 'self' 'sha256-[^']+'/)
    expect(csp).toContain(
      "connect-src 'self' https://geocoding-api.open-meteo.com https://get.geojs.io https://ipapi.co",
    )
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('caches fingerprinted assets for a year and revalidates the page', () => {
    const file = headersFile(html)
    expect(file).toContain('/assets/*\n  Cache-Control: public, max-age=31536000, immutable')
    expect(file).toContain('/index.html\n  Cache-Control: no-cache')
  })
})
