<script setup lang="ts">
import type { NexusService } from '@/types/nexus'
import { Icon } from '@iconify/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import NexusServiceIcon from '@/components/nexus/NexusServiceIcon.vue'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app'
import { useNexusStore } from '@/stores/nexus'

defineProps<{
  open: boolean
  nodeName: string
  services: NexusService[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const nexusStore = useNexusStore()
const appStore = useAppStore()

function handleOpenChange(open: boolean) {
  emit('update:open', open)
}

function handleServiceClick(service: NexusService, event: MouseEvent) {
  if (nexusStore.serviceUrl(service)) {
    handleOpenChange(false)
    return
  }
  event.preventDefault()
  window.$message.warning(`${service.name} 尚未配置访问地址`)
}
</script>

<template>
  <DialogRoot :open="open" @update:open="handleOpenChange">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-60 bg-black/45 backdrop-blur-sm motion-reduce:animate-none"
        :class="appStore.disablePageAnimation ? '' : 'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'"
      />
      <DialogContent
        class="nexus-dialog fixed bottom-0 left-1/2 z-60 max-h-[82vh] w-full -translate-x-1/2 overflow-hidden rounded-t-md border border-border bg-background shadow-2xl outline-none motion-reduce:animate-none sm:bottom-auto sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:rounded-md"
        :class="appStore.disablePageAnimation ? '' : 'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95'"
      >
        <header class="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div class="min-w-0">
            <DialogTitle class="truncate text-base font-semibold text-foreground">
              {{ nodeName }}
            </DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground">
              全部服务
            </DialogDescription>
          </div>
          <DialogClose as-child>
            <Button variant="ghost" size="icon-sm" aria-label="关闭全部服务" title="关闭全部服务">
              <Icon icon="lucide:x" class="size-4" />
            </Button>
          </DialogClose>
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
            :aria-disabled="!nexusStore.serviceUrl(service)"
            @click="handleServiceClick(service, $event)"
          >
            <NexusServiceIcon :icon="service.icon" :name="service.name" size="sm" />
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-foreground">{{ service.name }}</span>
              <span class="block truncate text-xs text-muted-foreground">{{ service.description || '服务入口' }}</span>
            </span>
          </a>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
