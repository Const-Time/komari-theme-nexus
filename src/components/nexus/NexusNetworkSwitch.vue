<script setup lang="ts">
import type { NexusNetworkMode } from '@/types/nexus'
import { useRoute } from 'vue-router'
import { useVisitorAudit } from '@/composables/useVisitorAudit'
import { useNexusStore } from '@/stores/nexus'

const nexusStore = useNexusStore()
const route = useRoute()
const { record } = useVisitorAudit()

const modes: Array<{ value: NexusNetworkMode, label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'lan', label: 'LAN' },
  { value: 'wan', label: 'WAN' },
]

function selectMode(mode: NexusNetworkMode) {
  if (nexusStore.networkMode === mode)
    return
  nexusStore.networkMode = mode
  void record({
    event: 'network_mode_change',
    path: route.path,
    route: String(route.name ?? ''),
    target: mode,
  })
}

function handleKeydown(event: KeyboardEvent, index: number) {
  let nextIndex = index
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    nextIndex = (index - 1 + modes.length) % modes.length
  else if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
    nextIndex = (index + 1) % modes.length
  else if (event.key === 'Home')
    nextIndex = 0
  else if (event.key === 'End')
    nextIndex = modes.length - 1
  else
    return

  event.preventDefault()
  const radios = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  selectMode(modes[nextIndex]!.value)
  radios?.[nextIndex]?.focus()
}
</script>

<template>
  <div class="nexus-segmented" role="radiogroup" aria-label="服务访问网络模式">
    <button
      v-for="(mode, index) in modes"
      :key="mode.value"
      type="button"
      role="radio"
      class="nexus-segmented__item"
      :class="{ 'nexus-segmented__item--active': nexusStore.networkMode === mode.value }"
      :aria-checked="nexusStore.networkMode === mode.value"
      :tabindex="nexusStore.networkMode === mode.value ? 0 : -1"
      :aria-label="mode.value === 'auto' ? `自动网络模式，当前使用${nexusStore.effectiveNetworkMode === 'lan' ? '内网' : '外网'}` : `${mode.label} 网络模式`"
      :title="mode.value === 'auto' ? `自动（当前${nexusStore.effectiveNetworkMode === 'lan' ? '内网' : '外网'}）` : `${mode.label} 网络模式`"
      @click="selectMode(mode.value)"
      @keydown="handleKeydown($event, index)"
    >
      <span>{{ mode.label }}</span>
    </button>
  </div>
</template>
