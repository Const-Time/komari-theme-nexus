<script setup lang="ts">
import { nextTick, onActivated, onDeactivated } from 'vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import NexusHero from '@/components/nexus/NexusHero.vue'
import NexusOperations from '@/components/nexus/NexusOperations.vue'
import NexusProbeCarousel from '@/components/nexus/NexusProbeCarousel.vue'
import NexusServiceCarousel from '@/components/nexus/NexusServiceCarousel.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'

defineOptions({ name: 'HomeView' })

const appStore = useAppStore()
const nodesStore = useNodesStore()

onActivated(() => {
  if (appStore.homeScrollPosition <= 0)
    return
  nextTick(() => window.scrollTo({ top: appStore.homeScrollPosition, behavior: 'instant' }))
})

onDeactivated(() => {
  appStore.homeScrollPosition = window.scrollY
})
</script>

<template>
  <div class="home-view pb-3">
    <div v-if="appStore.alertEnabled && appStore.alertContent" class="px-4 pt-2 sm:px-6 lg:px-7">
      <Alert class="border-border/70 bg-background/55 backdrop-blur-md">
        <AlertTitle v-if="appStore.alertTitle">
          {{ appStore.alertTitle }}
        </AlertTitle>
        <AlertDescription>
          <MarkdownRenderer :content="appStore.alertContent" />
        </AlertDescription>
      </Alert>
    </div>

    <NexusHero :nodes="nodesStore.visibleNodes" />
    <NexusServiceCarousel />
    <NexusProbeCarousel :nodes="nodesStore.visibleNodes" />
    <NexusOperations :nodes="nodesStore.visibleNodes" />
  </div>
</template>
