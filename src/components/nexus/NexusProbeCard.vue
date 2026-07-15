<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import type { StatusRecord } from '@/utils/rpc'
import { Icon } from '@iconify/vue'
import { computed, onActivated, onDeactivated, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import NexusNodeServices from '@/components/nexus/NexusNodeServices.vue'
import NexusProbeMetric from '@/components/nexus/NexusProbeMetric.vue'
import NexusSparkline from '@/components/nexus/NexusSparkline.vue'
import { useNodePingStats } from '@/composables/useNodePingStats'
import { useAppStore } from '@/stores/app'
import { useNexusHistoryStore } from '@/stores/nexusHistory'
import { CURRENCY_SYMBOLS, normalizeCurrency } from '@/utils/financeHelper'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, getUptimeDays } from '@/utils/helper'
import {
  getDiskPercentage,
  getMemoryPercentage,
  getTrafficUsed,
  getTrafficUsedPercentage,
} from '@/utils/nodeMetricsHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'

const props = defineProps<{
  node: NodeData
}>()

const appStore = useAppStore()
const historyStore = useNexusHistoryStore()
const router = useRouter()
const active = ref(true)
const history = computed(() => historyStore.get(props.node.uuid))
const pingStats = useNodePingStats(() => props.node.uuid, {
  hours: 6,
  maxCount: 96,
  enabled: active,
})

watch(
  [() => props.node.uuid, active, () => props.node.time],
  ([uuid, isActive]) => {
    if (isActive)
      void historyStore.ensure(uuid)
  },
  { immediate: true },
)

onActivated(() => {
  active.value = true
})

onDeactivated(() => {
  active.value = false
})

function loadSeries(key: keyof Pick<StatusRecord, 'cpu' | 'ram' | 'disk' | 'net_in' | 'net_out'>): number[] {
  return (history.value?.loadRecords || [])
    .map(record => Number(record[key]))
    .filter(Number.isFinite)
    .slice(-32)
}

function percentageSeries(
  usedKey: 'ram' | 'disk',
  totalKey: 'ram_total' | 'disk_total',
): number[] {
  return (history.value?.loadRecords || [])
    .map((record) => {
      const used = Number(record[usedKey])
      const total = Number(record[totalKey])
      return total > 0 ? Math.min(Math.max(used / total * 100, 0), 100) : 0
    })
    .filter(Number.isFinite)
    .slice(-32)
}

const latencySeries = computed(() => pingStats.history.value
  .map(point => point.latency)
  .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  .slice(-32))
const lossSeries = computed(() => pingStats.history.value
  .map(point => point.loss)
  .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  .slice(-32))
const latency = computed(() => latencySeries.value.at(-1) ?? pingStats.avgLatency.value)
const packetLoss = computed(() => pingStats.avgLoss.value)

const memoryPercentage = computed(() => getMemoryPercentage(props.node))
const diskPercentage = computed(() => getDiskPercentage(props.node))
const trafficPercentage = computed(() => getTrafficUsedPercentage(props.node))
const trafficUsed = computed(() => getTrafficUsed(props.node))
const uptime = computed(() => {
  const days = getUptimeDays(props.node.uptime)
  if (!props.node.online)
    return '离线'
  return days > 0 ? `${days} 天` : '< 1 天'
})
const monthlyPrice = computed(() => {
  if (appStore.hidePriceWhenLoggedOut && !appStore.isLoggedIn)
    return '已隐藏'
  const price = Number(props.node.price)
  if (!Number.isFinite(price) || price <= 0)
    return '未设置'
  const cycle = Number(props.node.billing_cycle)
  const monthly = Number.isFinite(cycle) && cycle > 0 ? price / cycle * 30 : price
  const symbol = CURRENCY_SYMBOLS[normalizeCurrency(props.node.currency)]
  return `${symbol}${monthly >= 10 ? monthly.toFixed(0) : monthly.toFixed(1)} / 月`
})
const regionCode = computed(() => getRegionCode(props.node.region) || 'UN')
const regionName = computed(() => getRegionDisplayName(props.node.region) || '未知地区')
const trafficCircumference = 113.1
const trafficDash = computed(() => `${trafficPercentage.value / 100 * trafficCircumference} ${trafficCircumference}`)

function openDetail() {
  router.push({ name: 'instance-detail', params: { id: props.node.uuid } })
}
</script>

