<script setup lang="ts">
import type { NexusService } from '@/types/nexus'
import { Icon } from '@iconify/vue'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import NexusServiceIcon from '@/components/nexus/NexusServiceIcon.vue'
import { Button } from '@/components/ui/button'
import { useNexusStore } from '@/stores/nexus'

defineProps<{
  nodeName: string
  services: NexusService[]
}>()

const emit = defineEmits<{
  close: []
}>()

const nexusStore = useNexusStore()
const closeButton = ref<InstanceType<typeof Button>>()
let previousOverflow = ''

function close() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    close()
}

function handleUnavailable(service: NexusService, event: MouseEvent) {
  if (nexusStore.serviceUrl(service))
    return
  event.preventDefault()
  window.$message.warning(`${service.name} 尚未配置访问地址`)
}

onMounted(async () => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', handleKeydown)
  await nextTick()
  const element = (closeButton.value as unknown as { $el?: HTMLElement })?.$el
  element?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-60 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" @mousedown.self="close">
      <section
        role="dialog"
        aria-modal="true"
        :aria-label="`${nodeName} 的全部服务`"
        class="nexus-dialog max-h-[82vh] w-full overflow-hidden rounded-t-md border border-border bg-background shadow-2xl sm:max-w-lg sm:rounded-md"
      >
        <header class="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div class="min-w-0">
            <h3 class="truncate text-base font-semibold text-foreground">
              {{ nodeName }}
            </h3>
            <p class="text-xs text-muted-foreground">
              全部服务
            </p>
          </div>
          <Button ref="closeButton" variant="ghost" size="icon-sm" aria-label="关闭全部服务" title="关闭全部服务" @click="close">
            <Icon icon="lucide:x" class="size-4" />
          </Button>
        </header>
        <div class="grid max-h-[68vh] gap-1 overflow-y-auto p-3 sm:grid-cols-2">
          <a
            v-for="service in services"
            :key="service.id"
            :href="nexusStore.serviceUrl(service) || undefined"
            :target="nexusStore.serviceUrl(service) ? '_blank' : undefined"
            :rel="nexusStore.serviceUrl(service) ? 'noopener noreferrer' : undefined"
            class="flex min-w-0 items-center gap-3 rounded-sm px-3 py-2.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            :class="{ 'cursor-not-allowed opacity-60': !nexusStore.serviceUrl(service) }"
            @click="handleUnavailable(service, $event)"
          >
            <NexusServiceIcon :icon="service.icon" :name="service.name" size="sm" />
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-foreground">{{ service.name }}</span>
              <span class="block truncate text-xs text-muted-foreground">{{ service.description || '服务入口' }}</span>
            </span>
          </a>
        </div>
      </section>
    </div>
  </Teleport>
</template>
