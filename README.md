# Weather Dashboard

Compare the weather in up to five cities side by side: current conditions, an hourly temperature chart, a 5-day view, favourites, English and Ukrainian, and a look that turns to night when the sun sets in your city.

Built with Vue 3, TypeScript, Pinia and Chart.js. All styling is hand-written CSS (no CSS framework, no UI kit, no Vue chart wrapper). Weather data from [OpenWeatherMap](https://openweathermap.org/), hosted on Cloudflare Pages.

## Features

- **City search with autocomplete.** Matches as you type in Latin or Cyrillic ("Lond" → London, "Хар" → Харків), highlights the match and shows the region to tell same-name places apart. Full keyboard support (WAI-ARIA combobox), loading, empty and error states.
- **Today card.** Temperature, conditions, feels-like, humidity, wind with direction, pressure, visibility, sunrise and sunset, all in the city's own time zone.
- **Hourly temperature chart.** Chart.js used directly: the live reading plus the 3-hour forecast for the rest of the local day; late in the evening it continues into the next morning and is titled "Next 24 hours".
- **Up to five weather blocks.** One block by default, "+" adds another fully working block, removal asks for confirmation in a modal.
- **Favourites tab.** Star a city to keep it; favourite blocks get a gold ring. The tab shows a block per favourite with no city search, only the Day / 5 days switch. Stored in `localStorage`, at most five; starring a sixth opens a dialog listing the saved cities so you can swap one out.
- **Day / 5 days.** Card and chart switch to five days; a day's temperature is the mean of its 3-hour forecasts, with the daily low–high shown as a band.
- **Your city by default.** On the first visit the city is detected from the IP address with open services; Kyiv is the fallback.
- **Loaders everywhere.** Skeletons shaped like the final content, so nothing jumps when data arrives.
- **English and Ukrainian.** Interface, number and date formats and the weather descriptions from the API (`lang=en|uk`); city names come in both languages.
- **Day / night look.** Auto (follows sunrise and sunset in the first city, re-checked every minute), Day or Night, with a crossfade between them.
- **Responsive.** 1200px main container down to 360px.

### Extras

- **Use my location:** a button in the search field picks the city at the device position (browser geolocation), with clear messages when permission is blocked.
- **The API key never reaches the browser:** requests go through an allow-listed proxy (Vite in development, a Cloudflare Pages Function in production) that adds the key server-side.
- **Everything persists:** blocks, chosen cities, favourites, language and look survive a reload; corrupted storage is ignored safely.
- **Accessibility:** semantic landmarks and headings, tabs and segmented controls with arrow-key navigation, focus-trapped native `<dialog>` modals with Esc and focus return, a polite live region for status messages, a hidden data table for every chart, visible focus, `prefers-reduced-motion` respected. Automated axe checks (WCAG 2.2 AA) run in the end-to-end tests in both looks.
- **Own SVG weather icons** for ten condition types with day and night variants.
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
  api/          fetch wrapper, cache, OpenWeatherMap client, city search, IP and device location
  domain/       pure logic: hourly and daily series, day/night, condition icons, limits, distances
  stores/       blocks, favourites, settings, theme (Pinia)
  composables/  useWeather, useCitySearch, useHashTab, useAnnouncer
  components/   base UI, search, weather (card, week, chart, icons), favourites, layout
  views/        Home and Favourites tabs
  i18n/         typed en/uk messages
functions/      Cloudflare Pages Function for /api/owm/*
server/         the proxy logic used by that function
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
