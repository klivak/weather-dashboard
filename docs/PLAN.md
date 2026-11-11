# Weather Dashboard — roadmap

Compare the weather in up to five cities side by side: current conditions, an hourly temperature chart, a 5-day view, favourites, en/uk and a day/night look. Built with Vue 3, TypeScript, Pinia and Chart.js; hand-written CSS only (no CSS frameworks, no UI kits, no `vue-chartjs`). Data from OpenWeatherMap, hosted on Cloudflare Pages.

## Status

Current step: **11 — Deploy**. Each step ends green on `npm run check` and with its own commits.

| #   | Step                                               | State |
| --- | -------------------------------------------------- | ----- |
| 0   | Tooling: Vite, TS strict, ESLint, Prettier, Vitest | done  |
| 1   | API layer and key proxy                            | done  |
| 2   | Shell: tokens, layout, header, tabs, i18n          | done  |
| 3   | City search with autocomplete                      | done  |
| 4   | Weather block: today card + hourly chart           | done  |
| 5   | Multiple blocks (+, max 5, delete with confirm)    | done  |
| 6   | Favourites tab (localStorage, max 5, limit modal)  | done  |
| 7   | Day / 5-day switch                                 | done  |
| 8   | Default city from IP                               | done  |
| 9   | Day / night look                                   | done  |
| 10  | Polish: a11y, responsive 360–1200, e2e, README     | done  |
| 11  | Deploy to Cloudflare Pages                         | next  |

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
  api/          fetch wrapper, OpenWeatherMap client, Open-Meteo city search, IP lookup, response types
  domain/       pure logic: forecast grouping/averages, limits, day/night (unit tested)
  stores/       Pinia: blocks, favourites, settings (locale, units, theme)
  composables/  useWeather, useDebounced, useModal, ...
  i18n/         en.ts, uk.ts, typed t()
  components/   AppHeader, TabBar, WeatherBlock, CitySearch, WeatherCard, TempChart, BaseModal, Loader, ...
  styles/       tokens + base CSS
functions/api/owm/[[path]].ts   Cloudflare Pages Function: allow-listed proxy that adds the API key
```

Decisions:

- **Key stays server-side.** The client calls `/api/owm/...`; Vite's dev proxy (local) and a Pages Function (prod) append `appid`. Only `/data/2.5/weather`, `/data/2.5/forecast`, `/geo/1.0/direct` and `/geo/1.0/reverse` are allowed.
- **Weather (OpenWeatherMap, free tier):** Current Weather for the card, 5 day / 3 hour Forecast for the chart and the 5-day view, `lang=en|uk`. Blocks store `lat/lon` plus names, never a free-text query.
- **City autocomplete (Open-Meteo geocoding):** OpenWeatherMap's geocoder only matches whole names ("Lond" does not find London), so suggestions come from Open-Meteo's free, key-less prefix search: queried in the script the user types (Cyrillic → Ukrainian), with the other language fetched in parallel so each city has both names; districts and abandoned places filtered out; OpenWeatherMap `geo/1.0/direct` is the fallback when Open-Meteo is down or finds nothing.
- **Hourly chart for today** = the live reading plus the forecast points left in the city's local day (3-hour steps, shifted by `timezone`); late in the day it continues into tomorrow until it has 8 points and is titled "Next 24 hours" instead of "Temperature today".
- **5-day view** groups forecast points by the city's local date; mean, min and max temperature per day; the icon is the most frequent daytime condition.
- **Default city:** first visit only (a restored layout is left alone): `get.geojs.io` → `ipapi.co` give a rough point and a city name; the name is matched in the geocoder to the place nearest the point (reverse geocoding the point itself returned villages next to the city), reverse geocoding is the fallback, Kyiv when everything fails or is blocked. The block shows "Finding your city…" meanwhile and a city the user picks in the meantime wins. Cached for the session.
- **Use my location (extra):** a button in the search field asks the browser for the device position and reverse-geocodes it; blocked permission and failures are explained under the field.
- **Day / night:** a header switch with `auto` (default), `day` and `night`, saved in `localStorage`. `auto` compares the local time of day with sunrise and sunset of the first home city (works for days-old data), falls back to 07:00–19:00 on the device clock, and is re-checked every minute. The change crossfades with the View Transitions API where available (not under reduced motion).
- **State:** Pinia stores, persisted keys `wd:blocks`, `wd:favourites`, `wd:settings` with versioned schemas and safe parsing.
- **Caching:** in-memory per `(endpoint, lat, lon, lang)` for 10 minutes; in-flight requests are deduplicated; stale responses are dropped with `AbortController`.

## Quality bar

- TypeScript strict with `noUncheckedIndexedAccess`; no `any`.
- Domain logic covered by Vitest; components with Vue Test Utils for search, limits and modals; Playwright end-to-end tests on the production build (desktop 1200px and mobile 360px) with mocked APIs and axe WCAG 2.2 AA checks in both looks (`npm run e2e`).
- Accessibility: autocomplete follows the WAI-ARIA combobox pattern, modals trap focus and close on Esc, visible focus, reduced motion respected.
- Every loading, empty and error state is designed.
- Layout checked at 360, 768 and 1200 px.
