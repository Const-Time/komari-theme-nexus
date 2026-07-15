<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import NexusGlobe from '@/components/nexus/NexusGlobe.vue'
import NexusStats from '@/components/nexus/NexusStats.vue'
import { useAppStore } from '@/stores/app'

defineProps<{
  nodes: NodeData[]
}>()

const appStore = useAppStore()
</script>

<template>
  <section v-if="!appStore.hideGeneralCard" class="relative px-4 pt-2 sm:px-6 lg:px-7 lg:pt-4">
    <div class="grid items-center lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-4">
      <div
        v-if="!appStore.hideEarth"
        class="relative z-0 mx-auto h-[300px] w-full max-w-[430px] overflow-visible sm:h-[360px] lg:order-2 lg:h-[250px] lg:max-w-[280px]"
      >
        <NexusGlobe :nodes="nodes" class="absolute left-1/2 top-[58%] w-[390px] -translate-x-1/2 -translate-y-1/2 scale-110 sm:top-[56%] sm:w-[450px] lg:top-[54%] lg:w-[310px] lg:scale-100" />
      </div>
      <NexusStats
        :nodes="nodes"
        class="relative z-10 -mt-16 lg:order-1 lg:mt-0"
        :class="{ '!mt-0 lg:col-span-2': appStore.hideEarth }"
      />
    </div>
  </section>
</template>
