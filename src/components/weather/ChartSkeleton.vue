<template>
  <!-- Same footprint as TempChart, shown while its code chunk or data is on the way. -->
  <div class="chart-skeleton" aria-hidden="true">
    <span class="chart-skeleton__plot" />
  </div>
</template>

<style scoped>
.chart-skeleton {
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.chart-skeleton > * {
  display: block;
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

.chart-skeleton__plot {
  height: 270px;
  border-radius: var(--radius-md);
}

@media (min-width: 1024px) {
  .chart-skeleton__plot {
    height: 310px;
  }
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
