<script setup lang="ts">
import type { NexusNetworkMode } from '@/types/nexus'
import { computed } from 'vue'
import { useNexusStore } from '@/stores/nexus'

const nexusStore = useNexusStore()

type ManualNetworkMode = Exclude<NexusNetworkMode, 'auto'>

const modes: Array<{ value: ManualNetworkMode, label: string }> = [
  { value: 'lan', label: '内网' },
  { value: 'wan', label: '外网' },
]

const selectedMode = computed<ManualNetworkMode>(() =>
  nexusStore.networkMode === 'auto' ? nexusStore.effectiveNetworkMode : nexusStore.networkMode,
)
</script>

<template>
  <div class="nexus-segmented" role="radiogroup" aria-label="服务访问网络模式">
    <button
      v-for="mode in modes"
      :key="mode.value"
      type="button"
      role="radio"
      class="nexus-segmented__item"
      :class="{ 'nexus-segmented__item--active': selectedMode === mode.value }"
      :aria-checked="selectedMode === mode.value"
      :aria-label="`${mode.label}网络模式`"
      :title="`${mode.label}网络模式`"
      @click="nexusStore.networkMode = mode.value"
    >
      <span>{{ mode.label }}</span>
    </button>
  </div>
</template>
