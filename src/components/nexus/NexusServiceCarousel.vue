<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { usePreferredReducedMotion, useResizeObserver } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import NexusServiceCard from '@/components/nexus/NexusServiceCard.vue'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { useNexusStore } from '@/stores/nexus'

const nexusStore = useNexusStore()
const trackRef = ref<HTMLElement>()
const canScrollBack = ref(false)
const canScrollForward = ref(false)
const reducedMotion = usePreferredReducedMotion()

const groupOptions = computed(() => [
  { id: 'all', name: '全部' },
  ...nexusStore.groups,
])

const filteredServices = computed(() => {
  if (nexusStore.selectedServiceGroup === 'all')
    return nexusStore.featuredServices
  return nexusStore.featuredServices.filter(service => service.groupId === nexusStore.selectedServiceGroup)
})

watch(groupOptions, (groups) => {
  if (!groups.some(group => group.id === nexusStore.selectedServiceGroup))
    nexusStore.selectedServiceGroup = 'all'
}, { immediate: true })

function updateScrollState() {
  const track = trackRef.value
  if (!track)
    return
  canScrollBack.value = track.scrollLeft > 2
  canScrollForward.value = track.scrollLeft + track.clientWidth < track.scrollWidth - 2
}

function scrollTrack(direction: -1 | 1) {
  const track = trackRef.value
  if (!track)
    return
  track.scrollBy({
    left: direction * track.clientWidth * 0.82,
    behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth',
  })
}

function selectGroup(groupId: string) {
  nexusStore.selectedServiceGroup = groupId
}

function handleGroupKeydown(event: KeyboardEvent, index: number) {
  let nextIndex = index
  if (event.key === 'ArrowLeft')
    nextIndex = (index - 1 + groupOptions.value.length) % groupOptions.value.length
  else if (event.key === 'ArrowRight')
    nextIndex = (index + 1) % groupOptions.value.length
  else if (event.key === 'Home')
    nextIndex = 0
  else if (event.key === 'End')
    nextIndex = groupOptions.value.length - 1
  else
    return

  event.preventDefault()
  const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  selectGroup(groupOptions.value[nextIndex]!.id)
  tabs?.[nextIndex]?.focus()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    scrollTrack(-1)
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    scrollTrack(1)
  }
}

function handleWheel(event: WheelEvent) {
  const track = trackRef.value
  if (!track || track.scrollWidth <= track.clientWidth)
    return
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX))
    return
  event.preventDefault()
  track.scrollLeft += event.deltaY
}

let pointerId: number | null = null
let pointerStartX = 0
let pointerStartScroll = 0
let pointerMoved = false
let suppressClick = false

function handlePointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0)
    return
  const track = trackRef.value
  if (!track)
    return
  pointerId = event.pointerId
  pointerStartX = event.clientX
  pointerStartScroll = track.scrollLeft
  pointerMoved = false
}

function handlePointerMove(event: PointerEvent) {
  const track = trackRef.value
  if (!track || pointerId !== event.pointerId)
    return
  const delta = event.clientX - pointerStartX
  if (!pointerMoved && Math.abs(delta) > 5) {
    pointerMoved = true
    track.setPointerCapture(event.pointerId)
  }
  if (pointerMoved)
    track.scrollLeft = pointerStartScroll - delta
}

function handlePointerUp(event: PointerEvent) {
  const track = trackRef.value
  if (!track || pointerId !== event.pointerId)
    return
  if (track.hasPointerCapture(event.pointerId))
    track.releasePointerCapture(event.pointerId)
  suppressClick = pointerMoved
  pointerId = null
  window.setTimeout(() => {
    suppressClick = false
  }, 0)
}

function handleClickCapture(event: MouseEvent) {
  if (!suppressClick)
    return
  event.preventDefault()
  event.stopPropagation()
}

useResizeObserver(trackRef, updateScrollState)

watch(filteredServices, async () => {
  await nextTick()
  if (trackRef.value)
    trackRef.value.scrollLeft = 0
  updateScrollState()
}, { immediate: true, flush: 'post' })
</script>

<template>
  <section class="px-4 py-5 sm:px-6 lg:px-7" aria-labelledby="nexus-services-title">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-4">
        <h2 id="nexus-services-title" class="shrink-0 text-xl font-semibold text-foreground">
          常用服务
        </h2>
        <div class="nexus-horizontal-scroll flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="服务分组">
          <button
            v-for="(group, index) in groupOptions"
            :key="group.id"
            type="button"
            role="tab"
            aria-controls="nexus-service-panel"
            class="h-9 shrink-0 rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="{ 'bg-primary/10 text-primary': nexusStore.selectedServiceGroup === group.id }"
            :aria-selected="nexusStore.selectedServiceGroup === group.id"
            :tabindex="nexusStore.selectedServiceGroup === group.id ? 0 : -1"
            @click="selectGroup(group.id)"
            @keydown="handleGroupKeydown($event, index)"
          >
            {{ group.name }}
          </button>
        </div>
      </div>
      <div v-if="filteredServices.length > 0" class="flex shrink-0 gap-1.5">
        <Button variant="outline" size="icon-sm" :disabled="!canScrollBack" aria-label="向左浏览服务" title="向左浏览服务" @click="scrollTrack(-1)">
          <Icon icon="lucide:chevron-left" class="size-4" />
        </Button>
        <Button variant="outline" size="icon-sm" :disabled="!canScrollForward" aria-label="向右浏览服务" title="向右浏览服务" @click="scrollTrack(1)">
          <Icon icon="lucide:chevron-right" class="size-4" />
        </Button>
      </div>
    </div>

    <Empty v-if="filteredServices.length === 0" description="暂无常用服务" class="min-h-32 rounded-md border border-dashed border-border/70" />
    <div
      v-else
      id="nexus-service-panel"
      ref="trackRef"
      class="nexus-service-track nexus-horizontal-scroll grid cursor-grab snap-x snap-mandatory grid-flow-col gap-3 overflow-x-auto pb-2 active:cursor-grabbing"
      tabindex="0"
      role="tabpanel"
      aria-label="常用服务轮播"
      @scroll.passive="updateScrollState"
      @wheel="handleWheel"
      @keydown="handleKeydown"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @dragstart.prevent
      @click.capture="handleClickCapture"
    >
      <NexusServiceCard
        v-for="service in filteredServices"
        :key="service.id"
        :service="service"
        class="snap-start"
      />
    </div>
  </section>
</template>
