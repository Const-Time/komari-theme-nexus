<script setup lang="ts">
import type { NexusService } from '@/types/nexus'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import NexusServiceIcon from '@/components/nexus/NexusServiceIcon.vue'
import { useNexusStore } from '@/stores/nexus'

const props = defineProps<{
  service: NexusService
}>()

const nexusStore = useNexusStore()
const url = computed(() => nexusStore.serviceUrl(props.service))

function handleUnavailable(event: MouseEvent | KeyboardEvent) {
  if (url.value)
    return
  event.preventDefault()
  window.$message.warning(`${props.service.name} 尚未配置访问地址`)
}
</script>

<template>
  <a
    :href="url || undefined"
    :target="url ? '_blank' : undefined"
    :rel="url ? 'noopener noreferrer' : undefined"
    class="nexus-panel nexus-service-card group flex h-22 min-w-0 items-center gap-2.5 overflow-hidden p-3 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring sm:h-24 sm:gap-3 sm:p-3.5"
    :class="url ? 'hover:-translate-y-0.5' : 'cursor-not-allowed opacity-65'"
    :tabindex="0"
    :aria-disabled="!url"
    :aria-label="url ? `打开 ${service.name}` : `${service.name} 不可访问`"
    @click="handleUnavailable"
    @keydown.enter="handleUnavailable"
  >
    <NexusServiceIcon :icon="service.icon" :name="service.name" size="md" />
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2">
        <span class="truncate text-sm font-semibold text-foreground sm:text-base">{{ service.name }}</span>
        <Icon v-if="url" icon="lucide:arrow-up-right" class="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </span>
      <span class="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground sm:mt-1 sm:text-sm sm:leading-5">
        {{ service.description || '服务入口' }}
      </span>
    </span>
  </a>
</template>
