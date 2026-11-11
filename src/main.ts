import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { loadTempChart } from './components/weather/loadTempChart'
import './styles/base.css'

createApp(App).use(createPinia()).mount('#app')

// Fetch the chart chunk in parallel with the first weather requests instead of after them.
void loadTempChart()
