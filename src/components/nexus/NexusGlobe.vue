<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { defineAsyncComponent } from 'vue'

defineProps<{
  nodes: NodeData[]
}>()

const NodeEarthGlobe = defineAsyncComponent(() => import('@/components/NodeEarthGlobe.vue'))
</script>

<template>
  <div class="nexus-globe relative mx-auto aspect-square w-full max-w-[420px]" aria-label="节点地理分布地球">
    <NodeEarthGlobe :nodes="nodes" />
  </div>
</template>