<template>
  <article class="nexus-panel min-w-0 overflow-hidden p-3.5 sm:p-4">
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :aria-label="`查看 ${node.name} 节点详情`"
      @click="openDetail"
    >
      <img
        :src="`/images/flags/${regionCode}.svg`"
        :alt="regionName"
        class="size-10 shrink-0 rounded-sm border border-border/60 object-cover shadow-sm"
      >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-base font-semibold text-foreground">{{ node.name }}</span>
        <span class="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span :class="node.online ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            {{ node.online ? '在线' : '离线' }}
          </span>
          <span aria-hidden="true">·</span>
          <span class="tabular-nums">{{ uptime }}</span>
          <span aria-hidden="true">·</span>
          <span class="truncate tabular-nums">{{ monthlyPrice }}</span>
        </span>
      </span>
      <span class="flex shrink-0 items-center gap-2 text-xs font-medium" :class="node.online ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
        <span class="size-2 rounded-full bg-current" />
        <span class="hidden sm:inline">{{ node.online ? '在线' : '离线' }}</span>
        <Icon icon="lucide:chevron-right" class="size-4 text-muted-foreground" />
      </span>
    </button>

    <div class="mt-3 grid grid-cols-3 gap-2">
      <NexusProbeMetric
        label="CPU"
        :value="`${(node.cpu || 0).toFixed(0)}%`"
        :values="loadSeries('cpu')"
        color="var(--nexus-violet)"
      />
      <NexusProbeMetric
        label="内存"
        :value="`${memoryPercentage.toFixed(0)}%`"
        :detail="`${formatBytesWithConfig(node.ram || 0, appStore.byteDecimals)} / ${formatBytesWithConfig(node.mem_total || 0, appStore.byteDecimals)}`"
        :values="percentageSeries('ram', 'ram_total')"
        color="var(--nexus-cyan)"
      />
      <NexusProbeMetric
        label="存储"
        :value="`${diskPercentage.toFixed(0)}%`"
        :detail="`${formatBytesWithConfig(node.disk || 0, appStore.byteDecimals)} / ${formatBytesWithConfig(node.disk_total || 0, appStore.byteDecimals)}`"
        :values="percentageSeries('disk', 'disk_total')"
        color="var(--nexus-green)"
      />
      <NexusProbeMetric
        label="延迟"
        :value="`${latency.toFixed(0)} ms`"
        :values="latencySeries"
        color="var(--nexus-blue)"
      />
      <NexusProbeMetric
        label="丢包率"
        :value="`${packetLoss.toFixed(1)}%`"
        :values="lossSeries"
        color="var(--nexus-violet)"
      />
      <div class="nexus-subpanel flex min-h-24 min-w-0 flex-col items-center justify-center p-2 text-center">
        <div class="relative size-13">
          <svg class="size-13 -rotate-90" viewBox="0 0 44 44" aria-label="流量使用比例">
            <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-width="3" class="text-border" />
            <circle
              cx="22" cy="22" r="18" fill="none" stroke="var(--nexus-green)" stroke-width="3" stroke-linecap="round"
              :stroke-dasharray="trafficDash"
            />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-foreground">
            {{ trafficPercentage.toFixed(0) }}%
          </span>
        </div>
        <span class="mt-1 text-[11px] text-muted-foreground">流量使用</span>
        <span class="max-w-full truncate text-[10px] tabular-nums text-muted-foreground">
          {{ formatBytesWithConfig(trafficUsed, appStore.byteDecimals) }} / {{ node.traffic_limit > 0 ? formatBytesWithConfig(node.traffic_limit, appStore.byteDecimals) : '不限' }}
        </span>
      </div>

      <div class="nexus-subpanel col-span-3 grid min-h-25 grid-cols-2 gap-2 p-3">
        <div class="min-w-0 border-r border-border/60 pr-2">
          <p class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon icon="lucide:arrow-up" class="size-3.5 text-green-600 dark:text-green-400" />
            上传
          </p>
          <p class="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">
            {{ formatBytesPerSecondWithConfig(node.net_out || 0, appStore.byteDecimals) }}
          </p>
          <NexusSparkline :values="loadSeries('net_out')" color="var(--nexus-green)" label="上传速度真实历史趋势" class="h-8" />
        </div>
        <div class="min-w-0 pl-1">
          <p class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon icon="lucide:arrow-down" class="size-3.5 text-sky-600 dark:text-sky-400" />
            下载
          </p>
          <p class="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">
            {{ formatBytesPerSecondWithConfig(node.net_in || 0, appStore.byteDecimals) }}
          </p>
          <NexusSparkline :values="loadSeries('net_in')" color="var(--nexus-blue)" label="下载速度真实历史趋势" class="h-8" />
        </div>
      </div>
    </div>

    <NexusNodeServices :node-uuid="node.uuid" :node-name="node.name" />
  </article>
</template>
