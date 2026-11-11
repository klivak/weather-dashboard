<script setup lang="ts">
const title = 'Weather Dashboard'
</script>

<template>
  <main class="app">
    <h1>{{ title }}</h1>
  </main>
</template>

<style scoped>
.app {
  max-width: var(--container-max);
  margin-inline: auto;
  padding: var(--space-4);
}
</style>
