import type { Rollup } from 'vite'
import type { Plugin } from 'vite'

type OutputAsset = Rollup.OutputAsset

/** Font subsets every page needs (UI and city names in Latin and Cyrillic); other subsets load on demand. */
const PRELOAD_FONTS = [
  /\/onest-latin-wght-normal-[^/]+\.woff2$/,
  /\/onest-cyrillic-wght-normal-[^/]+\.woff2$/,
]

/**
 * Build step for a faster first paint:
 * - the entry stylesheet (about 7 KB gzip) is inlined into index.html, so the first frame does not wait for
 *   another request;
 * - the Latin and Cyrillic font files are preloaded, so text does not swap fonts late.
 * The CSP already allows inline styles (Vue and Chart.js set style attributes), so nothing else changes.
 */
export function inlineEntryCss(): Plugin {
  return {
    name: 'inline-entry-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'index.html',
      )
      if (!html) return
      let source = String(html.source)

      for (const match of source.matchAll(/<link rel="stylesheet"[^>]*href="\/([^"]+\.css)"[^>]*>/g)) {
        const [tag, fileName] = match
        const css = bundle[fileName!]
        if (!css || css.type !== 'asset') continue
        source = source.replace(tag, `<style>${String(css.source)}</style>`)
        delete bundle[fileName!]
      }

      const fonts = Object.keys(bundle)
        .map((fileName) => `/${fileName}`)
        .filter((path) => PRELOAD_FONTS.some((pattern) => pattern.test(path)))
      const preload = fonts
        .map((href) => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`)
        .join('\n    ')
      if (preload) source = source.replace('<title>', `${preload}\n    <title>`)

      html.source = source
    },
  }
}
