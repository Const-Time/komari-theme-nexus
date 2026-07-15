<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  icon?: string
  name: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  icon: '',
  size: 'md',
})

const IMAGE_URL_RE = /^(?:https?:|data:image\/(?:gif|jpeg|png|webp);base64,|\/)/i

const imageError = ref(false)
const imageLoaded = ref(false)
const iconLoaded = ref(false)
const isImage = computed(() => IMAGE_URL_RE.test(props.icon))
const fallbackText = computed(() => Array.from(props.name.trim())[0]?.toUpperCase() || '?')
const showFallback = computed(() => isImage.value
  ? imageError.value || !imageLoaded.value
  : !props.icon || !iconLoaded.value)
const sizeClass = computed(() => ({
  sm: 'size-9 text-xl',
  md: 'size-12 text-2xl',
  lg: 'size-14 text-3xl',
})[props.size])

watch(() => props.icon, () => {
  imageError.value = false
  imageLoaded.value = false
  iconLoaded.value = false
})
</script>

<template>
  <span
    class="nexus-service-icon relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md"
    :class="sizeClass"
    aria-hidden="true"
  >
    <span v-if="showFallback" class="text-[0.46em] font-semibold text-muted-foreground">
      {{ fallbackText }}
    </span>
    <img
      v-if="isImage && !imageError"
      :src="icon"
      :alt="name"
      class="absolute inset-0 size-full object-cover"
      :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
      loading="lazy"
      referrerpolicy="no-referrer"
      @load="imageLoaded = true"
      @error="imageError = true"
    >
    <Icon
      v-else-if="!isImage && icon"
      :icon="icon"
      class="absolute inset-0 m-auto"
      :class="iconLoaded ? 'opacity-100' : 'opacity-0'"
      @load="iconLoaded = true"
    />
  </span>
</template>
