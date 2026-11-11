# Weather Dashboard — roadmap

Compare the weather in up to five cities side by side: current conditions, an hourly temperature chart, a 5-day view, favourites, en/uk and a day/night look. Built with Vue 3, TypeScript, Pinia and Chart.js; hand-written CSS only (no CSS frameworks, no UI kits, no `vue-chartjs`). Data from OpenWeatherMap, hosted on Cloudflare Pages.

## Status

Current step: **2 — Shell**. Each step ends green on `npm run check` and with its own commits.

| #   | Step                                               | State |
| --- | -------------------------------------------------- | ----- |
| 0   | Tooling: Vite, TS strict, ESLint, Prettier, Vitest | done  |
| 1   | API layer and key proxy                            | done  |
| 2   | Shell: tokens, layout, header, tabs, i18n          | next  |
| 3   | City search with autocomplete                      |       |
| 4   | Weather block: today card + hourly chart           |       |
| 5   | Multiple blocks (+, max 5, delete with confirm)    |       |
| 6   | Favourites tab (localStorage, max 5, limit modal)  |       |
| 7   | Day / 5-day switch                                 |       |
| 8   | Default city from IP                               |       |
| 9   | Day / night look                                   |       |
| 10  | Polish: a11y, responsive 360–1200, e2e, README     |       |
| 11  | Deploy to Cloudflare Pages                         |       |

## Requirements

Core:

- City input with autocomplete.
- Requests via `fetch`.
- Today's weather as a card.
- Hourly temperature chart for today with Chart.js used directly (no Vue wrapper plugin).
- Several weather blocks: one by default, the "+" button adds another fully working block, max 5.
- Deleting a block asks for confirmation in a modal.
- Favourites tab: add/remove a city; a favourite city is marked on its card (icon + border); the tab shows a block per favourite with no city picker, only the day/week switch; stored in `localStorage`; max 5; adding a sixth opens a modal "To add a city, remove one of: … (max 5)".
- Responsive: main container 1200px, minimum width 360px.

Extras:

- Day / 5-day switch for the card and the chart; a day's temperature is the mean of its 3-hour forecast points (`/data/2.5/forecast`).
- Default block shows the visitor's city detected by IP through an open service.
- Loaders wherever a request is in flight.
- English and Ukrainian for both the interface and API responses (`lang=en|uk`).
- Day / night switch for the weather view.
- Anything extra is listed in the README.

## Architecture

```
src/
  api/          fetch wrapper, OpenWeatherMap client, IP lookup, response types
  domain/       pure logic: forecast grouping/averages, limits, day/night (unit tested)
  stores/       Pinia: blocks, favourites, settings (locale, units, theme)
  composables/  useWeather, useDebounced, useModal, ...
  i18n/         en.ts, uk.ts, typed t()
  components/   AppHeader, TabBar, WeatherBlock, CitySearch, WeatherCard, TempChart, BaseModal, Loader, ...
  styles/       tokens + base CSS
functions/api/owm/[[path]].ts   Cloudflare Pages Function: allow-listed proxy that adds the API key
```

Decisions:

- **Key stays server-side.** The client calls `/api/owm/...`; Vite's dev proxy (local) and a Pages Function (prod) append `appid`. Only `/data/2.5/weather`, `/data/2.5/forecast` and `/geo/1.0/direct` are allowed.
- **Endpoints (free tier):** Geocoding `direct` for autocomplete (limit 5, `local_names` for uk), Current Weather for the card, 5 day / 3 hour Forecast for the chart and the 5-day view. Blocks store `lat/lon` plus a display name, never a free-text query.
- **Hourly chart for today** = forecast points for the city's local date (3-hour steps, shifted by `timezone`), with the current reading as the first point.
- **5-day view** groups forecast points by the city's local date; mean, min and max temperature per day; the icon is the most frequent daytime condition.
- **IP lookup:** `get.geojs.io` → `ipapi.co` → Kyiv fallback; cached for the session.
- **Day / night:** `auto` follows the selected city's sunrise/sunset; manual `day` / `night` override; saved in `localStorage`.
- **State:** Pinia stores, persisted keys `wd:blocks`, `wd:favourites`, `wd:settings` with versioned schemas and safe parsing.
- **Caching:** in-memory per `(endpoint, lat, lon, lang)` for 10 minutes; in-flight requests are deduplicated; stale responses are dropped with `AbortController`.

## Quality bar

- TypeScript strict with `noUncheckedIndexedAccess`; no `any`.
- Domain logic covered by Vitest; components with Vue Test Utils for search, limits and modals; one Playwright smoke run before deploy.
- Accessibility: autocomplete follows the WAI-ARIA combobox pattern, modals trap focus and close on Esc, visible focus, reduced motion respected.
- Every loading, empty and error state is designed.
- Layout checked at 360, 768 and 1200 px.
