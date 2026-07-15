<script setup lang="ts">
import type { NexusConfig, NexusService, NexusSettingsSnapshot } from '@/types/nexus'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import NexusIconPicker from '@/components/nexus/NexusIconPicker.vue'
import NexusServiceIcon from '@/components/nexus/NexusServiceIcon.vue'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { useAppStore } from '@/stores/app'
import { useNexusStore } from '@/stores/nexus'
import { useNodesStore } from '@/stores/nodes'
import {
  createNexusId,
  NEXUS_MAX_GROUPS,
  NEXUS_MAX_SERVICES,
  parseHostPatterns,
  parseNexusConfig,
  validateHostPatterns,
} from '@/utils/nexusConfig'
import { compressServiceIcon, discoverServiceIcon } from '@/utils/nexusIcon'

const appStore = useAppStore()
const nexusStore = useNexusStore()
const nodesStore = useNodesStore()
const saving = ref(false)
const accessGranted = ref(false)
const iconTask = ref<{ action: 'discover' | 'online' | 'upload', serviceId: string } | null>(null)
const iconPickerOpen = ref(false)
const iconPickerServiceId = ref('')
const initialSnapshot = ref('')
const draftConfig = ref<NexusConfig>(parseNexusConfig(nexusStore.config))
const lanPatternsText = ref(nexusStore.lanHostPatterns.join('\n'))
const wanPatternsText = ref(nexusStore.wanHostPatterns.join('\n'))
const probeAutoplay = ref(nexusStore.probeAutoplay)
const probeInterval = ref(nexusStore.probeInterval)

onMounted(async () => {
  accessGranted.value = await appStore.requireLoginPermission('nexusSettings', { force: true })
  if (!accessGranted.value)
    window.location.replace('/admin')
})

function snapshotString(): string {
  return JSON.stringify({
    config: draftConfig.value,
    lan: parseHostPatterns(lanPatternsText.value),
    wan: parseHostPatterns(wanPatternsText.value),
    probeAutoplay: probeAutoplay.value,
    probeInterval: Number(probeInterval.value),
  })
}

function resetDraft() {
  draftConfig.value = parseNexusConfig(nexusStore.config)
  lanPatternsText.value = nexusStore.lanHostPatterns.join('\n')
  wanPatternsText.value = nexusStore.wanHostPatterns.join('\n')
  probeAutoplay.value = nexusStore.probeAutoplay
  probeInterval.value = nexusStore.probeInterval
  initialSnapshot.value = snapshotString()
}

const dirty = computed(() => snapshotString() !== initialSnapshot.value)
const sortedGroups = computed(() => [...draftConfig.value.groups].sort((a, b) => a.order - b.order))
const sortedServices = computed(() => [...draftConfig.value.services].sort((a, b) => a.order - b.order))
const iconPickerService = computed(() => draftConfig.value.services.find(service => service.id === iconPickerServiceId.value) ?? null)

watch(() => nexusStore.config, () => {
  if (!dirty.value)
    resetDraft()
}, { deep: true })

resetDraft()

function normalizeOrder<T extends { order: number }>(items: T[]) {
  items.forEach((item, index) => {
    item.order = index
  })
}

function addGroup() {
  if (draftConfig.value.groups.length >= NEXUS_MAX_GROUPS) {
    window.$message.warning(`服务分组不能超过 ${NEXUS_MAX_GROUPS} 个`)
    return
  }
  draftConfig.value.groups.push({
    id: createNexusId('group'),
    name: '新分组',
    order: draftConfig.value.groups.length,
    enabled: true,
  })
}

function removeGroup(id: string) {
  draftConfig.value.groups = draftConfig.value.groups.filter(group => group.id !== id)
  draftConfig.value.services.forEach((service) => {
    if (service.groupId === id)
      service.groupId = ''
  })
  normalizeOrder(draftConfig.value.groups)
}

function moveGroup(id: string, direction: -1 | 1) {
  const items = sortedGroups.value
  const index = items.findIndex(group => group.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= items.length)
    return
  const currentItem = items[index]!
  items[index] = items[target]!
  items[target] = currentItem
  normalizeOrder(items)
  draftConfig.value.groups = items
}

