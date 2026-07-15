<script setup lang="ts">
import type { NexusService } from '@/types/nexus'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import NexusMoreServices from '@/components/nexus/NexusMoreServices.vue'
import NexusServiceIcon from '@/components/nexus/NexusServiceIcon.vue'
import { useNexusStore } from '@/stores/nexus'

const props = defineProps<{
  nodeUuid: string
  nodeName: string
}>()

const nexusStore = useNexusStore()
const moreOpen = ref(false)
const services = computed(() => nexusStore.servicesForNode(props.nodeUuid))
const hasMore = computed(() => services.value.length > 4)
const visibleServices = computed(() => hasMore.value ? services.value.slice(0, 3) : services.value.slice(0, 4))

function handleUnavailable(service: NexusService, event: MouseEvent) {
  if (nexusStore.serviceUrl(service))
    return
  event.preventDefault()
  window.$message.warning(`${service.name} 尚未配置访问地址`)
}
</script>

<template>
  <div v-if="services.length > 0" class="mt-3 flex min-w-0 items-stretch gap-1 border-t border-border/60 pt-3">
    <a
      v-for="service in visibleServices"
      :key="service.id"
      :href="nexusStore.serviceUrl(service) || undefined"
      :target="nexusStore.serviceUrl(service) ? '_blank' : undefined"
      :rel="nexusStore.serviceUrl(service) ? 'noopener noreferrer' : undefined"
      class="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-sm px-1 py-1 text-center outline-none transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring"
      :aria-label="`打开 ${service.name}`"
      @click.stop="handleUnavailable(service, $event)"
    >
      <NexusServiceIcon class="nexus-node-service-icon" :icon="service.icon" :name="service.name" size="md" />
      <span class="w-full truncate text-xs text-muted-foreground">{{ service.name }}</span>
    </a>
    <button
      v-if="hasMore"
      type="button"
      class="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-sm px-1 py-1 text-center text-muted-foreground outline-none transition-colors hover:bg-muted/55 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="查看该节点更多服务"
      @click.stop="moreOpen = true"
    >
      <span class="inline-flex size-12 items-center justify-center rounded-md bg-muted/45">
        <Icon icon="lucide:ellipsis" class="size-5" />
      </span>
      <span class="text-xs">更多</span>
    </button>
  </div>

  <NexusMoreServices
    v-if="moreOpen"
    :node-name="nodeName"
    :services="services"
    @close="moreOpen = false"
  />
</template>
