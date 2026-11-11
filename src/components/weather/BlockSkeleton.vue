<script setup lang="ts">
import ChartSkeleton from './ChartSkeleton.vue'
</script>

<template>
  <!-- Mirrors the card and the chart so nothing jumps when the data arrives. -->
  <div class="block-skeleton" aria-hidden="true">
    <div class="skeleton">
      <span class="skeleton__line skeleton__line--title" />
      <span class="skeleton__line skeleton__line--meta" />
      <div class="skeleton__now">
        <span class="skeleton__circle" />
        <span class="skeleton__line skeleton__line--temp" />
      </div>
      <div class="skeleton__grid">
        <span v-for="cell in 6" :key="cell" class="skeleton__cell" />
      </div>
    </div>
    <div class="block__chart skeleton">
      <span class="skeleton__line skeleton__line--meta" />
      <ChartSkeleton />
    </div>
  </div>
</template>

<style scoped>
.block-skeleton {
  display: grid;
  gap: var(--space-8);
}

@media (min-width: 1024px) {
  .block-skeleton {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    align-items: start;
  }
}

.block__chart {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.skeleton {
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.skeleton > *,
.skeleton__now > *,
.skeleton__grid > * {
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--surface-sunken) 0%,
    color-mix(in srgb, var(--surface-sunken) 40%, var(--surface-raised)) 50%,
    var(--surface-sunken) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}

.skeleton__now,
.skeleton__grid,
.skeleton > .chart-skeleton {
  background: none !important;
  animation: none !important;
}

.skeleton__line {
  display: block;
  height: 14px;
}

.skeleton__line--title {
  width: 45%;
  height: 30px;
}

.skeleton__line--meta {
  width: 60%;
}

.skeleton__now {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-block: var(--space-3);
}

.skeleton__circle {
  width: 88px;
  height: 88px;
  border-radius: 50% !important;
}

.skeleton__line--temp {
  width: 120px;
  height: 64px;
}

.skeleton__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

@media (min-width: 560px) {
  .skeleton__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.skeleton__cell {
  height: 56px;
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