function addService() {
  if (draftConfig.value.services.length >= NEXUS_MAX_SERVICES) {
    window.$message.warning(`服务不能超过 ${NEXUS_MAX_SERVICES} 个`)
    return
  }
  draftConfig.value.services.push({
    id: createNexusId('service'),
    name: '新服务',
    description: '',
    icon: 'lucide:app-window',
    groupId: sortedGroups.value[0]?.id || '',
    nodeUuid: '',
    lanUrl: '',
    wanUrl: '',
    featured: true,
    enabled: true,
    order: draftConfig.value.services.length,
  })
}

function removeService(id: string) {
  draftConfig.value.services = draftConfig.value.services.filter(service => service.id !== id)
  normalizeOrder(draftConfig.value.services)
}

function moveService(id: string, direction: -1 | 1) {
  const items = sortedServices.value
  const index = items.findIndex(service => service.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= items.length)
    return
  const currentItem = items[index]!
  items[index] = items[target]!
  items[target] = currentItem
  normalizeOrder(items)
  draftConfig.value.services = items
}

function updateService(id: string, key: keyof NexusService, value: string | boolean) {
  const service = draftConfig.value.services.find(item => item.id === id)
  if (!service)
    return
  const writableService = service as unknown as Record<string, string | boolean | number>
  writableService[key] = value
}

function isIconBusy(): boolean {
  return iconTask.value !== null
}

function markServiceIconSaved(serviceId: string, icon: string) {
  try {
    const snapshot = JSON.parse(initialSnapshot.value) as { config?: NexusConfig }
    const service = snapshot.config?.services.find(item => item.id === serviceId)
    if (!service)
      return
    service.icon = icon
    initialSnapshot.value = JSON.stringify(snapshot)
  }
  catch {
    // The next full save will rebuild the snapshot if its local baseline is unavailable.
  }
}

async function persistServiceIcon(service: NexusService, icon: string): Promise<boolean> {
  const previousIcon = service.icon
  updateService(service.id, 'icon', icon)
  try {
    const persisted = await nexusStore.saveServiceIcon(service.id, icon)
    if (persisted)
      markServiceIconSaved(service.id, icon)
    return persisted
  }
  catch (error) {
    const currentService = draftConfig.value.services.find(item => item.id === service.id)
    if (currentService?.icon === icon)
      updateService(service.id, 'icon', previousIcon)
    throw error
  }
}

function iconUploadInputId(serviceId: string): string {
  return `nexus-icon-upload-${serviceId}`
}

function openIconUpload(serviceId: string) {
  const input = document.getElementById(iconUploadInputId(serviceId))
  if (!(input instanceof HTMLInputElement))
    return
  input.value = ''
  input.click()
}

function openIconPicker(serviceId: string) {
  if (isIconBusy())
    return
  iconPickerServiceId.value = serviceId
  iconPickerOpen.value = true
}

async function selectOnlineIcon(icon: string) {
  const service = iconPickerService.value
  if (!service || isIconBusy())
    return

  iconTask.value = { action: 'online', serviceId: service.id }
  try {
    const persisted = await persistServiceIcon(service, icon)
    if (persisted)
      window.$message.success(`${service.name || '服务'}图标已选择并保存`)
    else
      window.$message.warning(`${service.name || '服务'}图标已选择，请保存新服务后生效`)
  }
  catch (error) {
    window.$message.error(error instanceof Error ? error.message : '选择或保存图标失败')
  }
  finally {
    iconTask.value = null
  }
}

async function autoDiscoverIcon(service: NexusService) {
  if (isIconBusy())
    return

  iconTask.value = { action: 'discover', serviceId: service.id }
  try {
    const icon = await discoverServiceIcon(service, nexusStore.serviceUrl(service))
    const persisted = await persistServiceIcon(service, icon)
    if (persisted)
      window.$message.success(`${service.name || '服务'}图标已获取并保存`)
    else
      window.$message.warning(`${service.name || '服务'}图标已获取，请保存新服务后生效`)
  }
  catch (error) {
    window.$message.error(error instanceof Error ? error.message : '获取或保存图标失败')
  }
  finally {
    iconTask.value = null
  }
}

