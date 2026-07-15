<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { observeIconPreview } from '@/utils/iconifyPreview'

defineProps<{
  icon: string
}>()

const host = ref<HTMLElement | null>(null)
const visible = ref(false)
let stopObserving = () => {}

onMounted(() => {
  const element = host.value
  if (!element)
    return
  stopObserving = observeIconPreview(element, () => {
    visible.value = true
  })
})

onBeforeUnmount(() => stopObserving())
</script>

<template>
  <span ref="host" class="inline-flex size-7 shrink-0 items-center justify-center" aria-hidden="true">
    <Icon v-if="visible" :icon="icon" class="size-7" />
    <span v-else class="size-5 rounded-sm bg-muted/70" />
  </span>
</template>
