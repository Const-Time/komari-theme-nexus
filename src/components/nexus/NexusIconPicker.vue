<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { useIconifySearch } from '@/composables/useIconifySearch'
import { ICONIFY_COLLECTION_OPTIONS, ICONIFY_POPULAR_SERVICE_ICONS, ICONIFY_SEARCH_CONFIG } from '@/constants/iconify'
import { useAppStore } from '@/stores/app'
import NexusIconPreview from './NexusIconPreview.vue'
import NexusServiceIcon from './NexusServiceIcon.vue'

const props = defineProps<{
  open: boolean
  serviceName: string
  currentIcon: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'select': [icon: string]
}>()

const appStore = useAppStore()
const resultGrid = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const {
  query,
  prefix,
  icons,
  collections,
  loading,
  loadingMore,
  error,
  hasMore,
  normalizedQuery,
  canSearch,
  searchNow,
  loadMore,
  resetSearch,
} = useIconifySearch()

const showingPopular = computed(() => normalizedQuery.value.length === 0)
const displayedIcons = computed<readonly string[]>(() => showingPopular.value
  ? ICONIFY_POPULAR_SERVICE_ICONS.filter(icon => !prefix.value || icon.startsWith(`${prefix.value}:`))
  : icons.value)

watch(() => props.open, (open) => {
  if (!open)
    resetSearch()
})

function handleOpenChange(open: boolean) {
  emit('update:open', open)
}

function handleOpenAutoFocus(event: Event) {
  event.preventDefault()
  void nextTick(() => searchInput.value?.focus())
}

function selectIcon(icon: string) {
  emit('select', icon)
  emit('update:open', false)
}

function retrySearch() {
  if (icons.value.length > 0)
    void loadMore()
  else
    void searchNow()
}

function iconPrefix(icon: string): string {
  return icon.slice(0, icon.indexOf(':'))
}

function iconShortName(icon: string): string {
  return icon.slice(icon.indexOf(':') + 1)
}

function collectionName(icon: string): string {
  const iconSet = iconPrefix(icon)
  const knownOption = ICONIFY_COLLECTION_OPTIONS.find(option => option.value === iconSet)
  return collections.value[iconSet]?.name || knownOption?.label || iconSet
}

function handleGridKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home'].includes(event.key))
    return
  if (!(event.target instanceof HTMLButtonElement) || !resultGrid.value)
    return

  const buttons = [...resultGrid.value.querySelectorAll<HTMLButtonElement>('[data-icon-option]')]
  const currentIndex = buttons.indexOf(event.target)
  if (currentIndex < 0)
    return

  let target: HTMLButtonElement | undefined
  if (event.key === 'Home') {
    target = buttons[0]
  }
  else if (event.key === 'End') {
    target = buttons.at(-1)
  }
  else if (event.key === 'ArrowLeft') {
    target = buttons[Math.max(0, currentIndex - 1)]
  }
  else if (event.key === 'ArrowRight') {
    target = buttons[Math.min(buttons.length - 1, currentIndex + 1)]
  }
  else {
    const currentRect = event.target.getBoundingClientRect()
    const direction = event.key === 'ArrowUp' ? -1 : 1
    target = buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect()
        return direction < 0 ? rect.top < currentRect.top : rect.top > currentRect.top
      })
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect()
        const rightRect = right.getBoundingClientRect()
        const leftDistance = Math.abs(leftRect.top - currentRect.top) * 1000 + Math.abs(leftRect.left - currentRect.left)
        const rightDistance = Math.abs(rightRect.top - currentRect.top) * 1000 + Math.abs(rightRect.left - currentRect.left)
        return leftDistance - rightDistance
      })[0]
  }

  if (target) {
    event.preventDefault()
    target.focus()
  }
}
</script>

