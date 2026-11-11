# Weather Dashboard

Compare the weather in up to five cities side by side: current conditions, an hourly temperature chart, a 5-day view, favourites, English and Ukrainian, and a day/night look.

Built with Vue 3, TypeScript, Pinia and Chart.js. Styling is hand-written CSS. Weather data from [OpenWeatherMap](https://openweathermap.org/). Hosted on Cloudflare Pages.

Roadmap and architecture: [docs/PLAN.md](docs/PLAN.md).

## Run locally

Requires Node 24.

```sh
npm install
cp .env.example .env.local   # add your OpenWeatherMap key
npm run dev
```

## Scripts

| Command                           | What it does                        |
| --------------------------------- | ----------------------------------- |
| `npm run dev`                     | Dev server with the API proxy       |
| `npm run build`                   | Type-check and production build     |
| `npm run lint` / `npm run format` | ESLint / Prettier                   |
| `npm test`                        | Unit and component tests (Vitest)   |
| `npm run check`                   | Lint, format check, tests and build |
