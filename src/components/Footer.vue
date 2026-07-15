<script setup lang="ts">
import type { VersionInfo } from '@/utils/api'
import { computed, onMounted, ref } from 'vue'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { getSharedApi } from '@/utils/api'

const api = getSharedApi()

const buildVersion = __BUILD_VERSION__
const buildGitHash = __BUILD_GIT_HASH__

const serverVersion = ref<VersionInfo | null>(null)

onMounted(async () => {
  try {
    serverVersion.value = await api.getVersion()
  }
  catch {
    // 静默失败
  }
})

const formattedServerVersion = computed(() => serverVersion.value?.version ?? '')
</script>

<template>
  <footer class="w-full max-w-[1500px] mx-auto px-4 pb-6 pt-2 sm:px-6 lg:px-7">
    <div class="flex w-full flex-row justify-between gap-4 text-xs text-muted-foreground">
      <div class="flex gap-1 items-center">
        Powered by
        <DataTooltip
          as="span"
          placement="top"
          :content="formattedServerVersion"
        >
          <a
            href="https://github.com/komari-monitor/komari" target="_blank" rel="noopener noreferrer"
            class="transition-opacity hover:opacity-80"
          >
            <span class="font-medium text-foreground">Komari Monitor</span>
          </a>
        </DataTooltip>
      </div>
      <div class="flex flex-wrap gap-1 items-center justify-end text-right">
        Theme
        <DataTooltip
          as="span"
          placement="top"
          :content="`v${buildVersion}\n${buildGitHash}`"
        >
          <a
            href="https://github.com/Const-Time/komari-theme-nexus" target="_blank" rel="noopener noreferrer"
            class="transition-opacity hover:opacity-80"
          >
            <span class="font-medium text-foreground">Komari Nexus</span>
          </a>
        </DataTooltip>
        <span>· based on</span>
        <a
          href="https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism"
          target="_blank"
          rel="noopener noreferrer"
          class="font-medium text-foreground transition-opacity hover:opacity-80"
        >Glassmorphism</a>
      </div>
    </div>
  </footer>
</template>
