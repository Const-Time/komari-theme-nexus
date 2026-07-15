<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { useDocumentVisibility, useMediaQuery, usePreferredReducedMotion } from '@vueuse/core'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import NexusProbeCard from '@/components/nexus/NexusProbeCard.vue'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { useAppStore } from '@/stores/app'
import { useNexusStore } from '@/stores/nexus'

const props = defineProps<{
  nodes: NodeData[]
}>()

const nexusStore = useNexusStore()
const appStore = useAppStore()
const isMobile = useMediaQuery('(max-width: 767px)')
const reducedMotion = usePreferredReducedMotion()
const documentVisibility = useDocumentVisibility()
const hovered = ref(false)
const active = ref(true)
const pageSize = computed(() => isMobile.value ? 2 : 3)
const pageCount = computed(() => Math.max(1, Math.ceil(props.nodes.length / pageSize.value)))
const currentPage = computed(() => Math.min(Math.max(nexusStore.probePage, 0), pageCount.value - 1))
const visibleNodes = computed(() => {
  const start = currentPage.value * pageSize.value
  return props.nodes.slice(start, start + pageSize.value)
})

watch(pageCount, (count) => {
  if (nexusStore.probePage >= count)
    nexusStore.probePage = Math.max(0, count - 1)
}, { immediate: true })

let autoTimer: ReturnType<typeof setTimeout> | null = null
let userPausedUntil = 0

function clearAutoTimer() {
  if (autoTimer) {
    window.clearTimeout(autoTimer)
    autoTimer = null
  }
}

function shouldAutoplay(): boolean {
  return nexusStore.probeAutoplay
    && active.value
    && pageCount.value > 1
    && !hovered.value
    && documentVisibility.value === 'visible'
    && reducedMotion.value !== 'reduce'
}

function scheduleAutoplay() {
  clearAutoTimer()
  if (!shouldAutoplay())
    return

  const remainingPause = Math.max(0, userPausedUntil - Date.now())
  const delay = remainingPause || nexusStore.probeInterval * 1000
  autoTimer = window.setTimeout(() => {
    if (remainingPause > 0) {
      scheduleAutoplay()
      return
    }
    setPage((currentPage.value + 1) % pageCount.value, false)
    scheduleAutoplay()
  }, delay)
}

function setPage(page: number, userInitiated = true) {
  nexusStore.probePage = Math.min(Math.max(page, 0), pageCount.value - 1)
  if (userInitiated)
    userPausedUntil = Date.now() + 12_000
  scheduleAutoplay()
}

function toggleAutoplay() {
  nexusStore.probeAutoplay = !nexusStore.probeAutoplay
  userPausedUntil = 0
  scheduleAutoplay()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    setPage((currentPage.value - 1 + pageCount.value) % pageCount.value)
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    setPage((currentPage.value + 1) % pageCount.value)
  }
}

watch(
  [() => nexusStore.probeAutoplay, () => nexusStore.probeInterval, pageCount, hovered, active, documentVisibility, reducedMotion],
  scheduleAutoplay,
  { immediate: true },
)

onActivated(() => {
  active.value = true
  scheduleAutoplay()
})

onDeactivated(() => {
  active.value = false
  clearAutoTimer()
})

onBeforeUnmount(clearAutoTimer)
</script>

<template>
  <section
    class="px-4 pb-8 pt-4 sm:px-6 lg:px-7"
    aria-labelledby="nexus-probes-title"
    tabindex="0"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="hovered = true"
    @focusout="hovered = false"
    @keydown="handleKeydown"
  >
    <div class="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h2 id="nexus-probes-title" class="text-xl font-semibold text-foreground">
        探针面板
      </h2>
      <div class="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          role="switch"
          class="flex h-9 shrink-0 items-center gap-2 rounded-sm px-2 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :aria-checked="nexusStore.probeAutoplay"
          aria-label="切换探针自动轮播"
          @click="toggleAutoplay"
        >
          <span>自动轮播</span>
          <span class="relative h-5 w-9 shrink-0 overflow-hidden rounded-full transition-colors" :class="nexusStore.probeAutoplay ? 'bg-[var(--nexus-blue)]' : 'bg-muted-foreground/30'">
            <span class="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform" :class="nexusStore.probeAutoplay ? 'translate-x-4' : 'translate-x-0'" />
          </span>
        </button>
        <div v-if="pageCount > 1" class="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="上一页探针" title="上一页探针" @click="setPage((currentPage - 1 + pageCount) % pageCount)">
            <Icon icon="lucide:chevron-left" class="size-4" />
          </Button>
          <span class="min-w-12 text-center text-xs tabular-nums text-muted-foreground">{{ currentPage + 1 }} / {{ pageCount }}</span>
          <Button variant="outline" size="icon-sm" aria-label="下一页探针" title="下一页探针" @click="setPage((currentPage + 1) % pageCount)">
            <Icon icon="lucide:chevron-right" class="size-4" />
          </Button>
        </div>
      </div>
    </div>

    <Empty v-if="nodes.length === 0" description="暂无探针节点" class="min-h-48 rounded-md border border-dashed border-border/70" />
    <Transition v-else name="nexus-page" mode="out-in" :css="!appStore.disablePageAnimation && reducedMotion !== 'reduce'">
      <div :key="`${pageSize}-${currentPage}`" class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <NexusProbeCard v-for="node in visibleNodes" :key="node.uuid" :node="node" />
      </div>
    </Transition>
  </section>
</template>
