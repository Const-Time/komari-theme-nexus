<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  values: number[]
  color?: string
  label?: string
}>(), {
  color: 'var(--nexus-accent)',
  label: '趋势图',
})

const gradientId = `nexus-spark-${useId().replaceAll(':', '')}`

const chartValues = computed(() => {
  const values = props.values.filter(Number.isFinite)
  if (values.length === 0)
    return [0, 0]
  if (values.length === 1)
    return [values[0] ?? 0, values[0] ?? 0]
  return values
})

const points = computed(() => {
  const values = chartValues.value
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values.map((value, index) => {
    const x = index / (values.length - 1) * 100
    const y = 31 - (value - min) / range * 25
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
})

const areaPoints = computed(() => `0,36 ${points.value} 100,36`)
</script>

<template>
  <svg
    class="block h-10 w-full overflow-visible"
    viewBox="0 0 100 36"
    preserveAspectRatio="none"
    role="img"
    :aria-label="label"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="color" stop-opacity="0.2" />
        <stop offset="1" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <line x1="0" y1="31.5" x2="100" y2="31.5" stroke="currentColor" stroke-opacity="0.08" vector-effect="non-scaling-stroke" />
    <polygon :points="areaPoints" :fill="`url(#${gradientId})`" />
    <polyline
      :points="points"
      fill="none"
      :stroke="color"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
