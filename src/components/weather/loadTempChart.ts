/** Shared loader for the chart chunk, so main.ts can start fetching it while the weather data loads. */
export const loadTempChart = () => import('./TempChart.vue')
