# Weather Dashboard

Compare the weather in up to five cities side by side: current conditions, an hourly temperature chart, a 5-day view, favourites, English and Ukrainian, and a look that turns to night when the sun sets in your city.

Built with Vue 3, TypeScript, Pinia and Chart.js. All styling is hand-written CSS (no CSS framework, no UI kit, no Vue chart wrapper). Weather data from [OpenWeatherMap](https://openweathermap.org/), hosted on Cloudflare Pages.

## Features

- **City search with autocomplete.** Matches as you type in Latin or Cyrillic ("Lond" → London, "Хар" → Харків), highlights the match and shows the region to tell same-name places apart. Full keyboard support (WAI-ARIA combobox), loading, empty and error states.
- **Today card.** Temperature, conditions, feels-like, humidity, wind with direction, pressure, visibility, sunrise and sunset, all in the city's own time zone.
- **Hourly temperature chart.** Chart.js used directly: the live reading plus the 3-hour forecast for the rest of the city's current day. Late in the evening, when only a point or two is left, it continues into the next morning behind a dashed "Tomorrow" line.
- **Up to five weather blocks.** One block by default, "+" adds another fully working block, removal asks for confirmation in a modal.
- **Favourites tab.** Star a city to keep it; favourite blocks get a gold ring. The tab shows a block per favourite with no city search, only the Day / 5 days switch. Stored in `localStorage`, at most five; starring a sixth opens a dialog listing the saved cities so you can swap one out.
- **Day / 5 days.** Card and chart switch to five days; a day's temperature is the mean of its 3-hour forecasts, with the daily low–high shown as a band.
- **Your city by default.** On the first visit the city is detected from the IP address with open services; Kyiv is the fallback.
- **Loaders everywhere.** Skeletons shaped like the final content, so nothing jumps when data arrives.
- **English and Ukrainian.** Interface, number and date formats and the weather descriptions from the API (`lang=en|uk`); city names come in both languages.
- **Day / night look.** Auto (follows sunrise and sunset in the first city, re-checked every minute), Day or Night, with a crossfade between them.
- **Responsive.** 1200px main container down to 360px.

### Extras

- **Micro-interactions:** the today card's weather icon is alive (sun rays turn, clouds drift, rain and snow fall, lightning flickers), cards rise in when data arrives, the temperature counts up to each new reading and the 5-day rows slide in one by one. All of it stops under `prefers-reduced-motion`.
- **Richer chart:** a weather icon and the chance of precipitation under every point, aligned with the plot.
- **Toasts with Undo:** visible feedback for favourites, an Open shortcut after starring and an Undo after removing a block (the confirmation modal stays) or a favourite.
- **"Updated 5 min ago"** in each card header with a refresh button that bypasses every cache, including the edge.
- **Popular cities** as one-click chips in an empty block.
- **°C / °F switch** in the header (with mph and miles), saved with the other settings.
- **Reorder blocks** from each block's actions menu (an accessible menu button), with a sliding animation.
- **Jump bar on phones:** a sticky row of city chips under the tabs scrolls to a block and follows the one in view.
- **Use my location:** a button in the search field picks the city at the device position (browser geolocation), with clear messages when permission is blocked.
- **The API key never reaches the browser:** requests go through an allow-listed proxy (Vite in development, a Cloudflare Pages Function in production) that adds the key server-side.
- **Everything persists:** blocks, chosen cities, views, favourites, language, look and units survive a reload. Everything read back from storage is versioned and validated, so corrupted or outdated data is ignored instead of rendered.
- **Accessibility:** semantic landmarks and headings, tabs and segmented controls with arrow-key navigation, focus-trapped native `<dialog>` modals with Esc and focus return, a polite live region for status messages, a hidden data table for every chart, visible focus, `prefers-reduced-motion` respected. Automated axe checks (WCAG 2.2 AA) run in the end-to-end tests in both looks.
- **Own SVG weather icons** for ten condition types with day and night variants.
- **Fast first paint:** a static shell (header and block skeleton) is in the HTML with its CSS inlined and the fonts preloaded, the right day or night look is set before the first frame, Chart.js loads as a separate chunk fetched in parallel with the first weather requests and is built on an idle frame, and on a first visit the IP lookup starts from the page head while the app downloads. The Favourites tab mounts only when opened, so its blocks do not fetch on every load.
- **Instant on return:** the last weather for each city and language (up to 3 hours old) is shown immediately from `localStorage` and refreshed in the background.
- **Always fresh:** weather refreshes quietly every 10 minutes while the tab is visible (and as soon as you come back to it); a failed load retries when the connection returns. Each home block remembers its Day / 5 days choice.
- **Production hardening:** the proxy accepts only validated params (coordinates in range and rounded, known units and languages, short queries), Cloudflare caches successful OpenWeatherMap answers at the edge and never errors; the build emits `_headers` with a strict Content-Security-Policy (the inline script allowed by hash), security headers and year-long caching for fingerprinted assets. An end-to-end test runs the app under that policy.
- **Resilient networking:** request timeouts, typed errors with readable messages and retry, a 10-minute cache, deduplicated and cancellable requests so a slow answer never overwrites a newer one.

## Tech

| Area | Choice |
| --- | --- |
| Framework | Vue 3 (`<script setup>`), TypeScript strict, Vite |
| State | Pinia setup stores with versioned, validated `localStorage` |
| Charts | Chart.js 4, tree-shaken registration |
| Styling | Hand-written CSS with design tokens, day and night themes, Onest variable font |
| Data | OpenWeatherMap Current Weather, 5 day / 3 hour Forecast and Geocoding; Open-Meteo Geocoding for autocomplete; get.geojs.io and ipapi.co for IP location |
| Tests | Vitest + Vue Test Utils (unit and component), Playwright + axe-core (end to end) |
| Quality | ESLint (flat config, Vue + TypeScript), Prettier |
| Hosting | Cloudflare Pages + Pages Functions |

## How it is organised

```
src/
  api/          fetch wrapper and cache, OpenWeatherMap client, Open-Meteo city search, IP and device location, weather snapshots
  domain/       pure logic: hourly and daily series, day/night, condition icons, units, limits, distances, popular cities
  stores/       Pinia: blocks, favourites, settings (language, look, units), theme
  composables/  useWeather, useBlockChart, useCitySearch, useDefaultCity, useBlockTransitions, useToasts, useAnnouncer, useNow, useCountUp, useHashTab
  components/   base UI (button, modal, menu, tabs, segmented control), search, weather (block, card, week, chart, icons, skeletons), favourites, layout
  views/        Home and Favourites tabs
  i18n/         typed en/uk messages
server/         the proxy logic (validation, edge caching)
functions/      Cloudflare Pages Function for /api/owm/*
build/          Vite plugin that writes Cloudflare _headers (CSP with script hashes, caching)
e2e/            Playwright tests with mocked APIs
```

Notable decisions:

- **Autocomplete uses Open-Meteo's geocoder.** OpenWeatherMap's geocoder only matches whole names, which is unusable while typing; it remains the fallback. Weather itself always comes from OpenWeatherMap.
- **"Today" means the city's local day,** not the visitor's; all grouping and formatting use the city's UTC offset.
- **The IP-reported city name is matched in the geocoder** rather than naming the rough IP coordinates, which tended to return villages next to the city.

## Run locally

Requires Node 24 and a free [OpenWeatherMap API key](https://home.openweathermap.org/api_keys).

```sh
npm install
cp .env.example .env.local   # then set OWM_API_KEY
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server; the proxy adds the key from `.env.local` |
| `npm run build` | Type-check and production build to `dist/` |
| `npm test` | Unit and component tests |
| `npm run e2e` | End-to-end tests on the production build (first run: `npx playwright install chromium`) |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run check` | Lint, format check, unit tests and build |

## Deploy (Cloudflare Pages)

- Build command `npm run build`, output directory `dist`, Node 24.
- The `functions/` directory is deployed automatically as Pages Functions.
- Set the secret `OWM_API_KEY` in the project settings (or `npx wrangler pages secret put OWM_API_KEY`).
- Add a rate-limiting rule for `/api/*` in the Cloudflare dashboard (for example 60 requests per minute per IP), so nobody can use up the free OpenWeatherMap quota with valid but endless requests.
