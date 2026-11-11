<script setup lang="ts">
import { useI18n } from '@/i18n'

const { t } = useI18n()
</script>

<template>
  <footer class="footer">
    <div class="container footer__inner">
      <span>
        {{ t('footer.data') }}:
        <a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">OpenWeather</a>
      </span>
    </div>
  </footer>
</template>

<style scoped>
.footer__inner {
  padding-block: var(--space-8);
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.footer a {
  text-underline-offset: 3px;
}

.footer a:hover {
  color: var(--text);
}
</style>