async function uploadIcon(service: NexusService, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || isIconBusy())
    return

  iconTask.value = { action: 'upload', serviceId: service.id }
  try {
    const icon = await compressServiceIcon(file)
    const persisted = await persistServiceIcon(service, icon)
    if (persisted)
      window.$message.success(`${service.name || '服务'}图标已上传并保存`)
    else
      window.$message.warning(`${service.name || '服务'}图标已上传，请保存新服务后生效`)
  }
  catch (error) {
    window.$message.error(error instanceof Error ? error.message : '上传或保存图标失败')
  }
  finally {
    input.value = ''
    iconTask.value = null
  }
}

async function save() {
  if (iconTask.value)
    return
  saving.value = true
  try {
    const snapshot: NexusSettingsSnapshot = {
      config: structuredClone(draftConfig.value),
      lanHostPatterns: validateHostPatterns(lanPatternsText.value),
      wanHostPatterns: validateHostPatterns(wanPatternsText.value),
      probeAutoplay: probeAutoplay.value,
      probeInterval: Number(probeInterval.value),
    }
    await nexusStore.saveSettings(snapshot)
    resetDraft()
    window.$message.success('Nexus 设置已保存')
  }
  catch (error) {
    window.$message.error(error instanceof Error ? error.message : 'Nexus 设置保存失败')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="accessGranted" class="mx-auto w-full max-w-[1120px] px-4 pb-14 pt-5 sm:px-6 lg:px-7">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <Button as-child variant="ghost" size="icon" aria-label="返回首页" title="返回首页">
          <RouterLink to="/">
            <Icon icon="lucide:arrow-left" class="size-5" />
          </RouterLink>
        </Button>
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-semibold text-foreground">
            Nexus 设置
          </h1>
          <p class="text-sm text-muted-foreground">
            Komari Nexus
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" :disabled="!dirty || saving" @click="resetDraft">
          <Icon icon="lucide:rotate-ccw" class="size-4" />
          重置
        </Button>
        <Button :disabled="!dirty || saving || iconTask !== null || !appStore.isLoggedIn" @click="save">
          <Icon :icon="saving ? 'lucide:loader-circle' : 'lucide:save'" class="size-4" :class="{ 'animate-spin': saving }" />
          保存
        </Button>
      </div>
    </div>

    <section class="border-b border-border/70 pb-8" aria-labelledby="network-settings-title">
      <div class="mb-4">
        <h2 id="network-settings-title" class="text-lg font-semibold text-foreground">
          网络与轮播
        </h2>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-medium text-foreground">
          内网主机匹配
          <textarea v-model="lanPatternsText" class="nexus-input min-h-30 resize-y font-mono text-xs" spellcheck="false" />
        </label>
        <label class="grid gap-1.5 text-sm font-medium text-foreground">
          外网主机匹配
          <textarea v-model="wanPatternsText" class="nexus-input min-h-30 resize-y font-mono text-xs" spellcheck="false" />
        </label>
        <label class="flex h-11 items-center justify-between gap-3 rounded-sm border border-border/70 px-3 text-sm font-medium text-foreground">
          探针自动轮播
          <input v-model="probeAutoplay" type="checkbox" class="size-4 accent-primary">
        </label>
        <label class="grid gap-1.5 text-sm font-medium text-foreground">
          轮播间隔（秒）
          <input v-model.number="probeInterval" type="number" min="3" max="60" class="nexus-input h-11">
        </label>
      </div>
    </section>

    <section class="border-b border-border/70 py-8" aria-labelledby="group-settings-title">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 id="group-settings-title" class="text-lg font-semibold text-foreground">
          服务分组
        </h2>
        <Button size="sm" variant="outline" :disabled="sortedGroups.length >= NEXUS_MAX_GROUPS" @click="addGroup">
          <Icon icon="lucide:plus" class="size-4" />
          新建分组
        </Button>
      </div>
      <Empty v-if="sortedGroups.length === 0" description="暂无服务分组" class="min-h-28 rounded-md border border-dashed border-border/70" />
      <div v-else class="grid gap-2">
        <div v-for="(group, index) in sortedGroups" :key="group.id" class="flex items-center gap-2 rounded-sm border border-border/70 p-2">
          <input v-model="group.name" class="nexus-input h-10 min-w-0 flex-1" aria-label="分组名称">
          <label class="flex shrink-0 items-center gap-2 px-2 text-xs text-muted-foreground">
            <input v-model="group.enabled" type="checkbox" class="size-4 accent-primary">
            启用
          </label>
          <Button variant="ghost" size="icon-sm" :disabled="index === 0" aria-label="分组上移" title="分组上移" @click="moveGroup(group.id, -1)">
            <Icon icon="lucide:arrow-up" class="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" :disabled="index === sortedGroups.length - 1" aria-label="分组下移" title="分组下移" @click="moveGroup(group.id, 1)">
            <Icon icon="lucide:arrow-down" class="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" class="text-destructive" aria-label="删除分组" title="删除分组" @click="removeGroup(group.id)">
            <Icon icon="lucide:trash-2" class="size-4" />
          </Button>
        </div>
      </div>
    </section>

    <section class="pt-8" aria-labelledby="service-settings-title">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 id="service-settings-title" class="text-lg font-semibold text-foreground">
          服务管理
        </h2>
        <Button size="sm" :disabled="sortedServices.length >= NEXUS_MAX_SERVICES" @click="addService">
          <Icon icon="lucide:plus" class="size-4" />
          新增服务
        </Button>
      </div>
      <Empty v-if="sortedServices.length === 0" description="暂无服务" class="min-h-36 rounded-md border border-dashed border-border/70" />
      <div v-else class="grid gap-4">
        <article v-for="(service, index) in sortedServices" :key="service.id" class="nexus-panel p-4">
          <div class="mb-4 flex items-center gap-3">
            <NexusServiceIcon :icon="service.icon" :name="service.name" />
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-base font-semibold text-foreground">
                {{ service.name || '未命名服务' }}
              </h3>
              <p class="truncate text-xs text-muted-foreground">
                {{ service.description || '服务入口' }}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" :disabled="index === 0" aria-label="服务上移" title="服务上移" @click="moveService(service.id, -1)">
              <Icon icon="lucide:arrow-up" class="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" :disabled="index === sortedServices.length - 1" aria-label="服务下移" title="服务下移" @click="moveService(service.id, 1)">
              <Icon icon="lucide:arrow-down" class="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" class="text-destructive" aria-label="删除服务" title="删除服务" @click="removeService(service.id)">
              <Icon icon="lucide:trash-2" class="size-4" />
            </Button>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
              服务名称
              <input :value="service.name" class="nexus-input h-10 text-sm text-foreground" @input="updateService(service.id, 'name', ($event.target as HTMLInputElement).value)">
            </label>
            <div class="grid gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
              <span>图标</span>
              <div data-nexus-icon-controls class="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                <input
                  :value="service.icon"
                  class="nexus-input col-span-2 h-10 min-w-0 text-sm text-foreground sm:col-span-1"
                  placeholder="Iconify 名称或图片地址"
                  :aria-label="`${service.name || '服务'}图标地址`"
                  @input="updateService(service.id, 'icon', ($event.target as HTMLInputElement).value)"
                >
                <Button type="button" variant="outline" size="sm" class="col-span-2 h-10 sm:col-span-1" :disabled="isIconBusy()" @click="openIconPicker(service.id)">
                  <Icon
                    :icon="iconTask?.serviceId === service.id && iconTask.action === 'online' ? 'lucide:loader-circle' : 'lucide:search'"
                    class="size-4"
                    :class="{ 'animate-spin': iconTask?.serviceId === service.id && iconTask.action === 'online' }"
                  />
                  在线图库
                </Button>
                <Button type="button" variant="outline" size="sm" class="h-10" :disabled="isIconBusy()" @click="autoDiscoverIcon(service)">
                  <Icon
                    :icon="iconTask?.serviceId === service.id && iconTask.action === 'discover' ? 'lucide:loader-circle' : 'lucide:wand-sparkles'"
                    class="size-4"
                    :class="{ 'animate-spin': iconTask?.serviceId === service.id && iconTask.action === 'discover' }"
                  />
                  自动获取
                </Button>
                <Button type="button" variant="outline" size="sm" class="h-10" :disabled="isIconBusy()" @click="openIconUpload(service.id)">
                  <Icon
                    :icon="iconTask?.serviceId === service.id && iconTask.action === 'upload' ? 'lucide:loader-circle' : 'lucide:upload'"
                    class="size-4"
                    :class="{ 'animate-spin': iconTask?.serviceId === service.id && iconTask.action === 'upload' }"
                  />
                  上传图标
                </Button>
                <input
                  :id="iconUploadInputId(service.id)"
                  class="sr-only"
                  type="file"
                  accept=".gif,.ico,.jpeg,.jpg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/vnd.microsoft.icon,image/webp,image/x-icon"
                  tabindex="-1"
                  :disabled="isIconBusy()"
                  @change="uploadIcon(service, $event)"
                >
              </div>
            </div>
            <label class="grid gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
              简短说明
              <input :value="service.description" class="nexus-input h-10 text-sm text-foreground" @input="updateService(service.id, 'description', ($event.target as HTMLInputElement).value)">
            </label>
            <label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
              服务分组
              <select :value="service.groupId" class="nexus-input h-10 text-sm text-foreground" @change="updateService(service.id, 'groupId', ($event.target as HTMLSelectElement).value)">
                <option value="">未分组</option>
                <option v-for="group in sortedGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
              </select>
            </label>
            <label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
              绑定节点
              <select :value="service.nodeUuid" class="nexus-input h-10 text-sm text-foreground" @change="updateService(service.id, 'nodeUuid', ($event.target as HTMLSelectElement).value)">
                <option value="">不绑定节点</option>
                <option v-for="node in nodesStore.visibleNodes" :key="node.uuid" :value="node.uuid">{{ node.name }}</option>
              </select>
            </label>
            <label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
              LAN 地址
              <input :value="service.lanUrl" type="url" class="nexus-input h-10 text-sm text-foreground" placeholder="http://192.168.1.10" @input="updateService(service.id, 'lanUrl', ($event.target as HTMLInputElement).value)">
            </label>
            <label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
              WAN 地址
              <input :value="service.wanUrl" type="url" class="nexus-input h-10 text-sm text-foreground" placeholder="https://service.example.com" @input="updateService(service.id, 'wanUrl', ($event.target as HTMLInputElement).value)">
            </label>
          </div>
          <div class="mt-4 flex flex-wrap gap-5 border-t border-border/60 pt-3 text-sm text-foreground">
            <label class="flex items-center gap-2">
              <input :checked="service.featured" type="checkbox" class="size-4 accent-primary" @change="updateService(service.id, 'featured', ($event.target as HTMLInputElement).checked)">
              加入常用服务
            </label>
            <label class="flex items-center gap-2">
              <input :checked="service.enabled" type="checkbox" class="size-4 accent-primary" @change="updateService(service.id, 'enabled', ($event.target as HTMLInputElement).checked)">
              启用服务
            </label>
          </div>
        </article>
      </div>
    </section>

    <NexusIconPicker
      v-if="iconPickerService"
      v-model:open="iconPickerOpen"
      :service-name="iconPickerService.name"
      :current-icon="iconPickerService.icon"
      @select="selectOnlineIcon"
    />
  </div>
  <div v-else class="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status" aria-live="polite">
    <Icon icon="lucide:loader-circle" class="mr-2 size-4 animate-spin motion-reduce:animate-none" />
    正在验证访问权限
  </div>
</template>
