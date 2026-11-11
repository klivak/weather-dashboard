<script setup lang="ts">
import { useAnnouncer } from '@/composables/useAnnouncer'

const { message } = useAnnouncer()
</script>

<template>
  <p class="announcer visually-hidden" role="status" aria-live="polite">{{ message }}</p>
</template>
