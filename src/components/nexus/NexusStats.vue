<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import type { NexusAggregateSample } from '@/types/nexus'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import NexusSparkline from '@/components/nexus/NexusSparkline.vue'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig } from '@/utils/helper'

const props = defineProps<{
  nodes: NodeData[]
}>()

const appStore = useAppStore()
const samples = ref<NexusAggregateSample[]>([])

function ratio(used: number, total: number): number {
  return total > 0 ? Math.min(Math.max(used / total * 100, 0), 100) : 0
}

function captureSample(): NexusAggregateSample {
  const nodes = props.nodes
  const onlineNodes = nodes.filter(node => node.online)
  const metricNodes = onlineNodes.length > 0 ? onlineNodes : nodes
  const totals = nodes.reduce((acc, node) => {
    acc.memoryUsed += node.ram || 0
    acc.memoryTotal += node.mem_total || 0
    acc.diskUsed += node.disk || 0
    acc.diskTotal += node.disk_total || 0
    acc.upload += node.net_out || 0
    acc.download += node.net_in || 0
    return acc
  }, { memoryUsed: 0, memoryTotal: 0, diskUsed: 0, diskTotal: 0, upload: 0, download: 0 })
  const cpu = metricNodes.length > 0
    ? metricNodes.reduce((sum, node) => sum + (node.cpu || 0), 0) / metricNodes.length
    : 0

  return {
    timestamp: Date.now(),
    online: onlineNodes.length,
    cpu,
    memory: ratio(totals.memoryUsed, totals.memoryTotal),
    disk: ratio(totals.diskUsed, totals.diskTotal),
    upload: totals.upload,
    download: totals.download,
  }
}

watch(
  () => props.nodes.map(node => [
    node.uuid,
    node.online,
    node.cpu,
    node.ram,
    node.mem_total,
    node.disk,
    node.disk_total,
    node.net_in,
    node.net_out,
    node.cpu_cores,
  ].join(':')).join('|'),
  () => {
    const sample = captureSample()
    const last = samples.value.at(-1)
    if (last && sample.timestamp - last.timestamp < 1500)
      samples.value.splice(-1, 1, sample)
    else
      samples.value.push(sample)
    if (samples.value.length > 24)
      samples.value.splice(0, samples.value.length - 24)
  },
  { immediate: true },
)

const current = computed(() => captureSample())
const memoryUsed = computed(() => props.nodes.reduce((sum, node) => sum + (node.ram || 0), 0))
const memoryTotal = computed(() => props.nodes.reduce((sum, node) => sum + (node.mem_total || 0), 0))
const diskUsed = computed(() => props.nodes.reduce((sum, node) => sum + (node.disk || 0), 0))
const diskTotal = computed(() => props.nodes.reduce((sum, node) => sum + (node.disk_total || 0), 0))
const cpuCores = computed(() => props.nodes.reduce((sum, node) => sum + (node.cpu_cores || 0), 0))

function historicalTrend(key: 'cpu' | 'memory' | 'disk' | 'network'): number[] {
  return samples.value.map(sample => key === 'network'
    ? sample.upload + sample.download
    : sample[key])
}

const statCards = computed(() => [
  {
    key: 'online',
    label: '主机在线',
    icon: 'lucide:shield-check',
    color: 'var(--nexus-blue)',
    value: `${current.value.online} / ${props.nodes.length}`,
    detail: `${props.nodes.length > 0 ? Math.round(current.value.online / props.nodes.length * 100) : 0}% 在线率`,
    trend: samples.value.map(sample => sample.online),
  },
  {
    key: 'cpu',
    label: 'CPU 使用率',
    icon: 'lucide:cpu',
    color: 'var(--nexus-violet)',
    value: `${current.value.cpu.toFixed(0)}%`,
    detail: `${cpuCores.value} 核心`,
    trend: historicalTrend('cpu'),
  },
  {
    key: 'memory',
    label: '内存使用率',
    icon: 'lucide:memory-stick',
    color: 'var(--nexus-orange)',
    value: `${current.value.memory.toFixed(0)}%`,
    detail: `${formatBytesWithConfig(memoryUsed.value, appStore.byteDecimals)} / ${formatBytesWithConfig(memoryTotal.value, appStore.byteDecimals)}`,
    trend: historicalTrend('memory'),
  },
  {
    key: 'disk',
    label: '存储使用率',
    icon: 'lucide:hard-drive',
    color: 'var(--nexus-green)',
    value: `${current.value.disk.toFixed(0)}%`,
    detail: `${formatBytesWithConfig(diskUsed.value, appStore.byteDecimals)} / ${formatBytesWithConfig(diskTotal.value, appStore.byteDecimals)}`,
    trend: historicalTrend('disk'),
  },
  {
    key: 'network',
    label: '网络流量',
    icon: 'lucide:network',
    color: 'var(--nexus-cyan)',
    value: formatBytesPerSecondWithConfig(current.value.upload, appStore.byteDecimals),
    detail: formatBytesPerSecondWithConfig(current.value.download, appStore.byteDecimals),
    trend: historicalTrend('network'),
  },
])
</script>

<template>
  <div class="nexus-horizontal-scroll grid auto-cols-[minmax(178px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 lg:grid-flow-row lg:grid-cols-5 lg:overflow-visible lg:pb-0">
    <article
      v-for="card in statCards"
      :key="card.key"
      class="nexus-panel relative min-h-34 overflow-hidden p-4"
    >
      <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span class="inline-flex size-7 items-center justify-center rounded-sm" :style="{ color: card.color }">
          <Icon :icon="card.icon" class="size-4" />
        </span>
        <span>{{ card.label }}</span>
      </div>
      <div class="mt-3 min-w-0">
        <p class="truncate text-2xl font-semibold tabular-nums text-foreground">
          <span v-if="card.key === 'network'" class="text-green-600 dark:text-green-400">↑ {{ card.value }}</span>
          <template v-else>
            {{ card.value }}
          </template>
        </p>
        <p class="mt-1 truncate text-xs tabular-nums text-muted-foreground">
          <span v-if="card.key === 'network'" class="text-sky-600 dark:text-sky-400">↓ {{ card.detail }}</span>
          <template v-else>
            {{ card.detail }}
          </template>
        </p>
        <NexusSparkline :values="card.trend" :color="card.color" :label="`${card.label}真实数据趋势`" class="mt-1 h-8" />
      </div>
    </article>
  </div>
</template>
