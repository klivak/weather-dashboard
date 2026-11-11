<template>
  <svg class="logo" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
    <circle cx="14" cy="14" r="7.5" fill="var(--accent)" />
    <g stroke="var(--accent)" stroke-width="2" stroke-linecap="round">
      <path d="M14 2.5v2.5M3.5 14H6M6.6 6.6l1.8 1.8M21.4 6.6l-1.8 1.8" />
    </g>
    <path
      d="M11 30a6 6 0 0 1-.4-12 8 8 0 0 1 15.3 2.3A4.9 4.9 0 0 1 25.5 30H11z"
      fill="var(--surface-raised)"
      stroke="var(--border-strong)"
      stroke-width="1"
    />
  </svg>
</template>

<style scoped>
.logo {
  display: block;
  filter: drop-shadow(0 2px 6px rgb(0 0 0 / 0.08));
}
</style>
