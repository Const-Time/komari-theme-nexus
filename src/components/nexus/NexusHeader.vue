<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import NexusNetworkSwitch from '@/components/nexus/NexusNetworkSwitch.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const route = useRoute()
const now = ref(new Date())

const timer = window.setInterval(() => {
  now.value = new Date()
}, 60_000)

onBeforeUnmount(() => window.clearInterval(timer))

const greeting = computed(() => {
  const hour = now.value.getHours()
  if (hour >= 5 && hour < 11)
    return '早上好'
  if (hour >= 11 && hour < 14)
    return '中午好'
  if (hour >= 14 && hour < 18)
    return '下午好'
  return '晚上好'
})

const siteName = computed(() => appStore.publicSettings?.sitename?.trim() || 'Komari Nexus')
const clock = computed(() => now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
const themeIcon = computed(() => ({
  auto: 'lucide:sun-moon',
  light: 'lucide:sun',
  dark: 'lucide:moon',
})[appStore.themeMode])
const themeLabel = computed(() => ({
  auto: '主题：自动',
  light: '主题：浅色',
  dark: '主题：深色',
})[appStore.themeMode])
const showAdminEntry = computed(() => !appStore.loading
  && (appStore.isLoggedIn || !appStore.hideAdminEntryWhenLoggedOut))
</script>

<template>
  <header class="relative z-30 mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6 lg:px-7 lg:pt-5">
    <RouterLink to="/" class="min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="返回 Komari Nexus 首页">
      <div class="flex min-w-0 items-center gap-2.5">
        <span class="nexus-brand-mark inline-flex size-9 shrink-0 items-center justify-center rounded-md">
          <Icon icon="lucide:orbit" class="size-5" />
        </span>
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-muted-foreground sm:text-base">
            {{ greeting }}，
          </p>
          <p class="truncate text-base font-semibold leading-tight text-foreground sm:text-xl">
            {{ siteName }}
          </p>
        </div>
      </div>
    </RouterLink>

    <TooltipProvider :delay-duration="250">
      <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <span class="hidden text-right text-xs tabular-nums text-muted-foreground lg:block">
          {{ clock }}
        </span>
        <NexusNetworkSwitch />

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              class="nexus-icon-button"
              :aria-label="themeLabel"
              @click="appStore.updateThemeMode()"
            >
              <Icon :icon="themeIcon" class="size-4.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ themeLabel }}</TooltipContent>
        </Tooltip>

        <Tooltip v-if="appStore.isLoggedIn">
          <TooltipTrigger as-child>
            <Button
              as-child
              variant="outline"
              size="icon"
              class="nexus-icon-button"
              :class="{ 'border-primary/40 text-primary': route.name === 'nexus-settings' }"
            >
              <RouterLink to="/nexus-settings" aria-label="打开 Nexus 设置">
                <Icon icon="lucide:sliders-horizontal" class="size-4.5" />
              </RouterLink>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nexus 设置</TooltipContent>
        </Tooltip>

        <Tooltip v-if="showAdminEntry">
          <TooltipTrigger as-child>
            <Button
              as-child
              variant="outline"
              size="icon"
              class="nexus-icon-button"
            >
              <a href="/admin" aria-label="打开 Komari 后台">
                <Icon icon="lucide:settings" class="size-4.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Komari 后台</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  </header>
</template>
