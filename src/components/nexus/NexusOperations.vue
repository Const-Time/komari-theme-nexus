<script setup lang="ts">
import type { PermissionKey } from '@/services/auth.service'
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { useVisitorAudit } from '@/composables/useVisitorAudit'
import { useAppStore } from '@/stores/app'

defineProps<{
  nodes: NodeData[]
}>()

type ToolKey = 'topology' | 'providerValue' | 'healthSummary' | 'snapshotExport' | 'auditLog'

interface ToolDefinition {
  key: ToolKey
  label: string
  icon: string
  permission: PermissionKey
}

const AuditLogPanel = defineAsyncComponent(() => import('@/components/AuditLogPanel.vue'))
const HealthSummaryPanel = defineAsyncComponent(() => import('@/components/HealthSummaryPanel.vue'))
const NodeTopologyPanel = defineAsyncComponent(() => import('@/components/NodeTopologyPanel.vue'))
const ProviderValuePanel = defineAsyncComponent(() => import('@/components/ProviderValuePanel.vue'))
const SnapshotExportPanel = defineAsyncComponent(() => import('@/components/SnapshotExportPanel.vue'))

const appStore = useAppStore()
const { record } = useVisitorAudit()
const activeTool = ref<ToolKey | null>(null)

const definitions: ToolDefinition[] = [
  { key: 'topology', label: '拓扑', icon: 'tabler:route', permission: 'nodeTopology' },
  { key: 'providerValue', label: '性价比', icon: 'tabler:scale', permission: 'providerValue' },
  { key: 'healthSummary', label: '健康', icon: 'tabler:heartbeat', permission: 'healthSummary' },
  { key: 'snapshotExport', label: '快照', icon: 'tabler:download', permission: 'snapshotExport' },
  { key: 'auditLog', label: '审计', icon: 'tabler:list-details', permission: 'auditLog' },
]

const tools = computed(() => appStore.homeToolsEnabled && appStore.privateFeaturesAllowed
  ? definitions
  : [])

async function selectTool(tool: ToolDefinition) {
  if (activeTool.value === tool.key) {
    activeTool.value = null
    return
  }

  const granted = await appStore.requireLoginPermission(tool.permission, { force: true })
  if (!granted) {
    activeTool.value = null
    window.$message.warning('登录状态已过期，请重新登录后使用高级工具')
    return
  }

  activeTool.value = tool.key
  void record({
    event: 'home_tool_open',
    path: '/',
    route: 'home',
    target: tool.key,
  })
}

watch(tools, (available) => {
  if (activeTool.value && !available.some(tool => tool.key === activeTool.value))
    activeTool.value = null
})
</script>

<template>
  <section v-if="tools.length" class="px-4 pb-8 pt-4 sm:px-6 lg:px-7" aria-labelledby="nexus-operations-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="nexus-operations-title" class="text-xl font-semibold text-foreground">
        高级工具
      </h2>
      <div class="flex max-w-full flex-wrap items-center justify-end gap-1.5">
        <Button
          v-for="tool in tools"
          :key="tool.key"
          variant="outline"
          size="sm"
          :aria-pressed="activeTool === tool.key"
          :class="{ 'border-primary/40 bg-primary/10 text-primary': activeTool === tool.key }"
          @click="selectTool(tool)"
        >
          <Icon :icon="tool.icon" class="size-4" />
          {{ tool.label }}
        </Button>
      </div>
    </div>

    <div v-if="activeTool" class="mt-4 min-w-0">
      <NodeTopologyPanel v-if="activeTool === 'topology'" :nodes="nodes" />
      <ProviderValuePanel v-else-if="activeTool === 'providerValue'" :nodes="nodes" />
      <HealthSummaryPanel v-else-if="activeTool === 'healthSummary'" :nodes="nodes" />
      <SnapshotExportPanel v-else-if="activeTool === 'snapshotExport'" :nodes="nodes" />
      <AuditLogPanel v-else-if="activeTool === 'auditLog'" />
    </div>
  </section>
</template>