<template>
  <DialogRoot :open="open" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-[10000] bg-black/55 backdrop-blur-[2px] motion-reduce:animate-none"
        :class="appStore.disablePageAnimation ? '' : 'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'"
      />
      <DialogContent
        class="nexus-panel fixed left-1/2 top-1/2 z-[10001] flex h-[720px] max-h-[84vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md p-4 shadow-2xl motion-reduce:animate-none sm:p-5"
        :class="appStore.disablePageAnimation ? '' : 'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'"
        @open-auto-focus="handleOpenAutoFocus"
      >
        <div class="flex min-w-0 items-center gap-3 border-b border-border/70 pb-4">
          <NexusServiceIcon :icon="currentIcon" :name="serviceName" size="sm" />
          <div class="min-w-0 flex-1">
            <DialogTitle class="truncate text-base font-semibold text-foreground">
              在线图标库
            </DialogTitle>
            <DialogDescription class="truncate text-xs text-muted-foreground">
              {{ serviceName || '未命名服务' }} · Iconify
            </DialogDescription>
          </div>
          <Button as-child variant="ghost" size="icon-sm">
            <a
              href="https://icon-sets.iconify.design/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="打开 Iconify 图标网站"
              title="打开 Iconify 图标网站"
            >
              <Icon icon="lucide:external-link" class="size-4" />
            </a>
          </Button>
          <DialogClose as-child>
            <Button variant="ghost" size="icon-sm" aria-label="关闭图标库" title="关闭图标库">
              <Icon icon="lucide:x" class="size-4" />
            </Button>
          </DialogClose>
        </div>

        <div class="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div class="relative min-w-0">
            <Icon icon="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref="searchInput"
              v-model="query"
              type="search"
              class="nexus-input h-11 w-full pl-9 pr-10 text-sm text-foreground"
              placeholder="搜索 home、server、jellyfin"
              aria-label="搜索 Iconify 图标"
              :maxlength="ICONIFY_SEARCH_CONFIG.maxQueryLength"
              @keydown.enter.prevent="searchNow"
            >
            <Button
              v-if="query"
              type="button"
              variant="ghost"
              size="icon-sm"
              class="absolute right-1.5 top-1/2 -translate-y-1/2"
              aria-label="清空搜索"
              title="清空搜索"
              @click="query = ''"
            >
              <Icon icon="lucide:x" class="size-3.5" />
            </Button>
          </div>
          <select v-model="prefix" class="nexus-input h-11 min-w-0 text-sm text-foreground" aria-label="筛选图标集">
            <option v-for="option in ICONIFY_COLLECTION_OPTIONS" :key="option.value || 'all'" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="flex min-h-0 flex-1 flex-col">
          <div class="mb-2 flex min-h-6 items-center justify-between gap-3 text-xs text-muted-foreground" aria-live="polite">
            <span v-if="showingPopular">常用图标</span>
            <span v-else-if="loading">搜索中</span>
            <span v-else-if="canSearch">{{ icons.length }} 个结果</span>
            <span v-else>搜索图标</span>
            <Icon v-if="loading || loadingMore" icon="lucide:loader-circle" class="size-4 animate-spin motion-reduce:animate-none" />
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto pr-1">
            <div v-if="loading && icons.length === 0" class="flex min-h-48 items-center justify-center text-sm text-muted-foreground" role="status">
              <Icon icon="lucide:loader-circle" class="mr-2 size-4 animate-spin motion-reduce:animate-none" />
              正在搜索
            </div>

            <div
              v-else-if="displayedIcons.length > 0"
              ref="resultGrid"
              class="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
              aria-label="图标结果"
              @keydown="handleGridKeydown"
            >
              <button
                v-for="iconName in displayedIcons"
                :key="iconName"
                data-icon-option
                type="button"
                class="relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-md border border-border/70 bg-background/35 p-2 text-foreground transition-colors hover:border-primary/60 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="currentIcon === iconName && 'border-primary bg-primary/10 ring-1 ring-primary/50'"
                :aria-label="`选择 ${iconName}`"
                :aria-pressed="currentIcon === iconName"
                :title="`${collectionName(iconName)} · ${iconName}`"
                @click="selectIcon(iconName)"
              >
                <NexusIconPreview :icon="iconName" />
                <span class="w-full truncate text-center text-[11px] text-muted-foreground">
                  {{ iconShortName(iconName) }}
                </span>
                <Icon v-if="currentIcon === iconName" icon="lucide:check" class="absolute right-1.5 top-1.5 size-3.5 text-primary" />
              </button>
            </div>

            <div v-else-if="error" class="flex min-h-48 flex-col items-center justify-center gap-3 text-center" role="alert">
              <Icon icon="lucide:cloud-off" class="size-8 text-muted-foreground" />
              <p class="max-w-sm text-sm text-muted-foreground">
                {{ error }}
              </p>
              <Button type="button" variant="outline" size="sm" @click="searchNow">
                <Icon icon="lucide:refresh-cw" class="size-4" />
                重试
              </Button>
            </div>

            <Empty
              v-else-if="normalizedQuery.length > 0 && !canSearch"
              description="搜索词至少需要 2 个字符"
              class="min-h-48"
            />
            <Empty v-else description="未找到匹配图标" class="min-h-48" />

            <div v-if="displayedIcons.length > 0 && error" class="mt-3 flex items-center justify-center gap-2 text-xs text-destructive" role="alert">
              <span>{{ error }}</span>
              <Button type="button" variant="ghost" size="sm" @click="retrySearch">
                重试
              </Button>
            </div>
          </div>

          <div v-if="!showingPopular && hasMore" class="flex justify-center border-t border-border/70 pt-3">
            <Button type="button" variant="outline" size="sm" :disabled="loadingMore" @click="loadMore">
              <Icon :icon="loadingMore ? 'lucide:loader-circle' : 'lucide:plus'" class="size-4" :class="loadingMore && 'animate-spin motion-reduce:animate-none'" />
              加载更多
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
