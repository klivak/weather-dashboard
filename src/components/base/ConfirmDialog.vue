<script setup lang="ts">
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel: string
    cancelLabel: string
    tone?: 'danger' | 'primary'
  }>(),
  { description: undefined, tone: 'danger' },
)

const emit = defineEmits<{ confirm: [] }>()

const open = defineModel<boolean>('open', { required: true })

function confirm() {
  emit('confirm')
  open.value = false
}
</script>

<template>
  <BaseModal v-model:open="open" :title="title" :description="description">
    <template #actions>
      <!-- The safe choice gets initial focus, so Enter right after opening never destroys anything. -->
      <BaseButton autofocus @click="open = false">{{ cancelLabel }}</BaseButton>
      <BaseButton :variant="tone" @click="confirm">{{ confirmLabel }}</BaseButton>
    </template>
  </BaseModal>
</template>
