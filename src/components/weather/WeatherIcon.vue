<script setup lang="ts">
import { computed } from 'vue'
import { conditionKind } from '@/domain/conditions'

const props = withDefaults(defineProps<{ code: number; day?: boolean; size?: number }>(), {
  day: true,
  size: 48,
})

const kind = computed(() => conditionKind(props.code))
const hasPrecipitation = computed(() => ['drizzle', 'rain', 'sleet', 'snow', 'thunder'].includes(kind.value))
/** Sun or moon shown alone (clear) or peeking behind a cloud (partly cloudy). */
const showSky = computed(() => kind.value === 'clear' || kind.value === 'partly')
const showBackCloud = computed(() => ['cloudy', 'overcast', 'thunder', 'rain', 'sleet'].includes(kind.value))
</script>

<template>
  <svg class="wx" :class="`wx--${kind}`" :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true">
    <!-- Sun or moon -->
    <g v-if="showSky" :transform="kind === 'partly' ? 'translate(2 1) scale(0.66)' : undefined">
      <g v-if="day" class="wx__sun">
        <g class="wx__rays" stroke-width="3.5" stroke-linecap="round">
          <path
            d="M32 6v6M32 52v6M6 32h6M52 32h6M13.6 13.6l4.2 4.2M46.2 46.2l4.2 4.2M13.6 50.4l4.2-4.2M46.2 17.8l4.2-4.2"
          />
        </g>
        <circle cx="32" cy="32" r="12" />
      </g>
      <path v-else class="wx__moon" d="M37 10a22 22 0 1 0 17 34A18 18 0 0 1 37 10z" />
    </g>

    <!-- Clouds; lifted when precipitation falls below -->
    <g
      v-if="kind !== 'clear' && kind !== 'mist'"
      :transform="hasPrecipitation ? 'translate(0 -9)' : undefined"
    >
      <path
        v-if="showBackCloud"
        class="wx__cloud-back"
        d="M14 38h22a9 9 0 0 0 .8-18A12.5 12.5 0 0 0 13 23.6 7.2 7.2 0 0 0 14 38z"
      />
      <path
        class="wx__cloud"
        :class="{ 'wx__cloud--dark': kind === 'overcast' || kind === 'thunder' }"
        d="M20 53h26a11 11 0 0 0 1-21.95A15 15 0 0 0 18.3 36.3 8.5 8.5 0 0 0 20 53z"
      />
    </g>

    <!-- Precipitation -->
    <g v-if="kind === 'rain'" class="wx__rain" stroke-width="3" stroke-linecap="round">
      <path d="M24 50l-3 8M33 50l-3 8M42 50l-3 8" />
    </g>
    <g v-else-if="kind === 'drizzle'" class="wx__rain-fill">
      <circle cx="23" cy="53" r="2" />
      <circle cx="32" cy="57" r="2" />
      <circle cx="41" cy="53" r="2" />
    </g>
    <g v-else-if="kind === 'snow'" class="wx__snow" stroke-width="2.4" stroke-linecap="round">
      <path d="M24 49v8M20.5 51l7 4M27.5 51l-7 4" />
      <path d="M40 49v8M36.5 51l7 4M43.5 51l-7 4" />
    </g>
    <g v-else-if="kind === 'sleet'">
      <path class="wx__rain" d="M25 50l-3 8" stroke-width="3" stroke-linecap="round" />
      <g class="wx__snow" stroke-width="2.4" stroke-linecap="round">
        <path d="M38 49v8M34.5 51l7 4M41.5 51l-7 4" />
      </g>
    </g>
    <path v-else-if="kind === 'thunder'" class="wx__bolt" d="M34 45l-8 11h6l-3 8 10-12h-6l3-7z" />

    <!-- Mist -->
    <g v-if="kind === 'mist'" class="wx__mist" stroke-width="3.5" stroke-linecap="round">
      <path d="M12 24h40M8 33h34M18 42h38M12 51h30" />
    </g>
  </svg>
</template>

<style scoped>
.wx {
  display: block;
  overflow: visible;
}

.wx__sun circle {
  fill: var(--icon-sun);
}

.wx__rays {
  stroke: var(--icon-sun);
}

.wx__moon {
  fill: var(--icon-moon);
}

.wx__cloud {
  fill: var(--icon-cloud);
  stroke: var(--icon-cloud-edge);
  stroke-width: 1.2;
}

.wx__cloud--dark {
  fill: var(--icon-cloud-dark);
}

.wx__cloud-back {
  fill: var(--icon-cloud-back);
}

.wx__rain {
  stroke: var(--icon-rain);
}

.wx__rain-fill {
  fill: var(--icon-rain);
}

.wx__snow {
  stroke: var(--icon-snow);
}

.wx__bolt {
  fill: var(--icon-sun);
}

.wx__mist {
  stroke: var(--icon-mist);
}
</style>
