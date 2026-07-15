<script setup lang="ts">
import NexusSparkline from '@/components/nexus/NexusSparkline.vue'

withDefaults(defineProps<{
  label: string
  value: string
  detail?: string
  values: number[]
  color?: string
}>(), {
  detail: '',
  color: 'var(--nexus-violet)',
})
</script>

<template>
  <div class="nexus-subpanel flex min-h-24 min-w-0 flex-col justify-between p-3">
    <div class="min-w-0">
      <p class="truncate text-xs font-medium text-muted-foreground">
        {{ label }}
      </p>
      <p class="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
        {{ value }}
      </p>
      <p v-if="detail" class="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
        {{ detail }}
      </p>
    </div>
    <NexusSparkline :values="values" :color="color" :label="`${label}真实历史趋势`" class="mt-1 h-8" />
  </div>
</template>
